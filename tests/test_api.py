"""Pruebas de la API contra el entorno de dev (`make test`). Crean sus propias partidas y las borran al terminar."""
import json
import os
import re
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import pytest

BASE = os.environ.get("BASE_URL", "http://web:8000")


def pide(metodo, ruta, datos=None):
    cuerpo = json.dumps(datos).encode() if datos is not None else None
    req = urllib.request.Request(BASE + ruta, data=cuerpo, method=metodo, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            texto = r.read()
            return r.status, json.loads(texto) if texto else None
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


@pytest.fixture
def partida():
    """Devuelve una función que crea partidas de prueba; al terminar se eliminan todas."""
    creadas = []

    def crear(modo="normal"):
        codigo, run = pide("POST", "/runs", {"name": "ZZ prueba", "mode": modo})
        assert codigo == 201
        creadas.append(run["id"])
        return f"/runs/{run['id']}"

    yield crear
    for run_id in creadas:
        pide("DELETE", f"/runs/{run_id}")


def captura(R, ruta, especie, **extra):
    codigo, fila = pide("POST", f"{R}/events", {"event_type": "captura", "route": ruta, "species": especie, **extra})
    assert codigo == 201, fila
    return fila["id"]


def test_entorno_disponible():
    assert pide("GET", "/status")[0] == 200


# ---------- Modos y reglas ----------
def test_modos_ofrecidos():
    assert pide("GET", "/rules")[1]["modes"] == ["normal", "nuzlocke", "randomlocke"]


def test_modo_invalido():
    assert pide("POST", "/runs", {"name": "ZZ prueba", "mode": "personalizada"})[0] == 422


def test_plantillas_se_copian(partida):
    plantillas = pide("GET", "/rules")[1]["templates"]
    for modo in ("normal", "nuzlocke", "randomlocke"):
        R = partida(modo)
        run = next(r for r in pide("GET", "/runs")[1] if f"/runs/{r['id']}" == R)
        assert run["mode"] == modo and run["rules"] == plantillas[modo]


def test_partida_sin_modo_es_normal():
    codigo, run = pide("POST", "/runs", {"name": "ZZ prueba"})
    assert codigo == 201 and run["mode"] == "normal"
    pide("DELETE", f"/runs/{run['id']}")


# ---------- Reglas al registrar ----------
def test_normal_sin_reglas(partida):
    R = partida("normal")
    captura(R, "Ruta 1", "Pikachu")
    captura(R, "Ruta 1", "Zubat")
    assert pide("POST", f"{R}/events", {"event_type": "fallo", "route": "Ruta 1", "species": "Abra"})[0] == 201
    captura(R, "Ruta 1", "Pikachu")


def test_normal_no_admite_variocolor(partida):
    assert pide("POST", f"{partida('normal')}/events",
                {"event_type": "captura", "route": "R", "species": "Mew", "shiny": True})[0] == 422


@pytest.mark.parametrize("modo", ["nuzlocke", "randomlocke"])
def test_primer_encuentro_y_mote(partida, modo):
    R = partida(modo)
    ev = lambda **d: pide("POST", f"{R}/events", {"route": "Ruta 1", "species": "Pikachu", "event_type": "captura", **d})[0]
    assert ev() == 422
    assert ev(nickname="   ") == 422
    assert ev(nickname="Pika") == 201
    assert ev(nickname="Otro") == 409
    assert ev(route="RUTA 1", nickname="Otro") == 409
    assert ev(event_type="fallo") == 409


def test_fallo_ocupa_la_zona(partida):
    R = partida("nuzlocke")
    assert pide("POST", f"{R}/events", {"event_type": "fallo", "route": "R", "species": "Abra"})[0] == 201
    assert pide("POST", f"{R}/events", {"event_type": "captura", "route": "R", "species": "Abra", "nickname": "A"})[0] == 409


def test_variocolor_no_gasta_la_zona(partida):
    R = partida("nuzlocke")
    captura(R, "Ruta 1", "Mew", nickname="Brillo", shiny=True)
    captura(R, "Ruta 1", "Abra", nickname="A")
    captura(R, "Ruta 1", "Mewtwo", nickname="Otro", shiny=True)
    assert pide("POST", f"{R}/events", {"event_type": "fallo", "route": "R", "species": "Mew", "shiny": True})[0] == 422
    equipo = {p["species"]: p["shiny"] for p in pide("GET", f"{R}/team")[1]}
    assert equipo == {"Mew": True, "Abra": False, "Mewtwo": True}


def test_especie_inventada_y_nombre_oficial(partida):
    R = partida()
    assert pide("POST", f"{R}/events", {"event_type": "captura", "route": "R", "species": "Inventamon"})[0] == 422
    assert pide("POST", f"{R}/events", {"event_type": "captura", "route": "R", "species": "pikachu"})[1]["species"] == "Pikachu"


def test_muerte_ya_no_va_por_eventos(partida):
    assert pide("POST", f"{partida()}/events", {"event_type": "muerte", "route": "R", "species": "Abra"})[0] == 422


def test_peticiones_simultaneas(partida):
    R = partida("nuzlocke")
    with ThreadPoolExecutor(8) as hilos:
        codigos = sorted(hilos.map(
            lambda i: pide("POST", f"{R}/events", {"event_type": "captura", "route": "R", "species": "Abra", "nickname": f"N{i}"})[0],
            range(8)))
    assert codigos == [201] + [409] * 7


# ---------- Identidad: dos Pokémon en la misma zona son independientes ----------
def test_dos_pokemon_en_la_misma_zona(partida):
    R = partida()
    a, b = captura(R, "Ruta 1", "Pikachu"), captura(R, "Ruta 1", "Zubat")
    pide("PUT", f"{R}/captures/{a}/sheet", {"level": 11})
    pide("PUT", f"{R}/captures/{b}/sheet", {"level": 22})
    assert pide("GET", f"{R}/captures/{a}/sheet")[1]["level"] == 11
    assert pide("GET", f"{R}/captures/{b}/sheet")[1]["level"] == 22
    assert pide("PUT", f"{R}/party", {"captures": [a, b]})[0] == 200
    assert pide("POST", f"{R}/captures/{b}/death")[0] == 201
    assert [p["alive"] for p in pide("GET", f"{R}/party")[1]] == [True, False]
    assert pide("DELETE", f"{R}/encounters/{a}")[0] == 204
    assert pide("GET", f"{R}/captures/{b}/sheet")[1]["level"] == 22


def test_no_se_toca_un_pokemon_de_otra_partida(partida):
    R, O = partida(), partida()
    x = captura(O, "Ruta 1", "Mew")
    datos = {"route": "R", "species": "Mew"}
    assert pide("GET", f"{R}/captures/{x}/sheet")[0] == 404
    assert pide("PUT", f"{R}/captures/{x}/sheet", {"level": 5})[0] == 404
    assert pide("PUT", f"{R}/captures/{x}", datos)[0] == 404
    assert pide("POST", f"{R}/captures/{x}/death")[0] == 404
    assert pide("DELETE", f"{R}/captures/{x}/death")[0] == 404
    assert pide("DELETE", f"{R}/encounters/{x}")[0] == 404
    assert pide("PUT", f"{R}/party", {"captures": [x]})[0] == 409
    assert [p["capture_id"] for p in pide("GET", f"{O}/team")[1]] == [x]


# ---------- Equipo ----------
def test_equipo(partida):
    R = partida()
    a, b = captura(R, "Ruta 1", "Pikachu"), captura(R, "Ruta 2", "Zubat")
    _, f = pide("POST", f"{R}/events", {"event_type": "fallo", "route": "Ruta 3", "species": "Abra"})
    codigo, equipo = pide("PUT", f"{R}/party", {"captures": [a, b]})
    assert codigo == 200 and [p["capture_id"] for p in equipo] == [a, b]
    assert pide("PUT", f"{R}/party", {"captures": [a, a]})[0] == 409
    assert pide("PUT", f"{R}/party", {"captures": [1, 2, 3, 4, 5, 6, 7]})[0] == 422
    assert pide("PUT", f"{R}/party", {"captures": [f["id"]]})[0] == 409


def test_debilitado_sigue_en_el_equipo_pero_no_vuelve(partida):
    R = partida()
    a = captura(R, "Ruta 1", "Pikachu")
    pide("PUT", f"{R}/party", {"captures": [a]})
    pide("POST", f"{R}/captures/{a}/death")
    assert pide("PUT", f"{R}/party", {"captures": [a]})[0] == 200
    pide("PUT", f"{R}/party", {"captures": []})
    assert pide("PUT", f"{R}/party", {"captures": [a]})[0] == 409


# ---------- Ficha ----------
def test_ficha_y_olvidados(partida):
    R = partida()
    a = captura(R, "Ruta 1", "Pikachu")
    codigo, f = pide("PUT", f"{R}/captures/{a}/sheet", {"level": 12, "moves": ["Rayo", "Placaje"], "nature": "Fuerte", "hp": 30})
    assert codigo == 200 and f["level"] == 12 and f["nature"] == "Fuerte"
    f = pide("PUT", f"{R}/captures/{a}/sheet", {"moves": ["Rayo"]})[1]
    assert f["forgotten"] == ["Placaje"]
    f = pide("PUT", f"{R}/captures/{a}/sheet", {"moves": ["Rayo", "placaje"]})[1]
    assert f["forgotten"] == []


def test_lecturas_reales_y_estimadas(partida):
    R = partida()
    a = captura(R, "Ruta 1", "Pikachu")
    ruta = f"{R}/captures/{a}/sheet"
    assert pide("GET", ruta)[1]["readings"] == {}
    # Lo que se escribe es una lectura real a ese nivel
    h5, v5 = {"level": 5, "value": 20}, {"level": 5, "value": 11}
    f = pide("PUT", ruta, {"level": 5, "hp": 20, "speed": 11})[1]
    assert f["readings"] == {"hp": [h5], "speed": [v5]}
    # Lo estimado guarda el valor sin añadir lectura; lo corregido se añade a las anteriores
    v10 = {"level": 10, "value": 19}
    f = pide("PUT", ruta, {"level": 10, "hp": 30, "speed": 19, "estimated": ["hp"]})[1]
    assert f["hp"] == 30
    assert f["readings"] == {"hp": [h5], "speed": [v5, v10]}
    # Una estimación nunca se convierte en punto de partida
    f = pide("PUT", ruta, {"level": 20, "hp": 50, "speed": 35, "estimated": ["hp", "speed"]})[1]
    assert f["readings"] == {"hp": [h5], "speed": [v5, v10]}
    # Corregir a un nivel ya leído sustituye esa lectura, aunque llegue marcada como estimada
    f = pide("PUT", ruta, {"level": 5, "hp": 21, "speed": 12, "estimated": ["hp"]})[1]
    assert f["readings"] == {"hp": [{"level": 5, "value": 21}], "speed": [v10, {"level": 5, "value": 12}]}
    # Sin nivel se conservan; una estadística vaciada empieza de cero
    f = pide("PUT", ruta, {"hp": 21})[1]
    assert f["readings"] == {"hp": [{"level": 5, "value": 21}]}
    assert pide("PUT", ruta, {"level": 5, "estimated": ["suerte"]})[0] == 422


def test_evolucionar(partida):
    R = partida()
    a = captura(R, "Ruta 1", "Cleffa")
    ruta = f"{R}/captures/{a}/sheet"
    pide("PUT", ruta, {"level": 5, "hp": 20, "speed": 7, "moves": ["Destructor"]})
    assert pide("GET", f"{R}/team")[1][0]["species"] == "Cleffa"
    # El registro cambia de especie y conserva la ficha; las lecturas guardan la diferencia de bases
    codigo, r = pide("POST", f"{R}/captures/{a}/evolve", {"species": "clefairy"})
    assert codigo == 200 and r["species"] == "Clefairy"
    assert pide("GET", f"{R}/team")[1][0]["species"] == "Clefairy"
    f = pide("GET", ruta)[1]
    assert f["level"] == 5 and f["moves"] == ["Destructor"]
    assert f["readings"]["hp"] == [{"level": 5, "value": 20, "shift": 40}]   # 2 · (70 − 50)
    assert f["readings"]["speed"] == [{"level": 5, "value": 7, "shift": 40}]  # 2 · (35 − 15)
    # Lo estimado no pisa esa lectura; lo escrito a ese nivel sí
    f = pide("PUT", ruta, {"level": 5, "hp": 22, "speed": 9, "estimated": ["hp"]})[1]
    assert f["readings"]["hp"] == [{"level": 5, "value": 20, "shift": 40}]
    assert f["readings"]["speed"] == [{"level": 5, "value": 9}]
    # Los desplazamientos se acumulan en cada evolución
    assert pide("POST", f"{R}/captures/{a}/evolve", {"species": "Clefable"})[0] == 200
    assert pide("GET", ruta)[1]["readings"]["hp"][0]["shift"] == 90  # 2 · (95 − 50)
    # Se puede saltar a una evolución de más adelante en la cadena (varios niveles de golpe)
    b = captura(R, "Ruta 2", "Charmander")
    assert pide("POST", f"{R}/captures/{b}/evolve", {"species": "Charizard"})[0] == 200


def test_catalogo_incluye_ataques_de_juegos_antiguos():
    ataques = {a["name"]: a for a in pide("GET", "/moves")[1]}
    # Ya no los aprende nadie en el juego de referencia, pero existen en juegos antiguos y ROM
    golpe = ataques["Golpe Kárate"]
    assert golpe["type"] == "fighting" and golpe["category"] == "physical" and golpe["power"] == 50 and golpe["description"]
    # Los que no se pueden aprender, no
    assert "Pikavoltio Letal" not in ataques and "Maxiataque" not in ataques and "Forcejeo" not in ataques
    assert all(a["description"] for a in ataques.values())


def test_datos_de_evolucion():
    codigo, datos = pide("GET", "/species/evolution-data")
    assert codigo == 200 and len(datos) == 1025
    charmander = datos["4"]
    assert charmander["name"] == "Charmander" and charmander["bases"]["hp"] == 39
    assert charmander["types"][0]["identifier"] == "fire"
    # Basta con el nivel: la web evoluciona sola
    assert charmander["evolutions"] == [{"to": 5, "level": 16, "auto": True}]
    # Nivel y una condición que la web no puede saber: hay que preguntar
    assert datos["265"]["evolutions"] == [{"to": 266, "level": 7, "auto": False}, {"to": 268, "level": 7, "auto": False}]
    # Sin nivel (amistad): solo se sugiere
    assert datos["173"]["evolutions"] == [{"to": 35, "level": None, "auto": False}]
    assert datos["6"]["evolutions"] == []


def test_evolucionar_errores(partida):
    R = partida()
    a = captura(R, "Ruta 1", "Cleffa")
    assert pide("POST", f"{R}/captures/{a}/evolve", {"species": "Inventado"})[0] == 422
    assert pide("POST", f"{R}/captures/{a}/evolve", {"species": "Cleffa"})[0] == 409
    # Solo sus evoluciones: ni otra especie ni hacia atrás
    assert pide("POST", f"{R}/captures/{a}/evolve", {"species": "Pikachu"})[0] == 422
    b = captura(R, "Ruta 2", "Clefairy")
    assert pide("POST", f"{R}/captures/{b}/evolve", {"species": "Cleffa"})[0] == 422
    assert pide("POST", f"{R}/captures/999999999/evolve", {"species": "Clefairy"})[0] == 404
    # Sin ficha guardada también funciona
    assert pide("POST", f"{R}/captures/{a}/evolve", {"species": "Clefairy"})[0] == 200
    assert pide("GET", f"{R}/captures/{a}/sheet")[1]["readings"] == {}
    pide("POST", f"{R}/captures/{a}/death")
    assert pide("POST", f"{R}/captures/{a}/evolve", {"species": "Clefable"})[0] == 409


def test_ficha_errores(partida):
    R = partida()
    a = captura(R, "Ruta 1", "Pikachu")
    _, f = pide("POST", f"{R}/events", {"event_type": "fallo", "route": "Ruta 3", "species": "Abra"})
    assert pide("GET", f"{R}/captures/{f['id']}/sheet")[0] == 404
    assert pide("GET", f"{R}/captures/999999999/sheet")[0] == 404
    assert pide("GET", f"/runs/999999999/captures/{a}/sheet")[0] == 404
    assert pide("GET", f"{R}/captures/abc/sheet")[0] == 422
    assert pide("PUT", f"{R}/captures/{a}/sheet", {"nature": "Nada"})[0] == 422


# ---------- Debilitar y revivir ----------
def test_debilitar_y_revivir(partida):
    R = partida()
    a = captura(R, "Ruta 1", "Zubat")
    codigo, m = pide("POST", f"{R}/captures/{a}/death")
    assert codigo == 201 and m["capture_id"] == a and m["species"] == "Zubat"
    assert pide("POST", f"{R}/captures/{a}/death")[0] == 409
    assert pide("GET", f"{R}/team")[1] == []
    assert [p["capture_id"] for p in pide("GET", f"{R}/graveyard")[1]] == [a]
    assert pide("DELETE", f"{R}/encounters/{m['id']}")[0] == 404
    assert pide("DELETE", f"{R}/captures/{a}/death")[0] == 204
    assert pide("DELETE", f"{R}/captures/{a}/death")[0] == 404
    assert len(pide("GET", f"{R}/team")[1]) == 1


# ---------- Corregir datos ----------
def test_corregir_conserva_ficha_y_equipo(partida):
    R = partida("nuzlocke")
    a = captura(R, "Ruta 1", "Pikachu", nickname="Pika")
    captura(R, "Ruta 2", "Zubat", nickname="Zu")
    pide("PUT", f"{R}/captures/{a}/sheet", {"level": 15})
    pide("PUT", f"{R}/party", {"captures": [a]})
    codigo, f = pide("PUT", f"{R}/captures/{a}", {"route": "Ruta 3", "species": "raichu", "nickname": "Rai"})
    assert codigo == 200 and f["species"] == "Raichu"
    assert pide("GET", f"{R}/captures/{a}/sheet")[1]["level"] == 15
    p = pide("GET", f"{R}/party")[1][0]
    assert (p["capture_id"], p["species"], p["nickname"], p["route"]) == (a, "Raichu", "Rai", "Ruta 3")
    captura(R, "Ruta 1", "Abra", nickname="Ab")  # la zona antigua queda libre


def test_corregir_respeta_las_reglas(partida):
    R = partida("nuzlocke")
    a = captura(R, "Ruta 1", "Pikachu", nickname="Pika")
    captura(R, "Ruta 2", "Zubat", nickname="Zu")
    corregir = lambda **d: pide("PUT", f"{R}/captures/{a}", {"route": "Ruta 1", "species": "Pikachu", "nickname": "Pika", **d})[0]
    assert corregir() == 200
    assert corregir(route="RUTA 1") == 200
    assert corregir(route="Ruta 2") == 409
    assert corregir(nickname=None) == 422
    assert corregir(species="Inventamon") == 422
    assert corregir(route="Ruta 2", shiny=True) == 200


def test_corregir_un_debilitado(partida):
    R = partida()
    a = captura(R, "Ruta 1", "Zubat")
    pide("POST", f"{R}/captures/{a}/death")
    assert pide("PUT", f"{R}/captures/{a}", {"route": "Ruta 9", "species": "Golbat"})[0] == 200
    assert [(p["species"], p["route"]) for p in pide("GET", f"{R}/graveyard")[1]] == [("Golbat", "Ruta 9")]
    filas = [e for e in pide("GET", f"{R}/encounters")[1] if e["event_type"] == "muerte"]
    assert [(e["species"], e["route"]) for e in filas] == [("Golbat", "Ruta 9")]


def test_no_se_corrige_un_fallo(partida):
    R = partida()
    _, f = pide("POST", f"{R}/events", {"event_type": "fallo", "route": "R", "species": "Abra"})
    assert pide("PUT", f"{R}/captures/{f['id']}", {"route": "R", "species": "Abra"})[0] == 404


# ---------- Renombrar y eliminar ----------
def test_renombrar_partida(partida):
    R = partida("nuzlocke")
    codigo, run = pide("PATCH", R, {"name": "  ZZ prueba 2  "})
    assert codigo == 200 and run["name"] == "ZZ prueba 2" and run["mode"] == "nuzlocke"
    assert pide("PATCH", R, {"name": "   "})[0] == 422
    assert pide("PATCH", "/runs/999999999", {"name": "x"})[0] == 404


def test_eliminar_partida_completa(partida):
    R, O = partida(), partida()
    a = captura(R, "Ruta 1", "Pikachu")
    x = captura(O, "Ruta 1", "Mew")
    pide("PUT", f"{R}/captures/{a}/sheet", {"level": 5})
    pide("PUT", f"{R}/party", {"captures": [a]})
    pide("POST", f"{R}/captures/{a}/death")
    assert pide("DELETE", R)[0] == 204
    assert pide("GET", f"{R}/team")[0] == 404
    assert pide("DELETE", R)[0] == 404
    assert [p["capture_id"] for p in pide("GET", f"{O}/team")[1]] == [x]


def test_eliminar_encuentros(partida):
    R = partida()
    a = captura(R, "Ruta 1", "Pikachu")
    _, f = pide("POST", f"{R}/events", {"event_type": "fallo", "route": "Ruta 3", "species": "Abra"})
    pide("PUT", f"{R}/captures/{a}/sheet", {"level": 5})
    pide("PUT", f"{R}/party", {"captures": [a]})
    pide("POST", f"{R}/captures/{a}/death")
    assert pide("DELETE", f"{R}/encounters/{a}")[0] == 204
    assert pide("DELETE", f"{R}/encounters/{f['id']}")[0] == 204
    assert pide("DELETE", f"{R}/encounters/{f['id']}")[0] == 404
    assert pide("GET", f"{R}/encounters")[1] == [] and pide("GET", f"{R}/party")[1] == []


# ---------- Datos de tipos y de aprendizaje ----------
def test_tabla_de_tipos():
    codigo, tabla = pide("GET", "/types/chart")
    assert codigo == 200 and len(tabla["types"]) == 18
    F = tabla["factors"]
    assert all(len(fila) == 18 for fila in F.values()) and len(F) == 18
    assert {v for fila in F.values() for v in fila.values()} == {0, 0.5, 1, 2}
    assert F["water"]["fire"] == 2 and F["ground"]["flying"] == 0 and F["fairy"]["dragon"] == 2 and F["fire"]["water"] == 0.5


def test_lo_que_puede_aprender():
    codigo, datos = pide("GET", "/species/4/learnset")
    assert codigo == 200 and datos["abilities"] and datos["moves"]
    assert {m["method"] for m in datos["moves"]} <= {"level-up", "machine", "tutor", "egg"}
    assert pide("GET", "/species/99999/learnset")[0] == 404


def test_catalogo_de_ataques():
    codigo, ataques = pide("GET", "/moves")
    assert codigo == 200 and len(ataques) > 700
    rayo = next(a for a in ataques if a["name"] == "Rayo")
    assert (rayo["type"], rayo["category"], rayo["power"], rayo["accuracy"], rayo["pp"]) == ("electric", "special", 90, 100, 15)
    assert rayo["description"]
    assert all(a["description"] for a in ataques)


def test_catalogo_de_habilidades():
    codigo, habilidades = pide("GET", "/abilities")
    assert codigo == 200 and len(habilidades) > 250 and all(h["description"] for h in habilidades)


def test_ficha_admite_lo_que_no_esta_en_la_lista(partida):
    # Los juegos de fans pueden tener ataques y habilidades propios: la web avisa, pero se pueden añadir a mano
    R = partida()
    a = captura(R, "Ruta 1", "Pikachu")
    codigo, f = pide("PUT", f"{R}/captures/{a}/sheet", {"moves": ["Ataque Inventado"], "ability": "Habilidad Propia"})
    assert codigo == 200 and f["moves"] == ["Ataque Inventado"] and f["ability"] == "Habilidad Propia"


def test_descripciones_en_espanol():
    textos = [a["description"] for a in pide("GET", "/moves")[1]] + [h["description"] for h in pide("GET", "/abilities")[1]]
    en_ingles = [t for t in textos if t.startswith(("The ", "This ", "When ", "If ", "Boosts ", "Powers ", "Lowers ", "Turns "))]
    assert not en_ingles, en_ingles[:3]


def test_ataque_manual_vale_para_la_partida(partida):
    R = partida()
    datos = {"name": "Golpe Propio", "type": "fire", "category": "physical", "power": 70, "accuracy": 95, "pp": 15, "description": "Inventado."}
    codigo, a = pide("PUT", f"{R}/moves", datos)
    assert codigo == 200 and (a["type"], a["type_name"], a["power"]) == ("fire", "Fuego", 70)
    assert pide("GET", f"{R}/moves")[1] == [a]
    # Sin distinguir mayúsculas: se actualiza el mismo, no se crea otro
    assert pide("PUT", f"{R}/moves", {"name": "golpe propio", "power": 80})[1]["power"] == 80
    lista = pide("GET", f"{R}/moves")[1]
    assert len(lista) == 1 and lista[0]["type"] is None
    # Otra partida no lo ve
    assert pide("GET", f"{partida()}/moves")[1] == []


def test_ataque_manual_valida_los_datos(partida):
    R = partida()
    assert pide("PUT", f"{R}/moves", {"name": "Rayo"})[0] == 409
    assert pide("PUT", f"{R}/moves", {"name": "Otro", "type": "inventado"})[0] == 422
    assert pide("PUT", f"{R}/moves", {"name": "Otro", "accuracy": 101})[0] == 422
    assert pide("PUT", f"{R}/moves", {"name": "Otro", "category": "rara"})[0] == 422
    assert pide("PUT", "/runs/999999999/moves", {"name": "Otro"})[0] == 404


def test_los_fallos_traen_la_especie_para_su_dibujo(partida):
    R = partida()
    assert pide("POST", f"{R}/events", {"event_type": "fallo", "route": "R", "species": "Pikachu"})[0] == 201
    assert pide("GET", f"{R}/encounters")[1][0]["species_id"] == 25


def test_la_web_no_repite_nombres_de_funcion():
    # En JavaScript, la segunda función con un nombre pisa a la primera sin avisar: así se rompió «Añadir» del equipo
    with urllib.request.urlopen(BASE + "/app.js", timeout=10) as r:
        codigo = r.read().decode()
    nombres = re.findall(r"^(?:async )?function (\w+)", codigo, re.M)
    assert not [n for n in set(nombres) if nombres.count(n) > 1]


def test_descripciones_detalladas():
    habilidades = {h["name"]: h["description"] for h in pide("GET", "/abilities")[1]}
    assert "30 %" in habilidades["Alma Cura"] and "adyacente" in habilidades["Alma Cura"]
    ataques = {a["name"]: a["description"] for a in pide("GET", "/moves")[1]}
    assert "Puede paralizar" in ataques["Rayo"] and "Probabilidad: 10 %" in ataques["Rayo"]
    assert "Prioridad +1" in ataques["Ataque Rápido"]
    # Los recientes vienen de otra fuente: sin ese detalle, Garra Nociva no diría el 50 %
    assert "50 %" in ataques["Garra Nociva"] and "Prioridad +4" in ataques["Telatrampa"]


# ---------- Importar el guardado del juego ----------
# Un guardado pequeño fabricado aquí, con el formato de Pokémon Essentials (Ruby Marshal): el real no se sube.
def m_entero(n):
    if n == 0:
        return b"\x00"
    if 0 < n < 123:
        return bytes([n + 5])
    if -124 < n < 0:
        return bytes([(n - 5) & 0xFF])
    largo = (n.bit_length() + 7) // 8
    return bytes([largo]) + n.to_bytes(largo, "little")


def m_simbolo(s):
    return b":" + m_entero(len(s.encode())) + s.encode()


class Simbolo:
    def __init__(self, nombre):
        self.nombre = nombre


class Objeto:
    def __init__(self, clase, **v):
        self.clase, self.v = clase, v


def m(valor):
    """Codifica en Marshal: None, bool, int (hasta 2^30), str, list, dict con claves símbolo y objetos."""
    if valor is None:
        return b"0"
    if valor is True:
        return b"T"
    if valor is False:
        return b"F"
    if isinstance(valor, int):
        return b"i" + m_entero(valor)
    if isinstance(valor, Simbolo):
        return m_simbolo(valor.nombre)
    if isinstance(valor, str):
        datos = valor.encode()
        return b'I"' + m_entero(len(datos)) + datos + m_entero(1) + m_simbolo("E") + b"T"
    if isinstance(valor, list):
        return b"[" + m_entero(len(valor)) + b"".join(m(x) for x in valor)
    if isinstance(valor, Objeto):
        return b"o" + m_simbolo(valor.clase) + m_entero(len(valor.v)) + b"".join(m_simbolo("@" + k) + m(x) for k, x in valor.v.items())
    if isinstance(valor, dict):
        return b"{" + m_entero(len(valor)) + b"".join(m(k if isinstance(k, Simbolo) else Simbolo(k)) + m(x) for k, x in valor.items())
    raise TypeError(valor)


def pokemon_juego(especie, mote, nivel, stats, ataques, game_id, ps=None, mapa=3):
    iv = {Simbolo(k): 15 for k in ("HP", "ATTACK", "DEFENSE", "SPECIAL_ATTACK", "SPECIAL_DEFENSE", "SPEED")}
    return Objeto(
        "Pokemon", species=Simbolo(especie), name=mote, level=nivel, hp=stats[0] if ps is None else ps, totalhp=stats[0],
        attack=stats[1], defense=stats[2], spatk=stats[3], spdef=stats[4], speed=stats[5], nature=Simbolo("HASTY"),
        ability=Simbolo("STAKEOUT"), item=None, moves=[Objeto("Pokemon::Move", id=Simbolo(a), pp=5) for a in ataques],
        iv=iv, ev=iv, personalID=game_id, obtain_map=mapa, shiny=False,
    )


def guardado(equipo, caja=(), bolsa=()):
    raiz = {
        "player": Objeto("Player", party=list(equipo)),
        "storage_system": Objeto("PokemonStorage", boxes=[Objeto("PokemonBox", pokemon=[None, *caja])]),
        "bag": Objeto("PokemonBag", pockets=[[], [[Simbolo(i), n] for i, n in bolsa]]),
    }
    return b"\x04\x08" + m(raiz)


def subir(ruta, datos, metodo="POST"):
    req = urllib.request.Request(BASE + ruta, data=datos, method=metodo, headers={"Content-Type": "application/octet-stream"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def test_importar_propuesta_y_aplicar(partida):
    R = partida("nuzlocke")
    gordin = captura(R, "Laboratorio", "Cleffa", nickname="Gordin")
    pide("PUT", f"{R}/captures/{gordin}/sheet", {"level": 5, "hp": 20})
    otro = captura(R, "Ruta 2", "Pikachu", nickname="Chispa")
    archivo = guardado(
        [pokemon_juego("CLEFAIRY", "Gordin", 12, [40, 17, 15, 20, 22, 16], ["SLACKOFF", "INVENTADO"], 1001, mapa=29),
         pokemon_juego("CHARMANDER", "Fueguito", 7, [24, 13, 11, 14, 12, 15], ["SCRATCH"], 1002, mapa=40)],
        caja=[pokemon_juego("PIKACHU", "Pika", 9, [28, 15, 11, 13, 13, 20], ["THUNDERSHOCK"], 1003, ps=0)],
        bolsa=[("POTION", 3), ("OBJETORARO", 1)],
    )
    codigo, p = subir(f"{R}/import/preview", archivo)
    assert codigo == 200, p
    por_mote = {x["nickname"]: x for x in p["pokemon"]}
    g = por_mote["Gordin"]
    # Traduce al español y empareja por mote; Pika (otro mote) por familia, porque solo hay un Pikachu
    assert g["species"] == "Clefairy" and g["nature"] == "Activa" and g["ability"] == "Vigilante"
    assert g["moves"] == ["Relajo", "INVENTADO"] and g["match"] == {"capture_id": gordin, "by": "nickname"}
    assert por_mote["Pika"]["match"] == {"capture_id": otro, "by": "species"} and por_mote["Pika"]["fainted"]
    assert por_mote["Fueguito"]["match"] is None
    assert g["iv"] == [15] * 6 and g["ev"] == [15] * 6  # para guardarlos al importar
    assert p["untranslated"] == ["INVENTADO", "OBJETORARO"]
    assert {"item": "Poción", "count": 3} in p["bag"] and p["party"]["game"] == [1001, 1002]
    assert p["death_rule"] is True and p["missing"] == []
    # Sin enviar nada todavía, la partida no cambia
    assert pide("GET", f"{R}/captures/{gordin}/sheet")[1]["level"] == 5

    cambios = {
        "updates": [
            {"capture_id": gordin, "game_id": 1001, "species": "Clefairy", "level": 12, "moves": ["Relajo"],
             "stats": {"hp": 40, "attack": 17, "defense": 15, "sp_attack": 20, "sp_defense": 22, "speed": 16}},
            {"capture_id": otro, "game_id": 1003, "nickname": "Pika", "dead": True},
        ],
        "new": [{"game_id": 1002, "species": "Charmander", "nickname": "Fueguito", "route": "Museo", "level": 7}],
        "party": [1001, 1002],
    }
    codigo, r = pide("POST", f"{R}/import/apply", cambios)
    assert codigo == 200, r
    ficha = pide("GET", f"{R}/captures/{gordin}/sheet")[1]
    assert ficha["level"] == 12 and ficha["hp"] == 40 and ficha["moves"] == ["Relajo"]
    assert {"level": 12, "value": 16} in ficha["readings"]["speed"]  # las del juego son lecturas reales
    vivos = {x["nickname"]: x for x in pide("GET", f"{R}/team")[1]}
    assert vivos["Gordin"]["species"] == "Clefairy" and vivos["Fueguito"]["route"] == "Museo"
    assert [x["nickname"] for x in pide("GET", f"{R}/graveyard")[1]] == ["Pika"]
    assert [x["nickname"] for x in pide("GET", f"{R}/party")[1]] == ["Gordin", "Fueguito"]
    # La próxima vez los reconoce por el identificador del juego, aunque cambie el mote
    archivo2 = guardado([pokemon_juego("CLEFAIRY", "Otro", 13, [42, 18, 16, 21, 23, 17], ["SLACKOFF"], 1001)])
    assert subir(f"{R}/import/preview", archivo2)[1]["pokemon"][0]["match"] == {"capture_id": gordin, "by": "id"}


CAMPOS = ["hp", "attack", "defense", "sp_attack", "sp_defense", "speed"]


def mapinfos(nombres):
    """Data/MapInfos.rxdata de RPG Maker XP: {número de mapa: RPG::MapInfo con su nombre}."""
    cuerpo = b"".join(m(n) + m(Objeto("RPG::MapInfo", name=nombre, parent_id=0)) for n, nombre in nombres.items())
    return b"\x04\x08{" + m_entero(len(nombres)) + cuerpo


def test_importar_pone_la_ruta_con_los_mapas_del_juego(partida):
    R = partida("nuzlocke")
    gordin = captura(R, "Laboratorio", "Cleffa", nickname="Gordin")
    archivo = guardado([
        pokemon_juego("CLEFAIRY", "Gordin", 12, [40, 17, 15, 20, 22, 16], ["SLACKOFF"], 1001, mapa=29),
        pokemon_juego("CHARMANDER", "Fueguito", 7, [24, 13, 11, 14, 12, 15], ["SCRATCH"], 1002, mapa=40),
        pokemon_juego("PIKACHU", "Pika", 9, [28, 15, 11, 13, 13, 20], ["THUNDERSHOCK"], 1003, mapa=29),
    ])
    sugeridas = lambda: {x["nickname"]: x["suggested_route"] for x in subir(f"{R}/import/preview", archivo)[1]["pokemon"]}
    # Sin los mapas, solo se sabe la del mismo mapa que un Pokémon ya emparejado
    assert sugeridas() == {"Gordin": None, "Fueguito": None, "Pika": "Laboratorio"}
    assert subir(f"{R}/maps", guardado([]), "PUT")[0] == 422  # un guardado no es MapInfos
    assert subir(f"{R}/maps", b"\x04\x08[\x00", "PUT")[0] == 422
    codigo, r = subir(f"{R}/maps", mapinfos({29: "Lab. Oak", 40: "Museo Pokémon", 3: "Ruta 1"}), "PUT")
    assert codigo == 200 and r == {"maps": 3}
    assert next(x for x in pide("GET", "/runs")[1] if f"/runs/{x['id']}" == R)["maps"] == 3
    # El nombre que ya usa la partida manda sobre el del juego
    assert sugeridas() == {"Gordin": None, "Fueguito": "Museo Pokémon", "Pika": "Laboratorio"}
    assert pide("DELETE", f"{R}/maps")[0] == 204
    assert sugeridas()["Fueguito"] is None
    assert pide("GET", f"{R}/captures/{gordin}/sheet")[0] == 200


def test_importar_sin_mote_aunque_la_partida_lo_pida(partida):
    R = partida("randomlocke")  # motes obligatorios
    codigo, r = pide("POST", f"{R}/import/apply", {"new": [{"game_id": 7, "species": "Pikachu", "route": "Ruta 1"}]})
    assert codigo == 200, r
    pika = pide("GET", f"{R}/team")[1][0]
    assert pika["nickname"] is None
    # Corregir otros datos no obliga a ponerle mote; registrar a mano sí lo sigue pidiendo
    assert pide("PUT", f"{R}/captures/{pika['capture_id']}", {"route": "Ruta 2", "species": "Pikachu"})[0] == 200
    assert pide("POST", f"{R}/events", {"event_type": "captura", "route": "Ruta 3", "species": "Abra"})[0] == 422


def test_importar_no_aplica_las_reglas_de_la_partida(partida):
    R = partida("nuzlocke")  # primer encuentro y motes obligatorios
    captura(R, "Ruta 1", "Abra", nickname="Abri")
    nuevos = [{"species": "Pikachu", "nickname": "Pika", "route": "Ruta 1"},
              {"species": "Eevee", "nickname": "Evi", "route": "Ruta 1", "shiny": True}]
    codigo, r = pide("POST", f"{R}/import/apply", {"new": nuevos})
    assert codigo == 200, r
    vivos = {x["nickname"]: x for x in pide("GET", f"{R}/team")[1]}
    assert vivos["Pika"]["route"] == "Ruta 1" and vivos["Evi"]["shiny"]
    # Corregir otros datos de lo importado no vuelve a exigir las reglas; cambiar de zona sí
    pika = vivos["Pika"]["capture_id"]
    assert pide("PUT", f"{R}/captures/{pika}", {"route": "Ruta 1", "species": "Pikachu", "nickname": "Chispa"})[0] == 200
    evi = vivos["Evi"]["capture_id"]
    assert pide("PUT", f"{R}/captures/{evi}", {"route": "Ruta 1", "species": "Eevee", "nickname": "Evi", "shiny": True})[0] == 200
    captura(R, "Ruta 2", "Zubat", nickname="Zu")
    assert pide("PUT", f"{R}/captures/{pika}", {"route": "Ruta 2", "species": "Pikachu", "nickname": "Chispa"})[0] == 409
    # A mano se siguen aplicando
    assert pide("POST", f"{R}/events", {"event_type": "captura", "route": "Ruta 1", "species": "Mew", "nickname": "M"})[0] == 409


def test_importar_guarda_iv_y_ev(partida):
    R = partida("nuzlocke")
    iv, ev = [31, 20, 15, 10, 5, 0], [4, 8, 0, 0, 252, 255]
    nuevo = {"species": "Pikachu", "nickname": "Pika", "route": "Ruta 1", "level": 12,
             "stats": {"hp": 34, "attack": 20, "defense": 14, "sp_attack": 17, "sp_defense": 17, "speed": 25},
             "iv": iv, "ev": ev}
    assert pide("POST", f"{R}/import/apply", {"new": [nuevo]})[0] == 200
    pika = pide("GET", f"{R}/team")[1][0]["capture_id"]
    ficha = pide("GET", f"{R}/captures/{pika}/sheet")[1]
    assert ficha["iv_ev"] == {"level": 12, "iv": dict(zip(CAMPOS, iv)), "ev": dict(zip(CAMPOS, ev))}
    # Guardar la ficha a mano no los borra; una importación nueva los sustituye
    assert pide("PUT", f"{R}/captures/{pika}/sheet", {"level": 13})[1]["iv_ev"]["level"] == 12
    cambio = {"capture_id": pika, "level": 14, "iv": iv, "ev": [8, 8, 0, 0, 252, 255]}
    assert pide("POST", f"{R}/import/apply", {"updates": [cambio]})[0] == 200
    assert pide("GET", f"{R}/captures/{pika}/sheet")[1]["iv_ev"]["ev"]["hp"] == 8
    # Fuera de rango o incompletos: 422
    malo = {**nuevo, "nickname": "Otro", "route": "Ruta 2", "iv": [32, 0, 0, 0, 0, 0]}
    assert pide("POST", f"{R}/import/apply", {"new": [malo]})[0] == 422
    assert pide("POST", f"{R}/import/apply", {"new": [{**malo, "iv": [1, 2, 3]}]})[0] == 422


def test_importar_es_todo_o_nada(partida):
    R = partida("nuzlocke")
    a = captura(R, "Ruta 1", "Cleffa", nickname="Gordin")
    pide("PUT", f"{R}/captures/{a}/sheet", {"level": 5})
    cambios = {
        "updates": [{"capture_id": a, "level": 30}],
        # La especie no existe: la captura nueva falla y la subida de nivel tampoco se aplica
        "new": [{"species": "Inventamon", "nickname": "Pika", "route": "Ruta 9"}],
    }
    codigo, r = pide("POST", f"{R}/import/apply", cambios)
    assert codigo == 422 and r["detail"].startswith("Pika:")
    assert pide("GET", f"{R}/captures/{a}/sheet")[1]["level"] == 5
    assert pide("POST", f"{R}/import/apply", {"party": [1, 2, 3, 4, 5, 6, 7]})[0] == 422
    assert pide("POST", f"{R}/import/apply", {"party": [999]})[0] == 409
    assert pide("POST", f"{R}/import/apply", {"updates": [{"capture_id": 999999999}]})[0] == 404


def test_importar_rechaza_archivos_malos(partida):
    R = partida()
    real = guardado([pokemon_juego("CLEFAIRY", "Gordin", 12, [40, 17, 15, 20, 22, 16], ["SLACKOFF"], 1001)])
    malos = {
        "vacío": b"",
        "otro formato": b"PK\x03\x04 esto es un zip",
        "cortado": real[: len(real) // 2],
        "aleatorio": b"\x04\x08" + bytes(range(256)) * 20,
        "muy anidado": b"\x04\x08" + b"[\x06" * 1000 + b"0",
        "lista enorme": b"\x04\x08[\x04\xff\xff\xff\x7f",
        "referencia rota": b"\x04\x08@\x0a",
        "en bucle": b"\x04\x08[\x06@\x00",
        "sin jugador": b"\x04\x08" + m({"otra": 1}),
    }
    for nombre, datos in malos.items():
        codigo, r = subir(f"{R}/import/preview", datos)
        assert codigo == 422, (nombre, codigo, r)
        assert isinstance(r["detail"], str)
    # Demasiado grande: el servidor responde 413 sin esperar a recibirlo entero, y a veces corta la conexión antes
    try:
        codigo = subir(f"{R}/import/preview", b"\x04\x08" + b"0" * (5 * 1024 * 1024 + 1))[0]
    except urllib.error.URLError:
        codigo = "conexión cortada"
    assert codigo in (413, "conexión cortada")
    assert pide("GET", "/status")[0] == 200  # y sigue funcionando
    assert subir("/runs/999999999/import/preview", real)[0] == 404
    # Un mote con HTML se guarda como texto: la web nunca lo interpreta como HTML
    raro = guardado([pokemon_juego("CLEFAIRY", "<script>x</script>", 12, [40, 17, 15, 20, 22, 16], [], 1)])
    assert subir(f"{R}/import/preview", raro)[1]["pokemon"][0]["nickname"] == "<script>x</script>"

"""Lee guardados de Pokémon Essentials (Añil y otros juegos de fans) sin ejecutar nada de lo que contienen.

El guardado (`Partida N.rxdata`) está en formato Ruby Marshal. En Ruby, cargarlo puede crear objetos de cualquier clase
y ejecutar código, así que aquí no se usa Ruby ni `pickle`: el lector solo interpreta bytes y produce datos simples
(números, textos, listas, diccionarios y `Obj`, que guarda el nombre de la clase como texto sin buscarla ni crearla).

Defensas contra archivos preparados: tamaño máximo, profundidad máxima, tamaños declarados que no caben en lo que queda
de archivo, referencias que no existen y tipos desconocidos dan `GuardadoInvalido`. Después, solo se toman unos campos
concretos de cada Pokémon y se comprueban sus rangos; lo que no cuadra se descarta.
"""
from dataclasses import dataclass, field

LIMITE_BYTES = 5 * 1024 * 1024
PROFUNDIDAD_MAXIMA = 200
MAXIMO_POKEMON = 2000
MAXIMO_OBJETOS = 2000
MAXIMO_MAPAS = 10000
ESTADISTICAS = (("hp", "@totalhp"), ("attack", "@attack"), ("defense", "@defense"),
                ("sp_attack", "@spatk"), ("sp_defense", "@spdef"), ("speed", "@speed"))
CLAVES_IV = (":HP", ":ATTACK", ":DEFENSE", ":SPECIAL_ATTACK", ":SPECIAL_DEFENSE", ":SPEED")


class GuardadoInvalido(ValueError):
    """El archivo no es un guardado que se pueda leer. El mensaje se puede enseñar al usuario."""


@dataclass
class Obj:
    clase: str
    v: dict = field(default_factory=dict)


class _Lector:
    def __init__(self, datos: bytes):
        self.d = datos
        self.p = 0
        self.simbolos: list[str] = []
        self.objetos: list = []
        self.profundidad = 0

    def byte(self) -> int:
        if self.p >= len(self.d):
            raise GuardadoInvalido("El archivo está incompleto")
        b = self.d[self.p]
        self.p += 1
        return b

    def crudo(self, n: int) -> bytes:
        if n < 0 or self.p + n > len(self.d):
            raise GuardadoInvalido("El archivo está incompleto")
        x = self.d[self.p:self.p + n]
        self.p += n
        return x

    def entero(self) -> int:
        c = self.byte()
        if c > 127:
            c -= 256
        if c == 0:
            return 0
        if 5 <= c <= 127:
            return c - 5
        if -128 <= c <= -5:
            return c + 5
        if c > 0:
            return int.from_bytes(self.crudo(c), "little")
        n = -c
        return int.from_bytes(self.crudo(n), "little") - (1 << (8 * n))

    def cantidad(self) -> int:
        """Un tamaño declarado: cada elemento ocupa al menos un byte, así que no puede pasar de lo que queda."""
        n = self.entero()
        if n < 0 or n > len(self.d) - self.p:
            raise GuardadoInvalido("El archivo declara un tamaño imposible")
        return n

    def texto(self) -> str:
        return self.crudo(self.cantidad()).decode("utf-8", "replace")

    def referencia(self, lista: list, i: int):
        if not 0 <= i < len(lista):
            raise GuardadoInvalido("El archivo hace referencia a algo que no existe")
        return lista[i]

    def simbolo(self) -> str:
        t = self.byte()
        if t == ord(":"):
            s = self.texto()
            self.simbolos.append(s)
            return s
        if t == ord(";"):
            return self.referencia(self.simbolos, self.entero())
        if t == ord("I"):
            s = self.simbolo()
            self.saltar_variables()
            return s
        raise GuardadoInvalido("El archivo tiene un formato inesperado")

    def saltar_variables(self) -> None:
        for _ in range(self.cantidad()):
            self.simbolo()
            self.leer()

    def leer(self):
        self.profundidad += 1
        if self.profundidad > PROFUNDIDAD_MAXIMA:
            raise GuardadoInvalido("El archivo tiene demasiados niveles anidados")
        try:
            return self.valor()
        finally:
            self.profundidad -= 1

    def guardar(self, x):
        self.objetos.append(x)
        return x

    def valor(self):
        t = chr(self.byte())
        if t == "0":
            return None
        if t == "T":
            return True
        if t == "F":
            return False
        if t == "i":
            return self.entero()
        if t in ":;":
            self.p -= 1
            return ":" + self.simbolo()
        if t == "@":
            return self.referencia(self.objetos, self.entero())
        if t == "I":
            x = self.leer()
            self.saltar_variables()
            return x
        if t in '"fmc':
            return self.guardar(self.texto())
        if t == "/":
            x = self.guardar(self.texto())
            self.byte()
            return x
        if t == "l":
            signo = self.byte()
            n = self.cantidad()
            numero = int.from_bytes(self.crudo(2 * n), "little")
            return self.guardar(numero if signo == ord("+") else -numero)
        if t == "[":
            lista = self.guardar([])
            for _ in range(self.cantidad()):
                lista.append(self.leer())
            return lista
        if t in "{}":
            tabla = self.guardar({})
            for _ in range(self.cantidad()):
                clave = self.leer()
                # Una clave compuesta no se usa: no se convierte a texto, que con referencias en bucle no acabaría
                tabla[clave if isinstance(clave, (str, int, bool, type(None))) else ("<clave>", len(tabla))] = self.leer()
            if t == "}":
                self.leer()  # valor por defecto del hash: no se usa
            return tabla
        if t in "oS":
            obj = self.guardar(Obj(self.simbolo()))
            for _ in range(self.cantidad()):
                nombre = self.simbolo()  # antes que el valor: en `a[k()] = v()` Python evalúa primero v()
                obj.v[nombre] = self.leer()
            return obj
        if t == "u":
            obj = self.guardar(Obj(self.simbolo()))
            obj.v["_datos"] = self.crudo(self.cantidad())
            return obj
        if t == "U":
            obj = self.guardar(Obj(self.simbolo()))
            obj.v["_datos"] = self.leer()
            return obj
        if t in "eC":
            self.simbolo()
            return self.leer()
        raise GuardadoInvalido("El archivo tiene un tipo de dato desconocido")


# ---------- De la estructura de Essentials a datos sencillos ----------

def _simbolo(x, largo=60) -> str | None:
    """`:CLEFAIRY` -> `CLEFAIRY`; cualquier otra cosa, None."""
    if isinstance(x, str) and x.startswith(":") and 1 < len(x) <= largo + 1:
        return x[1:]
    return None


def _entero(x, minimo, maximo) -> int | None:
    return x if isinstance(x, int) and not isinstance(x, bool) and minimo <= x <= maximo else None


def _pokemon(q: Obj, lugar: str) -> dict | None:
    v = q.v
    especie = _simbolo(v.get("@species"))
    nivel = _entero(v.get("@level"), 1, 100)
    stats = {nombre: _entero(v.get(campo), 1, 999) for nombre, campo in ESTADISTICAS}
    if especie is None or nivel is None or None in stats.values():
        return None  # incompleto o fuera de rango: se descarta
    mote = v.get("@name")
    mote = mote.strip()[:20] if isinstance(mote, str) and mote.strip() else None
    ataques = []
    for m in v.get("@moves") or []:
        if isinstance(m, Obj) and (a := _simbolo(m.v.get("@id"))):
            ataques.append(a)
    iv, ev = v.get("@iv"), v.get("@ev")
    return {
        "game_id": _entero(v.get("@personalID"), 0, 2**32 - 1),
        "place": lugar,
        "nickname": mote,
        "species": especie,
        "level": nivel,
        "nature": _simbolo(v.get("@nature")),
        "ability": _simbolo(v.get("@ability")),
        "item": _simbolo(v.get("@item")),
        "moves": ataques[:4],
        "stats": stats,
        "iv": [_entero(iv.get(k), 0, 31) for k in CLAVES_IV] if isinstance(iv, dict) else None,
        "ev": [_entero(ev.get(k), 0, 255) for k in CLAVES_IV] if isinstance(ev, dict) else None,
        "fainted": v.get("@hp") == 0,
        "shiny": v.get("@shiny") is True,
        "map": _entero(v.get("@obtain_map"), 0, 1_000_000),
    }


def leer(datos: bytes) -> dict:
    """Devuelve {"pokemon": [...], "bag": [...], "discarded": n} o lanza GuardadoInvalido."""
    if len(datos) > LIMITE_BYTES:
        raise GuardadoInvalido("El archivo es demasiado grande para ser un guardado")
    if datos[:2] != b"\x04\x08":
        raise GuardadoInvalido("No es un guardado de Pokémon Essentials (como Añil)")
    lector = _Lector(datos)
    lector.p = 2
    raiz = lector.leer()
    jugador = raiz.get(":player") if isinstance(raiz, dict) else None
    if not isinstance(jugador, Obj):
        raise GuardadoInvalido("El archivo no tiene los datos del jugador")

    encontrados: list[tuple[Obj, str]] = []
    for q in jugador.v.get("@party") or []:
        if isinstance(q, Obj):
            encontrados.append((q, "party"))
    almacen = raiz.get(":storage_system")
    if isinstance(almacen, Obj):
        for caja in almacen.v.get("@boxes") or []:
            contenido = caja.v.get("@pokemon") if isinstance(caja, Obj) else caja
            for q in contenido or []:
                if isinstance(q, Obj):
                    encontrados.append((q, "box"))
    if len(encontrados) > MAXIMO_POKEMON:
        raise GuardadoInvalido("El archivo tiene demasiados Pokémon")
    pokemon = [p for q, lugar in encontrados if (p := _pokemon(q, lugar))]

    objetos = []
    bolsa = raiz.get(":bag")
    if isinstance(bolsa, Obj):
        for bolsillo in bolsa.v.get("@pockets") or []:
            for o in bolsillo if isinstance(bolsillo, list) else []:
                if isinstance(o, list) and len(o) == 2 and (nombre := _simbolo(o[0])) and (n := _entero(o[1], 1, 9999)):
                    objetos.append({"item": nombre, "count": n})
    return {"pokemon": pokemon, "bag": objetos[:MAXIMO_OBJETOS], "discarded": len(encontrados) - len(pokemon)}


def leer_mapas(datos: bytes) -> dict[int, str]:
    """`Data/MapInfos.rxdata` de la carpeta del juego (RPG Maker XP): número de mapa -> nombre.
    El guardado solo trae el número del mapa donde se obtuvo cada Pokémon; el nombre está aquí."""
    if len(datos) > LIMITE_BYTES:
        raise GuardadoInvalido("El archivo es demasiado grande para ser MapInfos.rxdata")
    if datos[:2] != b"\x04\x08":
        raise GuardadoInvalido("No es MapInfos.rxdata: está en la carpeta Data del juego")
    lector = _Lector(datos)
    lector.p = 2
    raiz = lector.leer()
    if not isinstance(raiz, dict) or len(raiz) > MAXIMO_MAPAS:
        raise GuardadoInvalido("No es MapInfos.rxdata: está en la carpeta Data del juego")
    mapas = {}
    for numero, info in raiz.items():
        nombre = info.v.get("@name") if isinstance(info, Obj) else None
        if _entero(numero, 1, 999_999) is not None and isinstance(nombre, str) and nombre.strip():
            mapas[numero] = nombre.strip()[:100]
    if not mapas:
        raise GuardadoInvalido("No es MapInfos.rxdata: no tiene nombres de mapas")
    return mapas

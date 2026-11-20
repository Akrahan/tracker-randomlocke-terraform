import csv
import json
import mimetypes
import os
import threading
import time
import unicodedata
import socket
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

import psycopg
import redis
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.staticfiles import StaticFiles
from psycopg.rows import DictRow, dict_row
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field
from redis.backoff import NoBackoff
from redis.retry import Retry
from starlette.concurrency import run_in_threadpool

import guardado_anil
import reglas


DB_HOST = os.environ["DB_HOST"]
DB_USER = os.environ["POSTGRES_USER"]
DB_PASSWORD = os.environ["POSTGRES_PASSWORD"]
DB_NAME = os.environ["POSTGRES_DB"]
CACHE_ENABLED = os.environ.get("CACHE_ENABLED", "false").lower() == "true"
CACHE_HOST = os.environ.get("CACHE_HOST", "cache")
CACHE_PASSWORD = os.environ.get("REDIS_PASSWORD")
ENABLE_DOCS = os.environ.get("ENABLE_DOCS", "false").lower() == "true"
INICIALIZAR_DB = os.environ.get("INICIALIZAR_DB", "true").lower() == "true"
INSTANCIA = os.environ.get("INSTANCIA", socket.gethostname())

# La imagen slim no conoce .woff2: sin esto, las tipografías se servirían como application/octet-stream.
mimetypes.add_type("font/woff2", ".woff2")

cache = (
    redis.Redis(
        host=CACHE_HOST,
        password=CACHE_PASSWORD,
        socket_connect_timeout=1,
        socket_timeout=1,
        retry=Retry(NoBackoff(), 0),
        decode_responses=True,
    )
    if CACHE_ENABLED
    else None
)

CACHE_VIGILANCIA_S = 3
CACHE_EQUIPO_TTL_S = 30
CACHE_ESPECIES_TTL_S = 3600
cache_estado = "ok" if CACHE_ENABLED else "no aplica"

DATOS = Path(__file__).parent / "datos"
SCHEMA = Path(__file__).parent / "db" / "schema.sql"
SPECIES = DATOS / "species.csv"
TYPES = DATOS / "types.csv"
SPECIES_TYPES = DATOS / "species_types.csv"
SPECIES_STATS = DATOS / "species_stats.csv"
GAME_IDS = DATOS / "game_ids.csv"
TYPE_EFFICACY = DATOS / "type_efficacy.csv"
NATURES = DATOS / "natures.csv"
MOVES = DATOS / "moves.csv"
SPECIES_MOVES = DATOS / "species_moves.csv"
ABILITIES = DATOS / "abilities.csv"
SPECIES_ABILITIES = DATOS / "species_abilities.csv"

def conectar() -> psycopg.Connection[DictRow]:
    return psycopg.Connection[DictRow].connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        dbname=DB_NAME,
        connect_timeout=2,
        row_factory=dict_row,
    )


def inicializar_db(intentos: int = 10, espera: int = 2) -> None:
    esquema = SCHEMA.read_bytes()
    for intento in range(1, intentos + 1):
        try:
            with conectar() as conn:
                conn.execute(esquema)
                cargar_especies(conn)
                cargar_estadisticas_base(conn)
                cargar_tipos(conn)
                cargar_naturalezas(conn)
                cargar_ataques_y_habilidades(conn)
            return
        except psycopg.Error:
            if intento == intentos:
                raise
            time.sleep(espera)


def cargar_especies(conn: psycopg.Connection[DictRow]) -> None:
    with SPECIES.open(encoding="utf-8", newline="") as fichero:
        filas = [(int(fila["id"]), fila["name"]) for fila in csv.DictReader(fichero)]
    with conn.cursor() as cur:
        cur.executemany(
            "INSERT INTO species (id, name) VALUES (%s, %s) "
            "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name",
            filas,
        )


def cargar_estadisticas_base(conn: psycopg.Connection[DictRow]) -> None:
    with SPECIES_STATS.open(encoding="utf-8", newline="") as fichero:
        filas = [
            (int(f["species_id"]), int(f["hp"]), int(f["attack"]), int(f["defense"]), int(f["sp_attack"]),
             int(f["sp_defense"]), int(f["speed"]), numero_o_nulo(f["evolves_from"]),
             numero_o_nulo(f["evolution_level"]), f["evolution_auto"] == "true")
            for f in csv.DictReader(fichero)
        ]
    with conn.cursor() as cur:
        cur.executemany(
            "INSERT INTO species_stats (species_id, hp, attack, defense, sp_attack, sp_defense, speed, evolves_from, "
            "evolution_level, evolution_auto) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (species_id) DO UPDATE SET hp = EXCLUDED.hp, "
            "attack = EXCLUDED.attack, defense = EXCLUDED.defense, sp_attack = EXCLUDED.sp_attack, "
            "sp_defense = EXCLUDED.sp_defense, speed = EXCLUDED.speed, evolves_from = EXCLUDED.evolves_from, "
            "evolution_level = EXCLUDED.evolution_level, evolution_auto = EXCLUDED.evolution_auto",
            filas,
        )


def cargar_tipos(conn: psycopg.Connection[DictRow]) -> None:
    with TYPES.open(encoding="utf-8", newline="") as fichero:
        tipos = [(int(f["id"]), f["identifier"], f["name"]) for f in csv.DictReader(fichero)]
    with SPECIES_TYPES.open(encoding="utf-8", newline="") as fichero:
        relaciones = [(int(f["species_id"]), int(f["type_id"]), int(f["slot"])) for f in csv.DictReader(fichero)]
    with TYPE_EFFICACY.open(encoding="utf-8", newline="") as fichero:
        eficacias = [(int(f["attack_type_id"]), int(f["target_type_id"]), int(f["factor"])) for f in csv.DictReader(fichero)]
    with conn.cursor() as cur:
        cur.executemany(
            "INSERT INTO types (id, identifier, name) VALUES (%s, %s, %s) "
            "ON CONFLICT (id) DO UPDATE SET identifier = EXCLUDED.identifier, name = EXCLUDED.name",
            tipos,
        )
        cur.executemany(
            "INSERT INTO species_types (species_id, type_id, slot) VALUES (%s, %s, %s) "
            "ON CONFLICT (species_id, slot) DO UPDATE SET type_id = EXCLUDED.type_id",
            relaciones,
        )
        cur.executemany(
            "INSERT INTO type_efficacy (attack_type_id, target_type_id, factor) VALUES (%s, %s, %s) "
            "ON CONFLICT (attack_type_id, target_type_id) DO UPDATE SET factor = EXCLUDED.factor",
            eficacias,
        )


def cargar_naturalezas(conn: psycopg.Connection[DictRow]) -> None:
    with NATURES.open(encoding="utf-8", newline="") as fichero:
        filas = [
            (int(f["id"]), f["name"], f["increased"] or None, f["decreased"] or None)
            for f in csv.DictReader(fichero)
        ]
    with conn.cursor() as cur:
        cur.executemany(
            "INSERT INTO natures (id, name, increased, decreased) VALUES (%s, %s, %s, %s) "
            "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, "
            "increased = EXCLUDED.increased, decreased = EXCLUDED.decreased",
            filas,
        )


def numero_o_nulo(texto: str) -> int | None:
    return int(texto) if texto else None


def cargar_ataques_y_habilidades(conn: psycopg.Connection[DictRow]) -> None:
    with MOVES.open(encoding="utf-8", newline="") as fichero:
        ataques = [
            (int(f["id"]), f["name"], numero_o_nulo(f["type_id"]), f["category"] or None, numero_o_nulo(f["power"]),
             numero_o_nulo(f["accuracy"]), numero_o_nulo(f["pp"]), f["description"] or None)
            for f in csv.DictReader(fichero)
        ]
    with ABILITIES.open(encoding="utf-8", newline="") as fichero:
        habilidades = [(int(f["id"]), f["name"], f["description"] or None) for f in csv.DictReader(fichero)]
    with SPECIES_ABILITIES.open(encoding="utf-8", newline="") as fichero:
        relaciones = [
            (int(f["species_id"]), int(f["ability_id"]), int(f["slot"]), f["hidden"] == "true")
            for f in csv.DictReader(fichero)
        ]
    with conn.cursor() as cur:
        cur.executemany(
            "INSERT INTO moves (id, name, type_id, category, power, accuracy, pp, description) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, "
            "type_id = EXCLUDED.type_id, category = EXCLUDED.category, power = EXCLUDED.power, "
            "accuracy = EXCLUDED.accuracy, pp = EXCLUDED.pp, description = EXCLUDED.description",
            ataques,
        )
        cur.executemany(
            "INSERT INTO abilities (id, name, description) VALUES (%s, %s, %s) "
            "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description",
            habilidades,
        )
        cur.executemany(
            "INSERT INTO species_abilities (species_id, ability_id, slot, hidden) VALUES (%s, %s, %s, %s) "
            "ON CONFLICT (species_id, slot) DO UPDATE SET ability_id = EXCLUDED.ability_id, hidden = EXCLUDED.hidden",
            relaciones,
        )
        # ~55 000 filas: un upsert fila a fila tardaría segundos en cada arranque. Como nada apunta a
        # esta tabla, se vacía y se vuelve a llenar con COPY (carga masiva) en la misma transacción.
        # TRUNCATE bloquea la tabla hasta el COMMIT: si arrancan dos procesos a la vez, el segundo espera.
        cur.execute("TRUNCATE species_moves")
        with SPECIES_MOVES.open(encoding="utf-8", newline="") as fichero, cur.copy(
            "COPY species_moves (species_id, move_id, method, level) FROM STDIN"
        ) as copia:
            for f in csv.DictReader(fichero):
                copia.write_row((int(f["species_id"]), int(f["move_id"]), f["method"], f["level"] or None))


def comprobar_db() -> bool:
    try:
        with conectar() as conn:
            conn.execute("SELECT 1")
        return True
    except psycopg.Error:
        return False


def vigilar_cache() -> None:
    global cache_estado
    if cache is None:
        return
    while True:
        try:
            cache.ping()
            cache_estado = "ok"
        except redis.RedisError:
            cache_estado = "caida"
        time.sleep(CACHE_VIGILANCIA_S)


def marcar_cache_caida() -> None:
    global cache_estado
    cache_estado = "caida"


def comprobar_cache() -> str:
    return cache_estado


# Columnas de especie para una captura "c": su número de Pokédex (para el dibujo) y sus tipos.
# La especie se escribe como texto en la captura, así que se busca por nombre (sin distinguir mayúsculas);
# si el nombre no está en la lista (forma rara de un randomizer), species_id y types salen null.
COLUMNAS_ESPECIE = (
    "(c.details->>'shiny') IS NOT NULL AS shiny, "
    "(SELECT s.id FROM species s WHERE lower(s.name) = lower(c.species)) AS species_id, "
    "(SELECT json_agg(json_build_object('identifier', t.identifier, 'name', t.name) ORDER BY st.slot) "
    "FROM species s JOIN species_types st ON st.species_id = s.id JOIN types t ON t.id = st.type_id "
    "WHERE lower(s.name) = lower(c.species)) AS types"
)


def escapar_like(texto: str) -> str:
    return texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def existe_run(conn, run_id: int) -> None:
    if conn.execute("SELECT 1 FROM runs WHERE id = %s", (run_id,)).fetchone() is None:
        raise HTTPException(status_code=404, detail="La partida no existe")


def leer_con_cache(clave: str, ttl_s: int, consultar):
    estado = "OFF"

    if cache is not None:
        if cache_estado != "ok":
            estado = "DEGRADED"
        else:
            try:
                crudo = cache.get(clave)
                if crudo is not None:
                    return json.loads(crudo), "HIT", cache.ttl(clave)
                estado = "MISS"
            except redis.RedisError:
                marcar_cache_caida()
                estado = "DEGRADED"

    datos = consultar()

    ttl = None
    if estado == "MISS" and cache is not None:
        try:
            cache.set(clave, json.dumps(datos), ex=ttl_s)
            ttl = ttl_s
        except redis.RedisError:
            marcar_cache_caida()
            estado = "DEGRADED"

    return datos, estado, ttl


def poner_cabeceras_cache(response: Response, estado: str, ttl, inicio: float) -> None:
    response.headers["X-Cache"] = estado
    if ttl is not None and ttl >= 0:
        response.headers["X-Cache-TTL"] = str(ttl)
    response.headers["X-Latency-Ms"] = f"{(time.perf_counter() - inicio) * 1000:.1f}"


def leer_equipo(run_id: int):
    def consultar():
        with conectar() as conn:
            existe_run(conn, run_id)
            return jsonable_encoder(
                conn.execute(
                    "SELECT c.id AS capture_id, c.route, c.species, c.details->>'nickname' AS nickname, c.created_at, "
                    + COLUMNAS_ESPECIE + " "
                    "FROM encounters c "
                    "WHERE c.run_id = %s AND c.event_type = 'captura' "
                    "AND " + VIVO + " "
                    "ORDER BY c.created_at",
                    (run_id,),
                ).fetchall()
            )

    return leer_con_cache(f"team:{run_id}", CACHE_EQUIPO_TTL_S, consultar)


def leer_especies(prefijo: str, limit: int):
    def consultar():
        with conectar() as conn:
            filas = conn.execute(
                "SELECT name FROM species WHERE lower(name) LIKE %s ORDER BY name LIMIT %s",
                (escapar_like(prefijo) + "%", limit),
            ).fetchall()
        return [fila["name"] for fila in filas]

    return leer_con_cache(f"species:{prefijo}:{limit}", CACHE_ESPECIES_TTL_S, consultar)


def invalidar_equipo(run_id: int) -> None:
    if cache is None:
        return
    try:
        cache.delete(f"team:{run_id}")
    except redis.RedisError:
        marcar_cache_caida()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if INICIALIZAR_DB:
        inicializar_db()
    if cache is not None:
        threading.Thread(target=vigilar_cache, daemon=True).start()
    yield


app = FastAPI(
    title="Tracker Randomlocke",
    lifespan=lifespan,
    docs_url="/docs" if ENABLE_DOCS else None,
    redoc_url="/redoc" if ENABLE_DOCS else None,
    openapi_url="/openapi.json" if ENABLE_DOCS else None,
)


@app.get("/status")
def status(response: Response):
    db_ok = comprobar_db()
    cache_estado = comprobar_cache()
    if not db_ok:
        response.status_code = 503
        estado = "down"
    elif cache_estado == "caida":
        estado = "degraded"
    else:
        estado = "ok"
    return {"estado": estado, "db": "ok" if db_ok else "down", "cache": cache_estado, "instancia": INSTANCIA}


class RunNueva(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=100)
    # Sin modo, «normal» (sin reglas): así quien la creaba solo con el nombre sigue funcionando igual
    mode: reglas.Modo = "normal"


class RunEditada(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=100)


@app.patch("/runs/{run_id}")
def renombrar_run(run_id: int, run: RunEditada):
    with conectar() as conn:
        fila = conn.execute(
            "UPDATE runs SET name = %s WHERE id = %s RETURNING id, name, created_at, mode, rules",
            (run.name, run_id),
        ).fetchone()
    if fila is None:
        raise HTTPException(status_code=404, detail="La partida no existe")
    return fila


@app.delete("/runs/{run_id}", status_code=204)
def eliminar_run(run_id: int):
    with conectar() as conn:
        existe_run(conn, run_id)
        # Todo en una transacción y en este orden: lo que apunta a una captura se borra antes que la captura
        conn.execute(
            "DELETE FROM pokemon_ficha WHERE capture_id IN (SELECT id FROM encounters WHERE run_id = %s)", (run_id,)
        )
        conn.execute("DELETE FROM party WHERE run_id = %s", (run_id,))
        conn.execute("DELETE FROM run_moves WHERE run_id = %s", (run_id,))
        conn.execute("DELETE FROM encounters WHERE run_id = %s", (run_id,))
        conn.execute("DELETE FROM runs WHERE id = %s", (run_id,))
    invalidar_equipo(run_id)


@app.get("/rules")
def catalogo_reglas():
    return reglas.catalogo_publico()


@app.post("/runs", status_code=201)
def crear_run(run: RunNueva):
    reglas_run = reglas.PLANTILLAS[run.mode]  # copia de la plantilla: si cambia, esta partida no
    with conectar() as conn:
        return conn.execute(
            "INSERT INTO runs (name, mode, rules) VALUES (%s, %s, %s) "
            "RETURNING id, name, created_at, mode, rules",
            (run.name, run.mode, Jsonb(reglas_run)),
        ).fetchone()


class EventoNuevo(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    # La muerte no va aquí: es de una captura concreta (POST /runs/{id}/captures/{id}/death)
    event_type: Literal["captura", "fallo"]
    route: str = Field(min_length=1, max_length=100)
    species: str = Field(min_length=1, max_length=100)
    nickname: str | None = Field(default=None, max_length=20)
    shiny: bool = False


def reglas_bloqueando(conn, run_id: int) -> dict:
    """Las reglas de la partida. FOR UPDATE: comprobar y escribir no es atómico; así dos peticiones a la vez
    no se saltan las reglas."""
    partida = conn.execute("SELECT rules FROM runs WHERE id = %s FOR UPDATE", (run_id,)).fetchone()
    if partida is None:
        raise HTTPException(status_code=404, detail="La partida no existe")
    return partida["rules"]


def especie_oficial(conn, nombre: str) -> str:
    """Solo especies que existen: se busca sin distinguir mayúsculas y se devuelve el nombre oficial
    («pikachu» → «Pikachu»). Así no se cuelan especies inventadas ni erratas."""
    especie = conn.execute("SELECT name FROM species WHERE lower(name) = lower(%s)", (nombre,)).fetchone()
    if especie is None:
        raise HTTPException(
            status_code=422,
            detail=f"«{nombre}» no es una especie de la lista. Elige una de las sugerencias.",
        )
    return especie["name"]


def detalles_captura(nickname: str | None, shiny: bool) -> Jsonb | None:
    detalles: dict = {}
    if nickname:
        detalles["nickname"] = nickname
    if shiny:
        detalles["shiny"] = True
    return Jsonb(detalles) if detalles else None


def comprobar_reglas_evento(conn, run_id: int, evento: "EventoNuevo", reglas_run: dict, excluir: int | None = None,
                            pedir_mote: bool = True, comprobar_zona: bool = True,
                            comprobar_variocolor: bool = True) -> None:
    """Hace cumplir las reglas de la partida (runs.rules, nunca el modo) al registrar o corregir un encuentro.
    `excluir` es la captura que se está corrigiendo: no cuenta como otro encuentro de su zona.
    Al corregir, lo que no cambia no se vuelve a exigir: un Pokémon importado tal cual del juego puede estar
    fuera de las reglas (sin mote, en una zona repetida o variocolor sin la cláusula), y eso no impide corregirlo."""
    captura = evento.event_type == "captura"
    if evento.shiny and not captura:
        raise HTTPException(status_code=422, detail="Solo una captura puede ser variocolor")
    if evento.shiny and comprobar_variocolor and "clausula_variocolor" not in reglas_run:
        raise HTTPException(status_code=422, detail="Esta partida no tiene la cláusula de variocolor")
    if captura and pedir_mote and "motes_obligatorios" in reglas_run and not evento.nickname:
        raise HTTPException(status_code=422, detail="En esta partida los motes son obligatorios")
    # Una captura variocolor no gasta el encuentro de la zona: ni se limita ni cuenta para los siguientes
    if comprobar_zona and "primer_encuentro" in reglas_run and not evento.shiny and conn.execute(
        "SELECT 1 FROM encounters WHERE run_id = %s AND lower(route) = lower(%s) AND id IS DISTINCT FROM %s "
        "AND event_type IN ('captura', 'fallo') AND details->>'shiny' IS NULL",
        (run_id, evento.route, excluir),
    ).fetchone():
        raise HTTPException(status_code=409, detail="Esa zona ya tiene su primer encuentro")


@app.post("/runs/{run_id}/events", status_code=201)
def registrar_evento(run_id: int, evento: EventoNuevo):
    with conectar() as conn:
        reglas_run = reglas_bloqueando(conn, run_id)
        nombre_especie = especie_oficial(conn, evento.species)
        comprobar_reglas_evento(conn, run_id, evento, reglas_run)
        detalles = detalles_captura(evento.nickname if evento.event_type == "captura" else None, evento.shiny)

        fila = conn.execute(
            "INSERT INTO encounters (run_id, event_type, route, species, details) "
            "VALUES (%s, %s, %s, %s, %s) "
            "RETURNING id, run_id, event_type, route, species, created_at",
            (run_id, evento.event_type, evento.route, nombre_especie, detalles),
        ).fetchone()

    invalidar_equipo(run_id)
    return fila


VIVO = "NOT EXISTS (SELECT 1 FROM encounters m WHERE m.capture_id = c.id)"


@app.get("/runs")
def listar_runs():
    # Una sola consulta con todo lo que necesita la portada: contadores y el equipo de cada partida.
    with conectar() as conn:
        return conn.execute(
            "SELECT r.id, r.name, r.created_at, r.mode, r.rules, "
            "(SELECT count(*) FROM jsonb_object_keys(COALESCE(r.map_names, '{}'))) AS maps, "
            "(SELECT count(*) FROM encounters c WHERE c.run_id = r.id "
            "AND c.event_type = 'captura' AND " + VIVO + ") AS alive, "
            "(SELECT count(*) FROM encounters c WHERE c.run_id = r.id AND c.event_type = 'muerte') AS dead, "
            "COALESCE((SELECT json_agg(json_build_object("
            "'species_id', (SELECT s.id FROM species s WHERE lower(s.name) = lower(c.species)), "
            "'species', c.species, 'alive', " + VIVO + ", "
            "'shiny', (c.details->>'shiny') IS NOT NULL) ORDER BY p.position) "
            "FROM party p JOIN encounters c ON c.id = p.capture_id "
            "WHERE p.run_id = r.id), '[]'::json) AS party "
            "FROM runs r ORDER BY r.id DESC"
        ).fetchall()


@app.get("/runs/{run_id}/encounters")
def listar_eventos(run_id: int):
    with conectar() as conn:
        existe_run(conn, run_id)
        return conn.execute(
            "SELECT c.id, c.event_type, c.route, c.species, c.details->>'nickname' AS nickname, c.created_at, "
            "(SELECT s.id FROM species s WHERE lower(s.name) = lower(c.species)) AS species_id "
            "FROM encounters c WHERE c.run_id = %s ORDER BY c.id",
            (run_id,),
        ).fetchall()


@app.get("/runs/{run_id}/team")
def equipo_activo(run_id: int, response: Response):
    inicio = time.perf_counter()
    datos, estado, ttl = leer_equipo(run_id)
    poner_cabeceras_cache(response, estado, ttl, inicio)
    return datos


# ---------- Una captura concreta ----------
def leer_captura(conn, run_id: int, capture_id: int, bloquear: bool = False):
    """Devuelve la captura o da 404. Los id son de toda la base de datos: hay que comprobar que sea de esta partida,
    o desde la dirección se podría tocar un Pokémon de otra. Con `bloquear`, otra petición sobre el mismo Pokémon
    espera a que termine esta transacción."""
    fila = conn.execute(
        "SELECT id, route, species FROM encounters WHERE id = %s AND run_id = %s AND event_type = 'captura'"
        + (" FOR UPDATE" if bloquear else ""),
        (capture_id, run_id),
    ).fetchone()
    if fila is None:
        raise HTTPException(status_code=404, detail="Ese Pokémon no está en esta partida")
    return fila


class CapturaCorregida(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    route: str = Field(min_length=1, max_length=100)
    species: str = Field(min_length=1, max_length=100)
    nickname: str | None = Field(default=None, max_length=20)
    shiny: bool = False


@app.put("/runs/{run_id}/captures/{capture_id}")
def corregir_captura(run_id: int, capture_id: int, datos: CapturaCorregida):
    """Corrige un error al registrar. Conserva el id, así que el Pokémon no pierde su ficha, su sitio en el equipo
    ni su muerte. Como al eliminar, un error de escritura no es historia de la partida: se modifica de verdad."""
    with conectar() as conn:
        reglas_run = reglas_bloqueando(conn, run_id)
        leer_captura(conn, run_id, capture_id)
        nombre_especie = especie_oficial(conn, datos.species)
        evento = EventoNuevo(event_type="captura", route=datos.route, species=nombre_especie,
                             nickname=datos.nickname, shiny=datos.shiny)
        # Lo que no cambia no se vuelve a exigir (puede venir así del guardado del juego)
        antes = conn.execute("SELECT route, details->>'nickname' AS mote, (details->>'shiny') IS NOT NULL AS shiny "
                             "FROM encounters WHERE id = %s", (capture_id,)).fetchone()
        comprobar_reglas_evento(
            conn, run_id, evento, reglas_run, excluir=capture_id, pedir_mote=bool(antes["mote"]),
            comprobar_zona=antes["route"].lower() != datos.route.lower() or antes["shiny"] != datos.shiny,
            comprobar_variocolor=not antes["shiny"],
        )
        fila = conn.execute(
            # Se cambian el mote y el variocolor; lo demás de `details` (el identificador del juego) se conserva
            "UPDATE encounters SET route = %s, species = %s, "
            "details = (COALESCE(details, '{}') - 'nickname' - 'shiny') || COALESCE(%s, '{}'::jsonb) WHERE id = %s "
            "RETURNING id, run_id, event_type, route, species, created_at",
            (datos.route, nombre_especie, detalles_captura(datos.nickname, datos.shiny), capture_id),
        ).fetchone()
        # La fila de la muerte guarda una copia de la ruta y la especie
        conn.execute(
            "UPDATE encounters SET route = %s, species = %s WHERE capture_id = %s",
            (datos.route, nombre_especie, capture_id),
        )
    invalidar_equipo(run_id)
    return fila


@app.post("/runs/{run_id}/captures/{capture_id}/death", status_code=201)
def registrar_muerte(run_id: int, capture_id: int):
    with conectar() as conn:
        existe_run(conn, run_id)
        captura = leer_captura(conn, run_id, capture_id, bloquear=True)  # para que dos peticiones no creen dos muertes
        if conn.execute("SELECT 1 FROM encounters WHERE capture_id = %s", (capture_id,)).fetchone():
            raise HTTPException(status_code=409, detail="Ese Pokémon ya está debilitado")
        fila = marcar_muerte(conn, run_id, captura)
    invalidar_equipo(run_id)
    return fila


def marcar_muerte(conn, run_id: int, captura):
    return conn.execute(
        "INSERT INTO encounters (run_id, event_type, route, species, capture_id) "
        "VALUES (%s, 'muerte', %s, %s, %s) "
        "RETURNING id, run_id, event_type, route, species, created_at, capture_id",
        (run_id, captura["route"], captura["species"], captura["id"]),
    ).fetchone()


# ---------- Corregir errores ----------
# Decisión del 27 oct. (opción A): un error de escritura no es historia de la partida, así que se BORRA de verdad
# (el registro sigue siendo append-only para lo que sí pasó).

@app.delete("/runs/{run_id}/captures/{capture_id}/death", status_code=204)
def revivir(run_id: int, capture_id: int):
    with conectar() as conn:
        existe_run(conn, run_id)
        leer_captura(conn, run_id, capture_id)
        if not conn.execute("DELETE FROM encounters WHERE capture_id = %s", (capture_id,)).rowcount:
            raise HTTPException(status_code=404, detail="Ese Pokémon no está debilitado")
    invalidar_equipo(run_id)


@app.delete("/runs/{run_id}/encounters/{encounter_id}", status_code=204)
def eliminar_encuentro(run_id: int, encounter_id: int):
    with conectar() as conn:
        existe_run(conn, run_id)
        if conn.execute(
            "SELECT 1 FROM encounters WHERE id = %s AND run_id = %s AND event_type IN ('captura', 'fallo')",
            (encounter_id, run_id),
        ).fetchone() is None:
            raise HTTPException(status_code=404, detail="Ese encuentro no está en esta partida")
        # Todo en una transacción: la ficha, el sitio en el equipo, la muerte (si la hay) y la captura o el fallo
        conn.execute("DELETE FROM pokemon_ficha WHERE capture_id = %s", (encounter_id,))
        conn.execute("DELETE FROM party WHERE capture_id = %s", (encounter_id,))
        conn.execute("DELETE FROM encounters WHERE capture_id = %s", (encounter_id,))
        conn.execute("DELETE FROM encounters WHERE id = %s", (encounter_id,))
    invalidar_equipo(run_id)


# ---------- Ficha editable (C1) ----------
ESTADISTICAS = ("hp", "attack", "defense", "sp_attack", "sp_defense", "speed")
Estadistica = Annotated[int | None, Field(default=None, ge=1, le=999)]
TextoCorto = Annotated[str, Field(min_length=1, max_length=50)]


class FichaNueva(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    level: int | None = Field(default=None, ge=1, le=100)
    nature: str | None = Field(default=None, max_length=30)
    ability: str | None = Field(default=None, max_length=50)
    item: str | None = Field(default=None, max_length=50)
    moves: list[TextoCorto] = Field(default_factory=list, max_length=4)
    hp: Estadistica = None
    attack: Estadistica = None
    defense: Estadistica = None
    sp_attack: Estadistica = None
    sp_defense: Estadistica = None
    speed: Estadistica = None
    # Las estadísticas que la web ha estimado: conservan su última lectura real en vez de crear una nueva
    estimated: list[Literal["hp", "attack", "defense", "sp_attack", "sp_defense", "speed"]] = Field(default_factory=list)


@app.get("/natures")
def naturalezas():
    with conectar() as conn:
        return conn.execute("SELECT name, increased, decreased FROM natures ORDER BY name").fetchall()


MAX_LECTURAS = 30


def lecturas_completas(ficha: dict) -> dict:
    """Las lecturas de cada estadística, de la más antigua a la más nueva. Admite los formatos anteriores: sin
    lecturas, lo guardado cuenta como leído a ese nivel; y una sola lectura en lugar de una lista."""
    lecturas = {}
    for e in ESTADISTICAS:
        guardadas = ficha["readings"].get(e)
        if isinstance(guardadas, dict):
            lecturas[e] = [guardadas]
        elif guardadas:
            lecturas[e] = guardadas
        elif ficha[e] is not None and ficha["level"] is not None:
            lecturas[e] = [{"level": ficha["level"], "value": ficha[e]}]
    return lecturas


def lecturas_nuevas(ficha: FichaNueva, anteriores: dict) -> dict:
    """Lo escrito es una lectura real a este nivel y sustituye a la que hubiera en él; lo estimado no añade nada."""
    lecturas = {}
    for e in ESTADISTICAS:
        valor = getattr(ficha, e)
        if valor is None:
            continue  # una estadística vaciada empieza de cero
        previas = anteriores.get(e, [])
        # Una lectura de antes de evolucionar (con `shift`) no es el valor de la especie actual a ese nivel
        hay_en_este_nivel = any(x["level"] == ficha.level and not x.get("shift") for x in previas)
        if ficha.level is None or (e in ficha.estimated and previas and not hay_en_este_nivel):
            if previas:
                lecturas[e] = previas
            continue
        otras = [x for x in previas if x["level"] != ficha.level]
        lecturas[e] = [*otras, {"level": ficha.level, "value": valor}][-MAX_LECTURAS:]
    return lecturas


def leer_ficha(conn, capture_id: int):
    fila = conn.execute(
        "SELECT f.level, n.name AS nature, f.ability, f.item, f.moves, f.forgotten, f.readings, f.iv_ev, "
        "f.hp, f.attack, f.defense, f.sp_attack, f.sp_defense, f.speed "
        "FROM pokemon_ficha f LEFT JOIN natures n ON n.id = f.nature_id "
        "WHERE f.capture_id = %s",
        (capture_id,),
    ).fetchone()
    # Un Pokémon sin ficha guardada todavía devuelve todo vacío
    if fila is None:
        return {"level": None, "nature": None, "ability": None, "item": None, "moves": [], "forgotten": [],
                "readings": {}, "iv_ev": None, **{e: None for e in ESTADISTICAS}}
    return {**fila, "readings": lecturas_completas(fila)}


MAX_OLVIDADOS = 20


def calcular_olvidados(olvidados: list[str], antes: list[str], ahora: list[str]) -> list[str]:
    """Los ataques que salen de los 4 huecos pasan a «Olvidados»; los que vuelven a un hueco salen de la lista.

    Se compara sin distinguir mayúsculas y se guardan los más recientes al final."""
    actuales = {m.lower() for m in ahora}
    resultado, vistos = [], set()
    for ataque in [*olvidados, *antes]:
        clave = ataque.lower()
        if clave in actuales or clave in vistos:
            continue
        vistos.add(clave)
        resultado.append(ataque)
    return resultado[-MAX_OLVIDADOS:]


@app.get("/runs/{run_id}/captures/{capture_id}/sheet")
def ver_ficha(run_id: int, capture_id: int):
    with conectar() as conn:
        existe_run(conn, run_id)
        leer_captura(conn, run_id, capture_id)
        return leer_ficha(conn, capture_id)


@app.put("/runs/{run_id}/captures/{capture_id}/sheet")
def guardar_ficha(run_id: int, capture_id: int, ficha: FichaNueva):
    with conectar() as conn:
        existe_run(conn, run_id)
        leer_captura(conn, run_id, capture_id)
        return guardar_ficha_en(conn, capture_id, ficha)


def guardar_ficha_en(conn, capture_id: int, ficha: FichaNueva):
    nature_id = None
    if ficha.nature:
        fila = conn.execute("SELECT id FROM natures WHERE lower(name) = lower(%s)", (ficha.nature,)).fetchone()
        if fila is None:
            raise HTTPException(status_code=422, detail=f"«{ficha.nature}» no es una naturaleza")
        nature_id = fila["id"]
    # FOR UPDATE: si llegan dos guardados a la vez, el segundo espera y calcula sobre el primero
    anterior = conn.execute(
        "SELECT moves, forgotten, readings, level, hp, attack, defense, sp_attack, sp_defense, speed "
        "FROM pokemon_ficha WHERE capture_id = %s FOR UPDATE",
        (capture_id,),
    ).fetchone()
    lecturas_antes = lecturas_completas(anterior) if anterior else {}
    anterior = anterior or {"moves": [], "forgotten": []}
    valores = (
        ficha.level, nature_id, ficha.ability or None, ficha.item or None, ficha.moves,
        calcular_olvidados(anterior["forgotten"], anterior["moves"], ficha.moves),
        Jsonb(lecturas_nuevas(ficha, lecturas_antes)),
        *(getattr(ficha, e) for e in ESTADISTICAS),
    )
    conn.execute(
        "INSERT INTO pokemon_ficha (capture_id, level, nature_id, ability, item, moves, forgotten, readings, "
        "hp, attack, defense, sp_attack, sp_defense, speed) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
        "ON CONFLICT (capture_id) DO UPDATE SET level = EXCLUDED.level, "
        "nature_id = EXCLUDED.nature_id, ability = EXCLUDED.ability, item = EXCLUDED.item, "
        "moves = EXCLUDED.moves, forgotten = EXCLUDED.forgotten, readings = EXCLUDED.readings, "
        "hp = EXCLUDED.hp, attack = EXCLUDED.attack, "
        "defense = EXCLUDED.defense, sp_attack = EXCLUDED.sp_attack, "
        "sp_defense = EXCLUDED.sp_defense, speed = EXCLUDED.speed, updated_at = now()",
        (capture_id, *valores),
    )
    return leer_ficha(conn, capture_id)


# ---------- Evolucionar ----------
class Evolucion(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    species: str = Field(min_length=1, max_length=100)


def bases_de_especie(conn, nombre: str):
    return conn.execute(
        "SELECT b.hp, b.attack, b.defense, b.sp_attack, b.sp_defense, b.speed "
        "FROM species s JOIN species_stats b ON b.species_id = s.id WHERE lower(s.name) = lower(%s)",
        (nombre,),
    ).fetchone()


def es_evolucion_de(conn, nueva: str, anterior: str) -> bool:
    """Sube por la cadena desde la especie nueva buscando la anterior."""
    return conn.execute(
        "WITH RECURSIVE cadena AS ("
        " SELECT b.evolves_from FROM species_stats b JOIN species s ON s.id = b.species_id WHERE lower(s.name) = lower(%s)"
        " UNION ALL"
        " SELECT b.evolves_from FROM species_stats b JOIN cadena c ON b.species_id = c.evolves_from"
        ") SELECT 1 FROM cadena c JOIN species s ON s.id = c.evolves_from WHERE lower(s.name) = lower(%s)",
        (nueva, anterior),
    ).fetchone() is not None


@app.get("/species/evolution-data")
def datos_de_evolucion():
    """Lo que la web necesita para evolucionar sola: nombre, tipos, bases y evoluciones oficiales de cada especie."""
    with conectar() as conn:
        filas = conn.execute(
            "SELECT s.id, s.name, b.hp, b.attack, b.defense, b.sp_attack, b.sp_defense, b.speed, "
            "b.evolves_from, b.evolution_level, b.evolution_auto, "
            "(SELECT coalesce(json_agg(json_build_object('name', t.name, 'identifier', t.identifier) ORDER BY st.slot), '[]') "
            " FROM species_types st JOIN types t ON t.id = st.type_id WHERE st.species_id = s.id) AS types "
            "FROM species s JOIN species_stats b ON b.species_id = s.id ORDER BY s.id"
        ).fetchall()
    datos = {
        f["id"]: {"name": f["name"], "types": f["types"], "bases": {e: f[e] for e in ESTADISTICAS}, "evolutions": []}
        for f in filas
    }
    for f in filas:
        if f["evolves_from"] in datos:
            datos[f["evolves_from"]]["evolutions"].append(
                {"to": f["id"], "level": f["evolution_level"], "auto": f["evolution_auto"]}
            )
    return datos


@app.post("/runs/{run_id}/captures/{capture_id}/evolve")
def evolucionar(run_id: int, capture_id: int, datos: Evolucion):
    """El registro pasa a ser de la nueva especie; no comprueba reglas de encuentro porque no es un encuentro. Solo
    admite evoluciones oficiales, directas o de más adelante en la cadena (subir varios niveles de golpe). Si el juego
    las cambia, la especie se corrige con «Corregir datos»."""
    with conectar() as conn:
        existe_run(conn, run_id)
        captura = leer_captura(conn, run_id, capture_id, bloquear=True)
        if conn.execute("SELECT 1 FROM encounters WHERE capture_id = %s", (capture_id,)).fetchone():
            raise HTTPException(status_code=409, detail="Un Pokémon debilitado no puede evolucionar")
        nueva = especie_oficial(conn, datos.species)
        if nueva.lower() == captura["species"].lower():
            raise HTTPException(status_code=409, detail=f"Ya es {nueva}")
        if not es_evolucion_de(conn, nueva, captura["species"]):
            raise HTTPException(status_code=422, detail=f"{nueva} no es una evolución de {captura['species']}")
        cambiar_especie(conn, capture_id, captura["species"], nueva)
    invalidar_equipo(run_id)
    return {"capture_id": capture_id, "species": nueva}


def cambiar_especie(conn, capture_id: int, anterior: str, nueva: str) -> None:
    """IV y EV no cambian: q solo varía en 2·(base nueva − base vieja). Las lecturas guardan ese desplazamiento."""
    conn.execute("UPDATE encounters SET species = %s WHERE id = %s", (nueva, capture_id))
    ficha = conn.execute(
        "SELECT readings, level, hp, attack, defense, sp_attack, sp_defense, speed "
        "FROM pokemon_ficha WHERE capture_id = %s FOR UPDATE",
        (capture_id,),
    ).fetchone()
    if ficha:
        antes, despues = bases_de_especie(conn, anterior), bases_de_especie(conn, nueva)
        lecturas = {}
        if antes and despues:  # una especie anterior a la lista no tiene bases: sus lecturas no se pueden convertir
            for e, lista in lecturas_completas(ficha).items():
                extra = 2 * (despues[e] - antes[e])
                lecturas[e] = [{**x, "shift": x.get("shift", 0) + extra} for x in lista]
        conn.execute("UPDATE pokemon_ficha SET readings = %s, updated_at = now() WHERE capture_id = %s",
                     (Jsonb(lecturas), capture_id))


# ---------- Ataques añadidos a mano: sus datos valen para toda la partida ----------
class AtaqueManual(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: TextoCorto
    type: str | None = Field(default=None, max_length=20)
    category: Literal["physical", "special", "status"] | None = None
    power: int | None = Field(default=None, ge=1, le=999)
    accuracy: int | None = Field(default=None, ge=1, le=100)
    pp: int | None = Field(default=None, ge=1, le=99)
    description: str | None = Field(default=None, max_length=500)


CONSULTA_ATAQUES_PARTIDA = (
    "SELECT m.name, t.identifier AS type, t.name AS type_name, m.category, m.power, m.accuracy, m.pp, m.description "
    "FROM run_moves m LEFT JOIN types t ON t.id = m.type_id WHERE m.run_id = %s "
)


@app.get("/runs/{run_id}/moves")
def ataques_de_partida(run_id: int):
    with conectar() as conn:
        existe_run(conn, run_id)
        return conn.execute(CONSULTA_ATAQUES_PARTIDA + "ORDER BY m.name", (run_id,)).fetchall()


@app.put("/runs/{run_id}/moves")
def guardar_ataque_de_partida(run_id: int, ataque: AtaqueManual):
    with conectar() as conn:
        existe_run(conn, run_id)
        if conn.execute("SELECT 1 FROM moves WHERE lower(name) = lower(%s)", (ataque.name,)).fetchone():
            raise HTTPException(status_code=409, detail=f"«{ataque.name}» ya está en la lista oficial")
        type_id = None
        if ataque.type:
            fila = conn.execute("SELECT id FROM types WHERE identifier = %s", (ataque.type,)).fetchone()
            if fila is None:
                raise HTTPException(status_code=422, detail=f"«{ataque.type}» no es un tipo")
            type_id = fila["id"]
        conn.execute(
            "INSERT INTO run_moves (run_id, name, type_id, category, power, accuracy, pp, description) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT (run_id, lower(name)) DO UPDATE SET "
            "name = EXCLUDED.name, type_id = EXCLUDED.type_id, category = EXCLUDED.category, power = EXCLUDED.power, "
            "accuracy = EXCLUDED.accuracy, pp = EXCLUDED.pp, description = EXCLUDED.description",
            (run_id, ataque.name, type_id, ataque.category, ataque.power, ataque.accuracy, ataque.pp, ataque.description or None),
        )
        return conn.execute(CONSULTA_ATAQUES_PARTIDA + "AND lower(m.name) = lower(%s)", (run_id, ataque.name)).fetchone()


def leer_party(conn, run_id: int):
    return conn.execute(
        "SELECT p.position, c.id AS capture_id, c.route, c.species, c.details->>'nickname' AS nickname, "
        + VIVO + " AS alive, "
        + COLUMNAS_ESPECIE + " "
        "FROM party p "
        "JOIN encounters c ON c.id = p.capture_id "
        "WHERE p.run_id = %s ORDER BY p.position",
        (run_id,),
    ).fetchall()


class EquipoNuevo(BaseModel):
    captures: list[int] = Field(max_length=6)


@app.get("/runs/{run_id}/party")
def equipo(run_id: int):
    with conectar() as conn:
        existe_run(conn, run_id)
        return leer_party(conn, run_id)


@app.put("/runs/{run_id}/party")
def cambiar_equipo(run_id: int, equipo: EquipoNuevo):
    if len(set(equipo.captures)) != len(equipo.captures):
        raise HTTPException(status_code=409, detail="Un Pokémon no puede estar dos veces en el equipo")

    with conectar() as conn:
        existe_run(conn, run_id)
        return fijar_equipo(conn, run_id, equipo.captures)


def fijar_equipo(conn, run_id: int, ids: list[int]):
    """Comprueba y sustituye el equipo entero (sin repetidos ya comprobados)."""
    capturas = {
        fila["id"]: fila
        for fila in conn.execute(
            "SELECT c.id, c.route, " + VIVO + " AS vivo "
            "FROM encounters c WHERE c.run_id = %s AND c.event_type = 'captura'",
            (run_id,),
        )
    }
    actuales = {fila["capture_id"] for fila in conn.execute("SELECT capture_id FROM party WHERE run_id = %s", (run_id,))}

    for capture_id in ids:
        if capture_id not in capturas:
            raise HTTPException(status_code=409, detail="Ese Pokémon no está en esta partida")
        if not capturas[capture_id]["vivo"] and capture_id not in actuales:
            raise HTTPException(status_code=409, detail=f"El Pokémon de «{capturas[capture_id]['route']}» está debilitado")

    conn.execute("DELETE FROM party WHERE run_id = %s", (run_id,))
    for posicion, capture_id in enumerate(ids, start=1):
        conn.execute(
            "INSERT INTO party (run_id, capture_id, position) VALUES (%s, %s, %s)",
            (run_id, capture_id, posicion),
        )
    return leer_party(conn, run_id)


@app.get("/runs/{run_id}/graveyard")
def cementerio(run_id: int):
    with conectar() as conn:
        existe_run(conn, run_id)
        return conn.execute(
            "SELECT c.id AS capture_id, c.route, c.species, c.details->>'nickname' AS nickname, "
            "m.created_at AS muerto_en, "
            + COLUMNAS_ESPECIE + " "
            "FROM encounters c "
            "JOIN encounters m ON m.capture_id = c.id "
            "WHERE c.run_id = %s AND c.event_type = 'captura' "
            "ORDER BY m.created_at",
            (run_id,),
        ).fetchall()


@app.get("/species")
def buscar_especies(
    response: Response,
    q: str = Query(min_length=1, max_length=50),
    limit: int = Query(10, ge=1, le=20),
):
    inicio = time.perf_counter()
    prefijo = q.strip().lower()
    if not prefijo:
        return []
    datos, estado, ttl = leer_especies(prefijo, limit)
    poner_cabeceras_cache(response, estado, ttl, inicio)
    return datos


# ---------- Lo que puede aprender cada especie (C2) ----------
ORDEN_METODO = "CASE sm.method WHEN 'level-up' THEN 0 WHEN 'machine' THEN 1 WHEN 'tutor' THEN 2 ELSE 3 END"


def leer_aprendizaje(species_id: int):
    def consultar():
        with conectar() as conn:
            if conn.execute("SELECT 1 FROM species WHERE id = %s", (species_id,)).fetchone() is None:
                return None
            habilidades = conn.execute(
                "SELECT a.name, sa.hidden FROM species_abilities sa JOIN abilities a ON a.id = sa.ability_id "
                "WHERE sa.species_id = %s ORDER BY sa.slot",
                (species_id,),
            ).fetchall()
            ataques = conn.execute(
                "SELECT m.name, sm.method, sm.level FROM species_moves sm JOIN moves m ON m.id = sm.move_id "
                f"WHERE sm.species_id = %s ORDER BY {ORDEN_METODO}, sm.level, m.name",
                (species_id,),
            ).fetchall()
        return {"abilities": habilidades, "moves": ataques}

    return leer_con_cache(f"learnset:{species_id}", CACHE_ESPECIES_TTL_S, consultar)


@app.get("/species/{species_id}/learnset")
def aprendizaje(species_id: int, response: Response):
    inicio = time.perf_counter()
    datos, estado, ttl = leer_aprendizaje(species_id)
    if datos is None:
        raise HTTPException(status_code=404, detail="Esa especie no existe")
    poner_cabeceras_cache(response, estado, ttl, inicio)
    return datos


# ---------- Catálogos de ataques y habilidades ----------
@app.get("/moves")
def catalogo_ataques(response: Response):
    def consultar():
        with conectar() as conn:
            return conn.execute(
                "SELECT m.name, t.identifier AS type, t.name AS type_name, m.category, m.power, m.accuracy, m.pp, "
                "m.description FROM moves m LEFT JOIN types t ON t.id = m.type_id ORDER BY m.name"
            ).fetchall()

    inicio = time.perf_counter()
    datos, estado, ttl = leer_con_cache("catalog:moves", CACHE_ESPECIES_TTL_S, consultar)
    poner_cabeceras_cache(response, estado, ttl, inicio)
    return datos


@app.get("/abilities")
def catalogo_habilidades(response: Response):
    def consultar():
        with conectar() as conn:
            return conn.execute("SELECT name, description FROM abilities ORDER BY name").fetchall()

    inicio = time.perf_counter()
    datos, estado, ttl = leer_con_cache("catalog:abilities", CACHE_ESPECIES_TTL_S, consultar)
    poner_cabeceras_cache(response, estado, ttl, inicio)
    return datos


# ---------- Tabla de tipos ----------
def leer_tabla_tipos():
    def consultar():
        with conectar() as conn:
            tipos = conn.execute("SELECT id, identifier, name FROM types ORDER BY id").fetchall()
            eficacias = conn.execute("SELECT attack_type_id, target_type_id, factor FROM type_efficacy").fetchall()
        identificador = {t["id"]: t["identifier"] for t in tipos}
        factores = {t["identifier"]: {} for t in tipos}
        for e in eficacias:
            factores[identificador[e["attack_type_id"]]][identificador[e["target_type_id"]]] = e["factor"] / 100
        return {"types": [{"identifier": t["identifier"], "name": t["name"]} for t in tipos], "factors": factores}

    return leer_con_cache("typechart", CACHE_ESPECIES_TTL_S, consultar)


@app.get("/types/chart")
def tabla_tipos(response: Response):
    inicio = time.perf_counter()
    datos, estado, ttl = leer_tabla_tipos()
    poner_cabeceras_cache(response, estado, ttl, inicio)
    return datos


@app.middleware("http")
async def no_cachear_interfaz(request, call_next):
    # El HTML, el JS y el CSS cambian con cada versión: el navegador debe comprobar siempre si hay uno nuevo
    # (si no ha cambiado, el servidor responde 304 y no se descarga de nuevo). Sin esto, el navegador podía
    # mezclar un index.html nuevo con un app.js antiguo guardado en caché y la página dejaba de funcionar.
    respuesta = await call_next(request)
    ruta = request.url.path
    if ruta == "/" or ruta.endswith((".html", ".js", ".css")):
        respuesta.headers["Cache-Control"] = "no-cache"
    respuesta.headers["X-Instancia"] = INSTANCIA
    return respuesta


# ---------- Importar el guardado del juego (Pokémon Essentials, como Añil) ----------
# Dos pasos: «preview» lee el archivo y propone cambios sin guardar nada; «apply» recibe solo los cambios que el
# usuario ha marcado y los aplica todos en una transacción. El archivo no se guarda: solo vive en memoria.

@lru_cache(maxsize=1)
def identificadores_juego() -> dict[str, dict[str, str]]:
    """Nombres internos del juego (CLEFAIRY, SLACKOFF...) -> id de especie o nombre en español."""
    tablas: dict[str, dict[str, str]] = {"species": {}, "move": {}, "ability": {}, "nature": {}, "item": {}}
    with GAME_IDS.open(encoding="utf-8", newline="") as fichero:
        for fila in csv.DictReader(fichero):
            tablas[fila["kind"]][fila["key"]] = fila["value"]
    return tablas


def sin_acentos(texto: str | None) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto or "") if unicodedata.category(c) != "Mn").casefold().strip()


async def leer_archivo_limitado(request: Request) -> bytes:
    """Lee el cuerpo sin pasar del límite: se corta mientras llega, sin cargar antes un archivo enorme."""
    demasiado = HTTPException(status_code=413, detail="El archivo es demasiado grande para ser un guardado")
    try:
        declarado = int(request.headers.get("content-length") or 0)
    except ValueError:
        declarado = 0
    if declarado > guardado_anil.LIMITE_BYTES:
        raise demasiado
    datos = bytearray()
    async for trozo in request.stream():
        datos += trozo
        if len(datos) > guardado_anil.LIMITE_BYTES:
            raise demasiado
    return bytes(datos)


@app.post("/runs/{run_id}/import/preview")
async def importar_vista_previa(run_id: int, request: Request):
    datos = await leer_archivo_limitado(request)
    # La lectura y la base de datos son síncronas: fuera del bucle de eventos, como el resto de rutas
    return await run_in_threadpool(propuesta_importacion, run_id, datos)


@app.put("/runs/{run_id}/maps")
async def subir_mapas(run_id: int, request: Request):
    datos = await leer_archivo_limitado(request)
    return await run_in_threadpool(guardar_mapas, run_id, datos)


def guardar_mapas(run_id: int, datos: bytes) -> dict:
    """Guarda en la partida los nombres de los mapas del juego: desde entonces, los nuevos llegan con su ruta."""
    try:
        mapas = guardado_anil.leer_mapas(datos)
    except guardado_anil.GuardadoInvalido as error:
        raise HTTPException(status_code=422, detail=str(error)) from None
    with conectar() as conn:
        existe_run(conn, run_id)
        conn.execute("UPDATE runs SET map_names = %s WHERE id = %s", (Jsonb({str(k): v for k, v in mapas.items()}), run_id))
    return {"maps": len(mapas)}


@app.delete("/runs/{run_id}/maps", status_code=204)
def quitar_mapas(run_id: int):
    with conectar() as conn:
        existe_run(conn, run_id)
        conn.execute("UPDATE runs SET map_names = NULL WHERE id = %s", (run_id,))


def propuesta_importacion(run_id: int, datos: bytes) -> dict:
    try:
        guardado = guardado_anil.leer(datos)
    except guardado_anil.GuardadoInvalido as error:
        raise HTTPException(status_code=422, detail=str(error)) from None
    ids = identificadores_juego()
    sin_traducir: set[str] = set()

    def traducir(tipo: str, clave: str | None) -> str | None:
        if clave is None:
            return None
        if clave not in ids[tipo]:
            sin_traducir.add(clave)
            return clave
        return ids[tipo][clave]

    with conectar() as conn:
        existe_run(conn, run_id)
        fila_run = conn.execute("SELECT rules, map_names FROM runs WHERE id = %s", (run_id,)).fetchone()
        reglas_run, nombres_mapas = fila_run["rules"], fila_run["map_names"] or {}
        nombres = {f["id"]: f["name"] for f in conn.execute("SELECT id, name FROM species")}
        padres = {f["species_id"]: f["evolves_from"]
                  for f in conn.execute("SELECT species_id, evolves_from FROM species_stats WHERE evolves_from IS NOT NULL")}
        capturas = conn.execute(
            "SELECT c.id AS capture_id, c.route, c.species, c.details->>'nickname' AS nickname, "
            "c.details->>'game_id' AS game_id, " + VIVO + " AS alive, "
            "(SELECT s.id FROM species s WHERE lower(s.name) = lower(c.species)) AS species_id "
            "FROM encounters c WHERE c.run_id = %s AND c.event_type = 'captura' ORDER BY c.id",
            (run_id,),
        ).fetchall()
        for c in capturas:
            ficha = leer_ficha(conn, c["capture_id"])
            c["sheet"] = {k: v for k, v in ficha.items() if k not in ("readings", "forgotten")}
        equipo_actual = [f["capture_id"] for f in conn.execute(
            "SELECT capture_id FROM party WHERE run_id = %s ORDER BY position", (run_id,))]

    def familia(especie: int | None) -> int | None:
        vistos = set()
        while especie in padres and especie not in vistos:
            vistos.add(especie)
            especie = padres[especie]
        return especie

    pokemon = []
    for p in guardado["pokemon"]:
        clave_especie = ids["species"].get(p["species"])
        especie_id = int(clave_especie) if clave_especie else None
        if especie_id is None:
            sin_traducir.add(p["species"])
        pokemon.append({
            **{k: p[k] for k in ("game_id", "place", "nickname", "level", "stats", "fainted", "shiny", "map", "iv", "ev")},
            "species_id": especie_id,
            "species": nombres.get(especie_id, p["species"]),
            "nature": traducir("nature", p["nature"]),
            "ability": traducir("ability", p["ability"]),
            "item": traducir("item", p["item"]),
            "moves": [traducir("move", a) for a in p["moves"]],
            "match": None,
        })

    # Emparejar: por el identificador del juego (importaciones anteriores), por mote y, si solo hay uno, por familia
    libres = {c["capture_id"]: c for c in capturas}

    def emparejar(p: dict, c: dict, por: str) -> None:
        p["match"] = {"capture_id": c["capture_id"], "by": por}
        del libres[c["capture_id"]]

    for p in pokemon:
        c = next((c for c in libres.values() if p["game_id"] is not None and c["game_id"] == str(p["game_id"])), None)
        if c:
            emparejar(p, c, "id")
    for p in pokemon:
        if not p["match"] and p["nickname"]:
            c = next((c for c in libres.values() if c["nickname"] and sin_acentos(c["nickname"]) == sin_acentos(p["nickname"])), None)
            if c:
                emparejar(p, c, "nickname")
    for p in pokemon:
        if not p["match"] and p["species_id"]:
            iguales = [c for c in libres.values() if familia(c["species_id"]) == familia(p["species_id"])]
            if len(iguales) == 1:
                emparejar(p, iguales[0], "species")

    # El juego guarda un número de mapa. Su nombre sale primero de los ya emparejados (como lo escribió el usuario)
    # y, si no, de los nombres de los mapas del juego subidos a la partida (MapInfos.rxdata)
    por_id = {c["capture_id"]: c for c in capturas}
    rutas = {p["map"]: por_id[p["match"]["capture_id"]]["route"] for p in pokemon if p["match"] and p["map"] is not None}
    for p in pokemon:
        p["suggested_route"] = None if p["match"] else rutas.get(p["map"]) or nombres_mapas.get(str(p["map"]))

    return {
        "pokemon": pokemon,
        "tracker": capturas,
        "missing": [c["capture_id"] for c in libres.values()],
        "party": {"current": equipo_actual, "game": [p["game_id"] for p in pokemon if p["place"] == "party"]},
        "bag": [{"item": traducir("item", o["item"]), "count": o["count"]} for o in guardado["bag"]],
        "untranslated": sorted(sin_traducir),
        "discarded": guardado["discarded"],
        "death_rule": "muerte_definitiva" in reglas_run,
    }


class EstadisticasImportadas(BaseModel):
    hp: int = Field(ge=1, le=999)
    attack: int = Field(ge=1, le=999)
    defense: int = Field(ge=1, le=999)
    sp_attack: int = Field(ge=1, le=999)
    sp_defense: int = Field(ge=1, le=999)
    speed: int = Field(ge=1, le=999)


class DatosImportados(BaseModel):
    """Lo que se cambia de un Pokémon. Un campo que no se envía no se toca; `item: null` quita el objeto."""
    model_config = ConfigDict(str_strip_whitespace=True)

    game_id: int | None = Field(default=None, ge=0, le=2**32 - 1)
    species: str | None = Field(default=None, min_length=1, max_length=100)
    nickname: str | None = Field(default=None, max_length=20)
    level: int | None = Field(default=None, ge=1, le=100)
    nature: str | None = Field(default=None, max_length=30)
    ability: str | None = Field(default=None, max_length=50)
    item: str | None = Field(default=None, max_length=50)
    moves: list[TextoCorto] | None = Field(default=None, max_length=4)
    stats: EstadisticasImportadas | None = None
    # En el orden de ESTADISTICAS; se guardan con el nivel para estimar después sin volver a importar
    iv: list[Annotated[int, Field(ge=0, le=31)]] | None = Field(default=None, min_length=6, max_length=6)
    ev: list[Annotated[int, Field(ge=0, le=255)]] | None = Field(default=None, min_length=6, max_length=6)


class CambioImportado(DatosImportados):
    capture_id: int
    dead: bool = False


class NuevoImportado(DatosImportados):
    species: str = Field(min_length=1, max_length=100)
    route: str = Field(min_length=1, max_length=100)
    shiny: bool = False


class Importacion(BaseModel):
    updates: list[CambioImportado] = Field(default_factory=list, max_length=2000)
    new: list[NuevoImportado] = Field(default_factory=list, max_length=2000)
    party: list[int] | None = Field(default=None, max_length=6)  # identificadores del juego, en orden


def importar_ficha(conn, capture_id: int, datos: DatosImportados) -> None:
    """Mezcla lo importado con la ficha actual. Las estadísticas del juego quedan como lecturas reales."""
    marcados = datos.model_fields_set
    actual = leer_ficha(conn, capture_id)
    campos = {k: actual[k] for k in ("level", "nature", "ability", "item", "moves", *ESTADISTICAS)}
    for k in ("level", "nature", "ability", "item", "moves"):
        if k in marcados:
            campos[k] = getattr(datos, k)
    estimadas: list[str] = []
    if datos.stats is not None:
        campos.update(datos.stats.model_dump())
    elif campos["level"] != actual["level"]:
        estimadas = list(ESTADISTICAS)  # sin estadísticas nuevas, las de antes no son lecturas de este nivel
    guardar_ficha_en(conn, capture_id, FichaNueva(**{k: v for k, v in campos.items() if v is not None or k == "item"},
                                                  estimated=estimadas))
    if datos.iv is not None and datos.ev is not None and campos["level"] is not None:
        iv_ev = {"level": campos["level"], "iv": dict(zip(ESTADISTICAS, datos.iv)), "ev": dict(zip(ESTADISTICAS, datos.ev))}
        conn.execute("UPDATE pokemon_ficha SET iv_ev = %s WHERE capture_id = %s", (Jsonb(iv_ev), capture_id))


def anadir_detalles(conn, capture_id: int, detalles: dict) -> None:
    if detalles:
        conn.execute("UPDATE encounters SET details = COALESCE(details, '{}') || %s WHERE id = %s",
                     (Jsonb(detalles), capture_id))


@app.post("/runs/{run_id}/import/apply")
def importar_aplicar(run_id: int, importacion: Importacion):
    """Todo o nada: si un cambio no es válido, no se aplica ninguno y el error dice de qué Pokémon es."""
    with conectar() as conn:
        reglas_run = reglas_bloqueando(conn, run_id)
        for u in importacion.updates:
            quien = u.nickname or f"el Pokémon {u.capture_id}"
            try:
                captura = leer_captura(conn, run_id, u.capture_id, bloquear=True)
                if u.species:
                    nueva = especie_oficial(conn, u.species)
                    if nueva.lower() != captura["species"].lower():
                        # El juego manda: también vale una evolución no oficial (Randomlocke)
                        cambiar_especie(conn, u.capture_id, captura["species"], nueva)
                        conn.execute("UPDATE encounters SET species = %s WHERE capture_id = %s", (nueva, u.capture_id))
                detalles: dict = {}
                if u.game_id is not None:
                    detalles["game_id"] = str(u.game_id)
                if u.nickname:
                    detalles["nickname"] = u.nickname
                anadir_detalles(conn, u.capture_id, detalles)
                if u.model_fields_set & {"level", "nature", "ability", "item", "moves", "stats", "iv", "ev"}:
                    importar_ficha(conn, u.capture_id, u)
                if u.dead and not conn.execute("SELECT 1 FROM encounters WHERE capture_id = %s", (u.capture_id,)).fetchone():
                    marcar_muerte(conn, run_id, captura)
            except HTTPException as error:
                raise HTTPException(status_code=error.status_code, detail=f"{quien}: {error.detail}") from None

        for n in importacion.new:
            quien = n.nickname or n.species
            try:
                especie = especie_oficial(conn, n.species)
                # Las reglas de la partida no se aplican a lo que viene del guardado: si en el juego hay un Pokémon
                # sin mote o dos de la misma zona, por algo será (regalos, huevos, intercambios…)
                detalles = {"nickname": n.nickname} if n.nickname else {}
                if n.shiny:
                    detalles["shiny"] = True
                if n.game_id is not None:
                    detalles["game_id"] = str(n.game_id)
                fila = conn.execute(
                    "INSERT INTO encounters (run_id, event_type, route, species, details) "
                    "VALUES (%s, 'captura', %s, %s, %s) RETURNING id",
                    (run_id, n.route, especie, Jsonb(detalles) if detalles else None),
                ).fetchone()
                importar_ficha(conn, fila["id"], n)
            except HTTPException as error:
                raise HTTPException(status_code=error.status_code, detail=f"{quien}: {error.detail}") from None

        if importacion.party is not None:
            if len(set(importacion.party)) != len(importacion.party):
                raise HTTPException(status_code=409, detail="Un Pokémon no puede estar dos veces en el equipo")
            por_juego = {f["game_id"]: f["id"] for f in conn.execute(
                "SELECT id, details->>'game_id' AS game_id FROM encounters "
                "WHERE run_id = %s AND event_type = 'captura' AND details ? 'game_id'", (run_id,))}
            faltan = [g for g in importacion.party if str(g) not in por_juego]
            if faltan:
                raise HTTPException(status_code=409, detail="El equipo incluye un Pokémon que no se va a importar")
            fijar_equipo(conn, run_id, [por_juego[str(g)] for g in importacion.party])
    invalidar_equipo(run_id)
    return {"updated": len(importacion.updates), "created": len(importacion.new),
            "party": importacion.party is not None}


app.mount("/", StaticFiles(directory=Path(__file__).with_name("static"), html=True), name="static")

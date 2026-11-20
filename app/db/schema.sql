CREATE TABLE IF NOT EXISTS runs (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ideas 2 + 6: modo de juego y reglas de cada partida (ver app/reglas.py). Se añaden con ALTER porque la
-- tabla ya existe; el DEFAULT rellena las partidas que ya había: «normal» (sin reglas), que se comporta
-- igual que antes. «personalizada» sigue permitida en la base de datos, pero está aplazada (28 oct.).
ALTER TABLE runs ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'normal'
    CHECK (mode IN ('normal', 'nuzlocke', 'randomlocke', 'personalizada'));
ALTER TABLE runs ALTER COLUMN mode SET DEFAULT 'normal';
ALTER TABLE runs ADD COLUMN IF NOT EXISTS rules JSONB NOT NULL DEFAULT '{}'
    CHECK (jsonb_typeof(rules) = 'object');

-- Nombres de los mapas del juego (de Data/MapInfos.rxdata), para poner la ruta al importar el guardado:
-- {"29": "Laboratorio", ...}. NULL mientras no se suba.
ALTER TABLE runs ADD COLUMN IF NOT EXISTS map_names JSONB;

CREATE TABLE IF NOT EXISTS encounters (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id      BIGINT NOT NULL REFERENCES runs (id),
    event_type  TEXT NOT NULL CHECK (event_type IN ('captura', 'fallo', 'muerte')),
    route       TEXT NOT NULL,
    species     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    details     JSONB,
    -- Identidad del Pokémon: el id de su captura. Una muerte apunta a la captura que murió.
    capture_id  BIGINT REFERENCES encounters (id),
    CONSTRAINT encounters_muerte_tiene_captura CHECK ((event_type = 'muerte') = (capture_id IS NOT NULL))
);

-- Migración de una base anterior (se puede ejecutar siempre: solo actúa si falta la columna).
-- Toda la inicialización va en una transacción: si una muerte no tuviera captura, el CHECK falla y no cambia nada.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = current_schema() AND table_name = 'encounters' AND column_name = 'capture_id') THEN
        ALTER TABLE encounters ADD COLUMN capture_id BIGINT REFERENCES encounters (id);
        UPDATE encounters m SET capture_id = c.id
            FROM encounters c
            WHERE m.event_type = 'muerte' AND c.event_type = 'captura'
              AND c.run_id = m.run_id AND c.route = m.route;
        ALTER TABLE encounters ADD CONSTRAINT encounters_muerte_tiene_captura
            CHECK ((event_type = 'muerte') = (capture_id IS NOT NULL));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_encounters_run_id ON encounters (run_id);
CREATE INDEX IF NOT EXISTS idx_encounters_capture_id ON encounters (capture_id);

-- «Un encuentro por zona» ya no es una regla de todas las partidas: depende de runs.rules y la comprueba la API
DROP INDEX IF EXISTS uq_encounters_primer_encuentro;

CREATE TABLE IF NOT EXISTS species (
    id    INTEGER PRIMARY KEY,
    name  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_species_nombre
    ON species (lower(name) text_pattern_ops);

-- Estadísticas base oficiales y especie de la que evoluciona: para estimar y sugerir al evolucionar
CREATE TABLE IF NOT EXISTS species_stats (
    species_id    INTEGER  PRIMARY KEY REFERENCES species (id),
    hp            SMALLINT NOT NULL,
    attack        SMALLINT NOT NULL,
    defense       SMALLINT NOT NULL,
    sp_attack     SMALLINT NOT NULL,
    sp_defense    SMALLINT NOT NULL,
    speed         SMALLINT NOT NULL,
    evolves_from  INTEGER  REFERENCES species (id)
);
-- Nivel al que evoluciona; evolution_auto: basta con ese nivel, sin otras condiciones (sexo, hora, azar...)
ALTER TABLE species_stats ADD COLUMN IF NOT EXISTS evolution_level SMALLINT;
ALTER TABLE species_stats ADD COLUMN IF NOT EXISTS evolution_auto BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS party (
    run_id      BIGINT   NOT NULL REFERENCES runs (id),
    capture_id  BIGINT   PRIMARY KEY REFERENCES encounters (id),
    position    SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 6),
    UNIQUE (run_id, position)
);

-- Migración: de partida + ruta al id de la captura (SET NOT NULL falla si una fila no encuentra su captura)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = current_schema() AND table_name = 'party' AND column_name = 'route') THEN
        ALTER TABLE party ADD COLUMN capture_id BIGINT REFERENCES encounters (id);
        UPDATE party p SET capture_id = c.id
            FROM encounters c
            WHERE c.event_type = 'captura' AND c.run_id = p.run_id AND c.route = p.route;
        ALTER TABLE party ALTER COLUMN capture_id SET NOT NULL;
        ALTER TABLE party DROP CONSTRAINT party_pkey;
        ALTER TABLE party ADD PRIMARY KEY (capture_id);
        ALTER TABLE party DROP COLUMN route;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS types (
    id          SMALLINT PRIMARY KEY,
    identifier  TEXT NOT NULL,
    name        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS species_types (
    species_id  INTEGER  NOT NULL REFERENCES species (id),
    type_id     SMALLINT NOT NULL REFERENCES types (id),
    slot        SMALLINT NOT NULL CHECK (slot IN (1, 2)),
    PRIMARY KEY (species_id, slot)
);

-- Tabla de tipos: lo que hace cada tipo de ataque a cada tipo de defensor, en % (0, 50, 100 o 200)
CREATE TABLE IF NOT EXISTS type_efficacy (
    attack_type_id  SMALLINT NOT NULL REFERENCES types (id),
    target_type_id  SMALLINT NOT NULL REFERENCES types (id),
    factor          SMALLINT NOT NULL CHECK (factor IN (0, 50, 100, 200)),
    PRIMARY KEY (attack_type_id, target_type_id)
);

CREATE TABLE IF NOT EXISTS natures (
    id         SMALLINT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    increased  TEXT,
    decreased  TEXT
);

-- Ficha editable de cada Pokémon capturado (una fila por partida y ruta). Es un dato que cambia,
-- no un hecho histórico: se modifica con upsert en lugar de añadirse al registro de eventos.
CREATE TABLE IF NOT EXISTS pokemon_ficha (
    capture_id  BIGINT   PRIMARY KEY REFERENCES encounters (id),
    level       SMALLINT CHECK (level BETWEEN 1 AND 100),
    nature_id   SMALLINT REFERENCES natures (id),
    ability     TEXT,
    item        TEXT,
    moves       TEXT[]   NOT NULL DEFAULT '{}' CHECK (cardinality(moves) <= 4),
    hp          SMALLINT CHECK (hp BETWEEN 1 AND 999),
    attack      SMALLINT CHECK (attack BETWEEN 1 AND 999),
    defense     SMALLINT CHECK (defense BETWEEN 1 AND 999),
    sp_attack   SMALLINT CHECK (sp_attack BETWEEN 1 AND 999),
    sp_defense  SMALLINT CHECK (sp_defense BETWEEN 1 AND 999),
    speed       SMALLINT CHECK (speed BETWEEN 1 AND 999),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    forgotten   TEXT[]   NOT NULL DEFAULT '{}'
);

-- C2: ataques olvidados (los que salen de los 4 huecos al guardar). CREATE TABLE IF NOT EXISTS no
-- cambia una tabla que ya existe, así que la columna nueva se añade aparte (también es idempotente).
ALTER TABLE pokemon_ficha ADD COLUMN IF NOT EXISTS forgotten TEXT[] NOT NULL DEFAULT '{}';
-- Lecturas reales de cada estadística, {"hp": [{"level": 5, "value": 20}, ...], ...}: las estimaciones parten de ellas.
ALTER TABLE pokemon_ficha ADD COLUMN IF NOT EXISTS readings JSONB NOT NULL DEFAULT '{}';
-- IV y EV leídos del guardado del juego, con el nivel al que se leyeron:
-- {"level": 12, "iv": {"hp": 15, ...}, "ev": {"hp": 4, ...}}. NULL si nunca se ha importado.
ALTER TABLE pokemon_ficha ADD COLUMN IF NOT EXISTS iv_ev JSONB;

-- Migración: de partida + ruta al id de la captura (run_id ya sale de la captura, así que sobra)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = current_schema() AND table_name = 'pokemon_ficha' AND column_name = 'route') THEN
        ALTER TABLE pokemon_ficha ADD COLUMN capture_id BIGINT REFERENCES encounters (id);
        UPDATE pokemon_ficha f SET capture_id = c.id
            FROM encounters c
            WHERE c.event_type = 'captura' AND c.run_id = f.run_id AND c.route = f.route;
        ALTER TABLE pokemon_ficha ALTER COLUMN capture_id SET NOT NULL;
        ALTER TABLE pokemon_ficha DROP CONSTRAINT pokemon_ficha_pkey;
        ALTER TABLE pokemon_ficha ADD PRIMARY KEY (capture_id);
        ALTER TABLE pokemon_ficha DROP COLUMN route;
        ALTER TABLE pokemon_ficha DROP COLUMN run_id;
    END IF;
END $$;

-- C2: lo que puede aprender cada especie (datos de PokéAPI, juego principal más reciente de cada una)
CREATE TABLE IF NOT EXISTS moves (
    id           SMALLINT PRIMARY KEY,
    name         TEXT NOT NULL,
    type_id      SMALLINT REFERENCES types (id),
    category     TEXT,
    power        SMALLINT,
    accuracy     SMALLINT,
    pp           SMALLINT,
    description  TEXT
);

-- Bases anteriores: los datos de cada ataque y la descripción de cada habilidad se añaden aparte
ALTER TABLE moves ADD COLUMN IF NOT EXISTS type_id SMALLINT REFERENCES types (id);
ALTER TABLE moves ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS power SMALLINT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS accuracy SMALLINT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS pp SMALLINT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS species_moves (
    species_id  INTEGER  NOT NULL REFERENCES species (id),
    move_id     SMALLINT NOT NULL REFERENCES moves (id),
    method      TEXT     NOT NULL CHECK (method IN ('level-up', 'machine', 'tutor', 'egg')),
    level       SMALLINT,
    PRIMARY KEY (species_id, move_id)
);

CREATE TABLE IF NOT EXISTS abilities (
    id           SMALLINT PRIMARY KEY,
    name         TEXT NOT NULL,
    description  TEXT
);

ALTER TABLE abilities ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS species_abilities (
    species_id  INTEGER  NOT NULL REFERENCES species (id),
    ability_id  SMALLINT NOT NULL REFERENCES abilities (id),
    slot        SMALLINT NOT NULL CHECK (slot IN (1, 2, 3)),
    hidden      BOOLEAN  NOT NULL,
    PRIMARY KEY (species_id, slot)
);

-- Ataques añadidos a mano (no están en el catálogo oficial), con sus datos para toda la partida.
-- Las fichas siguen guardando solo el nombre, igual que con los oficiales.
CREATE TABLE IF NOT EXISTS run_moves (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id       BIGINT NOT NULL REFERENCES runs (id),
    name         TEXT NOT NULL,
    type_id      SMALLINT REFERENCES types (id),
    category     TEXT CHECK (category IN ('physical', 'special', 'status')),
    power        SMALLINT CHECK (power BETWEEN 1 AND 999),
    accuracy     SMALLINT CHECK (accuracy BETWEEN 1 AND 100),
    pp           SMALLINT CHECK (pp BETWEEN 1 AND 99),
    description  TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_run_moves_nombre ON run_moves (run_id, lower(name));

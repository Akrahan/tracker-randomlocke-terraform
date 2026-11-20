# Hoja de ruta: Práctica 2 (Terraform)

Un paso por turno: Claude explica, yo escribo, Claude revisa y yo hago el commit (el historial debe mostrar el progreso). Entrega: domingo 29 nov. 2026.

## Decisiones ya tomadas (17 nov.)

- **Proyecto nuevo:** carpeta y repositorio público nuevos, solo con lo necesario y lo que se desarrolle. La Práctica 1 no se toca. Confirmado el 18 nov. frente a un monorepo (la P2 como carpeta dentro del repositorio de la P1): el enunciado pide que el README sea la portada y que los commits muestren el progreso de esta práctica; además, el repositorio entregado de la P1 quedaría alterado.
- **Aplicación de partida:** la de la rama `extras` del repositorio de la Práctica 1, con todos sus cambios subidos.
- **Modo de trabajo:** como en la Práctica 1 (tutor). Ver `CLAUDE.md`.
- **README:** solo de infraestructura.
- **Prod de la Práctica 1:** no se actualiza; aquí dev y prod se construyen con la misma imagen del código actual.
- **Dónde se ejecuta Terraform:** en WSL (Ubuntu), donde ya está instalado (v1.17.2, con `apt`), igual que `make`. Habla con Docker Desktop por `/var/run/docker.sock`. El proyecto sigue en la carpeta de Windows (`/mnt/c/...` desde Ubuntu).
- **Balanceador (aclaración del profesor, 17 nov.):** debe ser un **contenedor propio** (Nginx, HAProxy o Traefik) delante de las webs, **no** Docker Swarm ni su balanceo interno (*routing mesh*).

- **Exposición mínima (17 nov.):** solo se publica hacia fuera lo imprescindible, para reducir la superficie de ataque y, en una nube real, el coste del tráfico. El balanceador Nginx es la única puerta de entrada a la aplicación. **MinIO no se expone**: los estáticos se sirven a través de Nginx (una ruta que reenvía a MinIO solo para lectura). PostgreSQL, Redis, las webs y Prometheus quedan solo en la red interna. Las consolas de administración (MinIO, Grafana) se publican, si hace falta para la demo, solo en `127.0.0.1`, nunca en todas las interfaces.

- **Alertas por Telegram (17 nov.):** en prod, las alertas no solo se ven en Grafana; también se **envían** a un chat de Telegram mediante un bot. El token del bot y el ID del chat son secretos: variables `sensitive` con el valor en `TF_VAR_...` o en un `.tfvars` excluido de Git, nunca en el repositorio. Solo requiere tráfico **saliente** a internet (no se abre ningún puerto). Plan B para la demo si no hay internet en el aula: enseñar la alerta en estado «Firing» en Grafana.

## Hábitos de trabajo (por el audio del profesor, 17 nov.)

- **Predecir el plan:** antes de cada `terraform plan`, digo qué espero que salga (qué se crea, se cambia o se destruye y por qué) y después lo comparo. En la defensa pedirá un cambio y habrá que predecirlo antes de ejecutarlo.
- **Commits pequeños:** varios commits por paso cuando tenga sentido (uno por recurso o cambio coherente), no uno enorme al final.

## Qué cambia respecto a la Práctica 1

| Práctica 1 | Práctica 2 |
|---|---|
| `docker-compose.dev.yml` y `docker-compose.prod.yml` | Archivos `.tf` en módulos y un `terraform.tfvars` por entorno |
| 1 web por entorno | Balanceador: 2 webs en dev, 3 o más en prod |
| Redis solo en prod | Igual: caché en prod |
| Sin monitorización | Estado, CPU y memoria de los contenedores; logs centralizados; alertas en prod |
| Estáticos dentro de la imagen o en un volumen | Estáticos (sprites) en MinIO |
| `make up-dev` lanza Compose | `make` lanza `terraform init`, `plan`, `apply` y `destroy` por entorno |

**Cambios en la aplicación (pocos):** mostrar en qué instancia has caído; preparar la base de datos una sola vez (no cada web al arrancar); sprites desde MinIO; logs por la salida estándar.

## Mejoras opcionales pendientes

- **`.gitignore` más robusto para los `.env`:** sustituir la lista por nombre (`.env.dev`, `.env.prod`) por `.env.*` + `!.env.*.example`. Aplicar si aparecen más entornos o al revisar la seguridad en la fase 6 o 7. Ver «.gitignore» en `conceptos-para-estudiar.md`.

## Mejoras detectadas en la Práctica 1 (las pide el enunciado)

Salen de las limitaciones de la guía de defensa de la Práctica 1 (las de la retrospectiva son personales: entender puertos y redes, defender con seguridad y depender menos de la IA, y se trabajan con el modo tutor y los hábitos de abajo). Se citarán en el README y en la defensa.

| Limitación en la Práctica 1 | Mejora en la Práctica 2 | Paso |
|---|---|---|
| Cada web preparaba la base de datos al arrancar | Se prepara una sola vez; con varias réplicas es obligatorio para que no compitan | 1.4 |
| Una sola web: si caía, la app caía | Varias réplicas detrás de Nginx, con reparto y conmutación si una falla | 3.1-3.3 |
| La primera lectura tras caer Redis tardaba ~8 s (resolución DNS de Docker Desktop) | Volver a medirlo y, si sigue, reducir el tiempo de espera de conexión a Redis | 3.4 / 6.2 |
| La verificación en limpio usó capas de imagen en caché | Prueba desde cero con construcción sin caché | 7.2 |
| Sin visibilidad del sistema | Métricas, logs centralizados y alertas | 5.1-5.3 |
| Estáticos dentro de la imagen o en un volumen | Almacenamiento tipo S3 (MinIO) detrás de Nginx | 4.1-4.2 |

## Estructura prevista

```
Tracker_Randomlocke_P2/
├── app/                  ← la web (de extras) y su Dockerfile
├── terraform/
│   ├── modules/          ← red, base de datos, web, caché, balanceador, monitorización, MinIO
│   └── envs/
│       ├── dev/          ← main.tf, variables.tf, outputs.tf, terraform.tfvars (2 webs)
│       └── prod/         ← igual (3 webs, caché, alertas)
├── monitoring/           ← configuración de Prometheus, Grafana, logs y alertas
├── tests/
├── docs/
├── Makefile
└── README.md
```

## Pasos

### Fase 0 · Preparación (17 y 18 nov.)
- **0.1** Subir los cambios pendientes de `extras` (repositorio de la Práctica 1), para partir de un código cerrado.
- **0.2** Instalar Terraform y comprobar que habla con Docker Desktop.
- **0.3** Preparar el repositorio. La aplicación ya está copiada (17 nov.): `app/` (sin `__pycache__`), `tests/`, `scripts/descargar_sprites.py`, `.env.*.example`, `.gitattributes`, `.editorconfig` y un `.gitignore` mínimo; el material de consulta está en `docs/referencia/` (local, no se publica). Falta: revisar lo copiado, completar el `.gitignore` para Terraform (estado, `.terraform/`, secretos), `git init`, crear el repositorio público y primer commit.
- **0.4** Documentos base: diario y conceptos al día. Sin README hasta el 7.1 (decidido el 18 nov.: se escribe al final, cuando la arquitectura, los comandos y las salidas de los tests sean definitivos). Mientras tanto, cada fase deja anotadas en el diario las pruebas y sus salidas, para reutilizarlas en el README.

### Fase 1 · Terraform mínimo en dev (18 y 19 nov.)
- **1.1** Estructura de carpetas, provider de Docker y `terraform init`. Qué es el estado.
- **1.2** Red y volumen de la base de datos. Decidido: todos los recursos se nombran `tracker-<entorno>-...` (variable `entorno` validada a `dev`/`prod` y `local.prefijo`) para no chocar con los de la P1 (`randomlocke-*`) ni entre entornos. Dos redes, como en el prod de la P1: `frontend` y `backend` con `internal = true` (sin salida a internet; solo la base de datos, la caché y las webs). El sitio de MinIO en las redes se decide en la fase 4.
- **1.3** Contenedor de PostgreSQL con healthcheck. Credenciales como variables sensibles, nunca en el código.
- **1.4** Imagen y contenedor de la web, y preparar la base de datos una sola vez (primer cambio en la aplicación).
- **Puerta:** dev funciona con una web, levantado con `terraform apply`.

### Fase 2 · Módulos y entornos (20 y 21 nov.)
- **2.1** Pasar lo anterior a módulos reutilizables: red, base de datos y web (la caché, en el 2.3).
  - **2.1.1** Qué es un módulo y su estructura (`terraform/modules/<nombre>/` con `main.tf`, `variables.tf`, `outputs.tf` y `versions.tf`). Entradas (variables), salidas (outputs) y cómo se llama a un módulo.
  - **2.1.2** Módulo `red`: las dos redes; como salidas, sus nombres.
  - **2.1.3** Módulo `base_datos`: volumen, imagen y contenedor de PostgreSQL; como salida, el nombre del host.
  - **2.1.4** Módulo `web`: imagen, `preparar_db` y contenedor de la web. Se diseña pensando en que en la fase 3 tendrá varias réplicas.
  - **2.1.5** `envs/dev` pasa a usar los tres módulos, con bloques `moved` para que Terraform **mueva** los recursos en el estado en lugar de destruirlos y crearlos. Predicción: el `plan` no debe añadir ni destruir nada, solo mover.
  - **2.1.6** Comprobar: `plan` sin cambios reales, la web funciona y los tests pasan.
- **2.2** `envs/dev` y `envs/prod` con su `terraform.tfvars`. Los dos a la vez, con nombres, redes y puertos separados.
  - **2.2.1** Lo que cambia entre entornos se convierte en variables: `docs_activadas` (`ENABLE_DOCS`, encendida en dev y apagada en prod). Se aplica primero en dev (debe dar «No changes» en lo demás).
  - **2.2.2** Crear `envs/prod` (mismos ficheros que dev, `terraform.tfvars` con `entorno = "prod"`, puerto 8200 y docs apagadas) y su propio `secrets.auto.tfvars` con **otras** credenciales.
  - **2.2.3** `init` y `apply` de prod; comprobar que los dos entornos conviven: nombres, redes, puertos y estados separados; `destroy` de uno sin tocar el otro.
- **2.3** Caché en prod: módulo de Redis activado solo en prod (variable del entorno, por ejemplo `cache_enabled = true`), con contraseña como variable `sensitive`, sin puertos publicados, y las variables que ya lee la app (`CACHE_ENABLED`, `CACHE_HOST`, `REDIS_PASSWORD`). Prueba: cabecera `X-Cache` `MISS` → `HIT`.
  - **2.3.1** Módulo `cache`: contenedor de Redis con contraseña (`sensitive`), sin persistencia, solo en `backend`, con healthcheck.
  - **2.3.2** Activarlo solo en prod con `count` y una variable `cache_activada`; pasar a la web `CACHE_ENABLED`, `CACHE_HOST` y `REDIS_PASSWORD`.
  - **2.3.3** Comprobar: en prod, `X-Cache` `MISS` → `HIT` y «Caché: conectada»; en dev, el `plan` no cambia nada y sigue «no aplica».
- **2.4** Makefile: `init`, `plan`, `apply` y `destroy` por entorno.
  - **2.4.1** Objetivos con `ENV=dev|prod` usando `terraform -chdir=terraform/envs/$(ENV)`: `init`, `fmt`, `validate`, `plan`, `apply`, `destroy`, y `test` (los tests de la API en un contenedor de un solo uso).
  - **2.4.2** Comprobar todo desde la raíz y cerrar la fase con su resumen.

### Fase 3 · Balanceador (22 y 23 nov.)
- **3.0** Ordenar `app/` antes de tocarla: los CSV en `app/datos/` y `schema.sql` en `app/db/` (añadido el 20 nov.).
- **3.1** Varias webs (2 en dev, 3 en prod) y mostrar en la web en qué instancia has caído (segundo cambio en la aplicación).
  - **3.1.1** La app dice qué instancia responde: variable `INSTANCIA` (la pone Terraform), campo en `/status`, cabecera `X-Instancia` y etiqueta en la página.
  - **3.1.2** `count` en el módulo `web` con `replicas_web` (2 en dev y 3 en prod) y un puerto temporal por réplica.
  - **3.1.3** Comprobar cada réplica por su puerto y pasar los tests.
- **3.2** Elegir balanceador (Nginx, HAProxy o Traefik) y su política (round-robin, menos conexiones...), con los argumentos para la defensa.
  - **3.2.1** Decisión: balanceador y política, con alternativas y argumentos.
  - **3.2.2** Módulo `balanceador`: Nginx con su configuración generada por `templatefile` a partir de los nombres de las réplicas.
  - **3.2.3** Las webs dejan de publicar puertos y solo publica Nginx; ajustar la salida y `make test`.
  - **3.2.4** Comprobar el reparto: `X-Instancia` va rotando.
- **3.3** Alta disponibilidad: el balanceador deja de mandar tráfico a una web caída y los contenedores se reinician solos. Prueba: tumbar una instancia.
  - **3.3.1** Nginx: `max_fails`, `fail_timeout` y `proxy_next_upstream`; política de reinicio de los contenedores.
  - **3.3.2** Objetivos `logs`, `stop-web` y `start-web` en el Makefile, y prueba de tumbar una web.
- **3.4** Caché compartida entre réplicas (prod): una petición cae en una web y da `MISS`, la siguiente cae en otra y da `HIT`, porque todas usan el mismo Redis. Al modificar el equipo, la invalidación (`cache.delete`) vale para todas las réplicas. Prueba también de Redis caído: la web sigue sirviendo desde PostgreSQL (y se vuelve a medir el retraso de ~8 s de la Práctica 1).

### Fase 4 · MinIO (24 nov.)
- **4.1** Contenedor de MinIO, bucket y script de inicialización que sube los sprites. Ojo: en la P1 el servicio de sprites también usaba `scripts/revisar_sprites.py`, que no se copió a la P2; comprobar si hace falta.
- **4.2** La web muestra los sprites desde MinIO a través de una ruta de Nginx que reenvía a MinIO; MinIO no publica puertos. El navegador ya pide los dibujos en `/sprites/<id>.png` y `/sprites/shiny/<id>.png` (`app/static/app.js`): si Nginx sirve esa misma ruta desde MinIO, quizá no haga falta tocar la app. Los sprites (unos 2050 PNG: 1025 especies, normal y variocolor) se suben **una sola vez** con el script de inicialización, no al arrancar las webs.

### Fase 5 · Monitorización, logs y alertas (25 y 26 nov.)
- **5.1** Prometheus y cAdvisor (estado, CPU y memoria de cada contenedor) y Grafana con fuentes de datos y panel creados automáticamente.
- **5.2** Logs centralizados (Loki y su recolector) consultables desde Grafana.
- **5.3** Alertas en prod (web caída, CPU alta...) con umbrales elegidos y justificados, enviadas a Telegram (crear antes el bot con @BotFather; lo hago yo), y cómo dispararlas en la demo: un generador de carga (por ejemplo `hey` en un contenedor o un script) que suba la CPU por encima del umbral.

### Fase 6 · Pruebas (27 nov.)
- **6.1** Los tests de la API, pasando por el balanceador.
- **6.2** Pruebas de la infraestructura (`make test-infra`): reparto entre instancias, caída de una web, MinIO, alerta disparada con el generador de carga. Guardar sus salidas para el README.
- **6.3** Opcional: copiar mis datos reales del dev de la Práctica 1 (`make backup-dev` allí y restaurar aquí).

### Fase 7 · Entrega (28 y 29 nov.)
- **7.1** README: guía de instalación y prueba, partes del proyecto, diagrama de arquitectura, y tests con sus salidas.
- **7.2** Probar el README desde cero: clonar el repositorio en una carpeta limpia y seguir **solo** sus pasos, sin saltarse ninguno, como alguien que no conoce la infraestructura. Después, ensayo de la demo, guía de defensa y archivo comprimido para el campus.

Hay un día de margen entre fases. Las fases 4 y 5 son las más nuevas: ir más despacio.

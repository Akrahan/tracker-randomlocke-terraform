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
- **Balanceador elegido: Nginx con round-robin (21 nov., subpaso 3.2.1).** Nginx porque, además de repartir, servirá `/sprites/` desde MinIO en la fase 4 (una sola pieza en la puerta), su `nginx.conf` lo puede generar Terraform con `templatefile` y ya se conoce de la P1. Descartados: **HAProxy** (comprueba activamente las webs, pero no sirve ficheros: haría falta además un Nginx) y **Traefik** (se configura leyendo el socket de Docker, que equivale a ser *root* en la máquina, y duplica lo que decide Terraform). Política **round-robin**: peticiones cortas y parecidas, réplicas idénticas y reparto visible en la demo. Descartadas: **least_conn** (defendible, pero con esta carga se comporta igual; es una línea si hiciera falta), **ip_hash** (la app no guarda sesiones en memoria y todas las pruebas desde un mismo ordenador caerían en la misma web) y **weight** (las réplicas son iguales). La comprobación pasiva de Nginx se compensa en el 3.3 con `max_fails` y `proxy_next_upstream`.
- **Imagen de MinIO: la de Chainguard (24 nov., subpaso 4.1.1).** `cgr.dev/chainguard/minio`, fijada por su huella (`@sha256:f2e56ace…`, construida el 24 nov. 2026) y con `keep_locally = true`. **Por qué hace falta elegir:** MinIO sigue siendo software libre (código público, licencia AGPL), pero en 2025 dejó de publicar gratis sus programas e imágenes ya compilados y en septiembre de 2026 desapareció su repositorio de Docker Hub; comprobado el 24 nov.: `minio/minio` da 404 y `quay.io/minio/minio` tampoco tiene la imagen. **Por qué Chainguard:** compila MinIO desde ese código público y lo mantiene con parches (la imagen es del mismo día), es una empresa conocida de seguridad y sigue siendo MinIO, que es lo que el enunciado prefiere. Imagen mínima, sin usuario *root* (usuario 65532) y con `minio` como único programa. **Descartadas:** `bitnamilegacy/minio` (congelada, sin parches), `pgsty/minio` (*fork* de terceros cuya confianza no se puede valorar), Garage, SeaweedFS y RustFS (compatibles con S3 pero no son MinIO; habría que justificar no seguir el «preferiblemente») y el volumen compartido (permitido «en su defecto», pero no simula S3). **Riesgo:** la versión gratuita de Chainguard solo ofrece `latest`, que cambia y podría dejar de estar disponible; la huella fija la versión y `keep_locally` la conserva en el Docker local.
- **Herramientas de monitorización (24 nov., subpaso 5.1.1):** **cAdvisor** (mide CPU, memoria y estado de cada contenedor) → **Prometheus** (guarda el historial de métricas) → **Grafana** (paneles y alertas a Telegram); **Alloy** (recoge los logs de los contenedores) → **Loki** (los guarda y permite buscarlos) → Grafana. Imágenes con versión fijada: `prom/prometheus:v3.16.0`, `ghcr.io/google/cadvisor:0.57.0` (cAdvisor se mudó de `gcr.io`, donde la última es la 0.52.1, a `ghcr.io`), `grafana/grafana:13.3.2`, `grafana/loki:3.7.4` y `grafana/alloy:v1.22.0`. **Descartadas:** ELK (Elasticsearch + Logstash + Kibana: muy bueno buscando texto, pero tres piezas pesadas, ~1-2 GB de RAM por Elasticsearch y por entorno, y sin métricas de contenedores por sí solo); `node-exporter` (mide la máquina, no cada contenedor); InfluxDB (menos extendido para esto); Kibana (atado a Elasticsearch); Promtail (Grafana lo ha retirado en favor de Alloy); Fluent Bit (otra herramienta de otro proyecto); el *plugin* de logs de Docker para Loki (se instala en el motor de Docker, fuera de Terraform); Alertmanager (una pieza más: Grafana ya avisa). **Acceso a Docker:** cAdvisor y Alloy necesitan leer el Docker del ordenador, a diferencia de Traefik (3.2.1), porque medir y leer logs es su trabajo; se limita a solo lectura, solo esos dos contenedores, red interna y sin puertos. Detalle en «Herramientas de monitorización» (conceptos).
- **Cambio de recolector: Telegraf en lugar de cAdvisor (26 nov., subpaso 5.1.2) — explicarlo en la presentación.**
  - **Qué pasó:** cAdvisor arrancaba (`healthy`) y Prometheus le llegaba (`up = 1`), pero no guardaba ningún contenedor: cAdvisor solo medía la máquina entera (`id="/"`).
  - **Por qué:** cAdvisor mide **mirando dentro** de la máquina donde viven los contenedores (los *cgroups* de `/sys` y el socket de *containerd*), y para eso hay que prestarle esas carpetas. Con Docker Desktop hay dos máquinas: Ubuntu (WSL), donde se ejecutan Terraform y `docker`, y `docker-desktop`, donde vive el motor con los contenedores. Como Terraform pide desde Ubuntu, Docker Desktop le presta las carpetas **de Ubuntu**, donde no hay contenedores. No depende de dónde esté el proyecto (`/mnt/c` o `~/`), sino de dónde corre el motor. Desde Windows o con Docker Engine en Linux sí funcionaría.
  - **Qué se probó:** la opción `--containerd` (el socket no existe en Ubuntu); montajes *bind* recursivos de `/` y `/sys` (al borrarlos desmontaron carpetas de la máquina de Docker y hubo que reiniciar WSL y Docker Desktop: **no repetir**). Comprobado que la **API de Docker** sí llega bien desde WSL: un contenedor con el socket en solo lectura vio los 20 contenedores.
  - **Decisión:** **Telegraf** (InfluxData, imagen oficial `telegraf:1.38`) con su módulo `docker`, que **pregunta a la API** de Docker por el estado, la CPU y la memoria de cada contenedor (como `docker stats`) y lo publica en formato Prometheus. Sustituye **solo** a cAdvisor; Prometheus, Grafana, Loki y Alloy siguen igual. Solo necesita el socket de Docker (red interna, sin puertos, imagen fijada).
  - **Qué se gana y qué se pierde:** para lo que pide el enunciado (estado, CPU y memoria), nada se pierde; Telegraf da además el resultado del *healthcheck*. Se pierde detalle fino que no se usa. Recoge cada 10 s, unos 1-2 s por ronda en paralelo; no afecta a la velocidad de la web (no está en el camino de las peticiones).
  - **Alternativas descartadas:** exportador propio (código que mantener); cAdvisor con modo privilegiado o `cgroupns=host` (más permisos y sin probar); Docker Engine en Ubuntu o pasar el trabajo a Windows (reinstalar o cambiar todo el flujo a 3 días de la entrega).
  - **Nota estimada:** en general, cAdvisor 9/10 y Telegraf 7,5/10; en este proyecto, cAdvisor 3/10 y Telegraf 9/10.
  - **Al publicar en un servidor Linux:** volver a **cAdvisor + `node-exporter`** (ver «Ideas para después de la práctica»).

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

## Ideas para después de la práctica (fuera del alcance de la entrega)

- **Publicar la web con un límite gratuito de importaciones (23 nov.):** importar el guardado del juego (actualización automática del equipo) sería gratis **una vez al día**; para volver a importar el mismo día, el usuario vería un anuncio. No entra en la práctica (el README es solo de infraestructura y no se publica la web). Lo que haría falta si se hace:
  - **Cuentas de usuario:** el límite tiene que ir por usuario. Por IP no sirve: varias personas comparten una IP (casa, universidad) y una persona puede cambiarla.
  - **Contador en el servidor**, nunca en el navegador (se borra o se falsea): en Redis con caducidad de un día (`INCR` + `EXPIRE`) o en PostgreSQL si debe sobrevivir a un reinicio de Redis.
  - **Anuncio con recompensa verificado por el servidor:** la red de anuncios debe confirmar al servidor que se vio el anuncio; si solo lo dice el navegador, cualquiera se salta el anuncio.
  - **Requisitos legales en la UE:** consentimiento de cookies y de anuncios personalizados (RGPD), aviso legal y política de privacidad.
  - **Propiedad intelectual:** la app usa nombres y dibujos de Pokémon. Cobrar o poner anuncios en una herramienta de fans con material de Nintendo / The Pokémon Company puede acabar en una reclamación y en el cierre de la web. Habría que informarse antes de monetizar.
  - **Seguridad de la subida en una web pública:** ver «Subida de archivos» en `conceptos-para-estudiar.md` (lo que ya está hecho y lo que faltaría).
- **Publicar la web en internet con dominio propio (26 nov.):** qué haría falta, en orden:
  - **Servidor Linux en la nube** (un VPS pequeño, de unos pocos euros al mes) con **Docker Engine instalado directamente**: en Linux el motor y quien da las órdenes son la misma máquina, así que cAdvisor funcionaría tal cual. Terraform y los módulos sirven casi sin cambios (el provider apuntaría al Docker del servidor).
  - **Monitorización en el servidor:** volver a cAdvisor (estándar, más barato y con más detalle; allí funciona) más `node-exporter` para la máquina; Telegraf también valdría. Solo cambia el recolector y las consultas de Grafana.
  - **Dominio y DNS:** comprar el dominio y apuntar su registro `A` a la IP del servidor.
  - **HTTPS:** certificado gratuito de Let's Encrypt en Nginx (o Caddy, que lo renueva solo); redirigir HTTP a HTTPS.
  - **Exposición:** Nginx publicaría los puertos 80 y 443 en `0.0.0.0` (todo internet), y el resto seguiría igual: sin puertos. Cortafuegos (`ufw`) que solo abra 22, 80 y 443; SSH solo con clave, sin contraseña; Grafana y las consolas, nunca abiertas a internet (por un túnel SSH o una VPN).
  - **Secretos y estado:** contraseñas largas y distintas; el estado de Terraform fuera del portátil y con copia (por ejemplo, en un almacenamiento S3 cifrado).
  - **Copias de seguridad:** `pg_dump` diario de PostgreSQL guardado fuera del servidor, y prueba de restaurarlo.
  - **Rendimiento y coste:** los dibujos podrían servirse desde una CDN; límite de peticiones en Nginx (`limit_req`).
  - **Mantenimiento:** actualizaciones de seguridad del sistema y de las imágenes, y las alertas de Telegram activas.
  - **Legal:** aviso legal, privacidad y cookies (RGPD) y el riesgo de propiedad intelectual de Pokémon (ver la idea anterior).

## Mejoras detectadas en la Práctica 1 (las pide el enunciado)

Salen de las limitaciones de la guía de defensa de la Práctica 1 (las de la retrospectiva son personales: entender puertos y redes, defender con seguridad y depender menos de la IA, y se trabajan con el modo tutor y los hábitos de abajo). Se citarán en el README y en la defensa.

| Limitación en la Práctica 1 | Mejora en la Práctica 2 | Paso |
|---|---|---|
| Cada web preparaba la base de datos al arrancar | Se prepara una sola vez; con varias réplicas es obligatorio para que no compitan | 1.4 |
| Una sola web: si caía, la app caía | Varias réplicas detrás de Nginx, con reparto y conmutación si una falla | 3.1-3.3 |
| La primera lectura tras caer Redis tardaba ~8 s (resolución DNS de Docker Desktop) | Medido de nuevo (21 nov.): ~1,7-2,6 s la primera lectura de cada réplica y después ~25 ms; las escrituras tardaban ~1,7 s cada una con Redis caído (la invalidación no miraba si la caché estaba marcada como caída). Corregido en el 3.4.3: escrituras en ~0,015 s y tests sin Redis en 4,9 s | 3.4 |
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
  - **3.4.1** Caché compartida e invalidación, sin cambios de código: con una partida de prueba, `GET /runs/<id>/team` da `MISS` en una réplica y `HIT` en las otras; tras registrar una captura (`invalidar_equipo`), la siguiente lectura vuelve a ser `MISS` en cualquier réplica.
  - **3.4.2** Objetivos `stop-cache` y `start-cache` en el Makefile; con Redis parado, la web sigue respondiendo desde PostgreSQL (`X-Cache: DEGRADED`, «Caché: caída») y se mide cuánto tarda la primera lectura.
  - **3.4.3** (añadido el 21 nov. por lo medido en el 3.4.2) `invalidar_equipo` no intenta borrar en Redis si la caché está marcada como caída (tercer cambio en la aplicación); volver a medir.

### Fase 4 · MinIO (24 nov.)
- **4.1** Contenedor de MinIO, bucket y script de inicialización que sube los sprites. Ojo: en la P1 el servicio de sprites también usaba `scripts/revisar_sprites.py`, que no se copió a la P2; comprobar si hace falta. Ahora mismo, en la P2, `/sprites/<id>.png` da 404 (en la P1 los servía un volumen).
  - **4.1.1** Elegir la imagen de MinIO: Chainguard, fijada por su huella (ver «Decisiones ya tomadas»).
  - **4.1.2** Módulo `almacenamiento`: MinIO con su volumen y credenciales `sensitive`, en una red nueva interna `almacenamiento` (para que Nginx llegue a MinIO sin entrar en `backend`) y sin puertos publicados.
  - **4.1.3** Script de inicialización: contenedor de un solo uso que crea el bucket `sprites`, lo deja de solo lectura y sube los ~2050 dibujos una sola vez (idempotente). Script nuevo en `scripts/sprites/` (con `boto3`, el cliente oficial de AWS); `scripts/descargar_sprites.py` de la P1 se borra (decisión del usuario, 24 nov.): ya no lo usa nada y sigue en el historial de Git (`git show e9421ac:scripts/descargar_sprites.py`) por si sale en la defensa. `revisar_sprites.py` no hace falta: el script nuevo cuenta los errores y termina con código 1.
- **4.2** La web muestra los sprites desde MinIO a través de una ruta de Nginx que reenvía a MinIO; MinIO no publica puertos. El navegador ya pide los dibujos en `/sprites/<id>.png` y `/sprites/shiny/<id>.png` (`app/static/app.js`): si Nginx sirve esa misma ruta desde MinIO, no hace falta tocar la app. Los sprites (unos 2050 PNG: 1025 especies, normal y variocolor) se suben **una sola vez** con el script de inicialización, no al arrancar las webs.
  - **4.2.1** Nginx: `location /sprites/` reenvía a MinIO, solo `GET`.
  - **4.2.2** Comprobar: dibujos en la página, `/sprites/25.png` con `200 image/png`, MinIO inaccesible desde fuera, `PUT` rechazado y tests.
  - **4.2.3** Makefile y cierre de la fase (`fase-4.md`). Sin objetivos nuevos: `make logs ENV=<env> SERVICIO=minio` y `SERVICIO=subir-sprites` ya sirven.

### Fase 5 · Monitorización, logs y alertas (25 y 26 nov.)
- **5.1** Prometheus y cAdvisor (estado, CPU y memoria de cada contenedor) y Grafana con fuentes de datos y panel creados automáticamente.
- **5.2** Logs centralizados (Loki y su recolector) consultables desde Grafana.
- **Subpasos (24 nov.):**
  - **5.1.1** Decisión: herramientas (Prometheus + cAdvisor + Grafana frente a ELK; Loki + Alloy frente a Promtail) e imágenes con versión fijada; acceso de cAdvisor y del recolector de logs al Docker del ordenador (solo lectura).
  - **5.1.2** Módulo `monitorizacion`: red interna `monitorizacion`, **Telegraf** (en lugar de cAdvisor, ver «Decisiones») y Prometheus (configuraciones generadas con `templatefile`), sin puertos.
  - **5.1.3** Grafana: credenciales `sensitive`, sin acceso anónimo ni registro, solo en `127.0.0.1` (3100 en dev, 3200 en prod); fuente de datos y panel de CPU, memoria y estado creados automáticamente (*provisioning*).
  - **5.2.1** Logs centralizados: Loki y Alloy (lee los logs de los contenedores del entorno); fuente de datos Loki en Grafana.
  - **5.2.2** Comprobar: logs de Nginx y de las webs consultables en Grafana, filtrando por contenedor.
  - **5.3.1** Reglas de alerta (web caída, CPU alta) con umbrales justificados, creadas automáticamente; en los dos entornos.
  - **5.3.2** Telegram solo en prod (variable del `tfvars`, token y chat `sensitive`; el bot lo crea el usuario con @BotFather) y disparar una alerta en la demo con un generador de carga; objetivos del Makefile.
  - **5.3.3** Comprobaciones, mapa de límites y cierre de la fase (`fase-5.md`).
- **Seguridad de la monitorización (pedido el 24 nov., se aplica en 5.1-5.3):**
  - **Red propia `monitorizacion`, interna:** Prometheus, cAdvisor, Loki y su recolector solo hablan entre ellos y con Grafana; ninguno publica puertos.
  - **Grafana no se expone a cualquiera:** su panel se publica solo en `127.0.0.1` (como las demás consolas), nunca en todas las interfaces.
  - **Contraseñas:** usuario y contraseña de administrador de Grafana como variables `sensitive` en `secrets.auto.tfvars` (distintas en dev y prod), sin el `admin/admin` por defecto; registro de usuarios nuevos y acceso anónimo desactivados.
  - **Salida a internet solo para quien la necesita:** Grafana necesita salida para enviar las alertas a Telegram, así que, además de `monitorizacion`, va en una red con salida; el resto de la monitorización, no. El token del bot y el ID del chat, `sensitive`.
- **5.3** Alertas en prod (web caída, CPU alta...) con umbrales elegidos y justificados, enviadas a Telegram (crear antes el bot con @BotFather; lo hago yo), y cómo dispararlas en la demo: un generador de carga (por ejemplo `hey` en un contenedor o un script) que suba la CPU por encima del umbral.
  - Propuesta (24 nov., a decidir en el 5.3): las reglas de alerta en los dos entornos (mismo módulo), pero el envío a Telegram solo en prod, con una variable del `tfvars`; en dev se ven en Grafana. Ver «Alertas por entorno» en conceptos.

### Fase 6 · Pruebas (27 nov.)
- **6.1** Los tests de la API, pasando por el balanceador.
- **6.2** Pruebas de la infraestructura (`make test-infra`): reparto entre instancias, caída de una web, MinIO, alerta disparada con el generador de carga. Guardar sus salidas para el README.
- **6.3** Opcional: copiar mis datos reales del dev de la Práctica 1 (`make backup-dev` allí y restaurar aquí).

### Fase 7 · Entrega (28 y 29 nov.)
- **7.1** README: guía de instalación y prueba, partes del proyecto, diagrama de arquitectura, y tests con sus salidas.
- **7.2** **`make demo`: presentación semiautomática desde cero (importante, pedido el 24 nov.).** Un guion (`scripts/demo.sh`, lanzado con `make demo`) que parte de **nada**: sin contenedores, redes, volúmenes ni bases de datos, y sin las imágenes propias construidas (`tracker-*-web`). Lo crea todo con Terraform y avanza por partes: cada parte explica en una línea qué se va a ver, ejecuta sus comandos, muestra el resultado y espera a que se pulse **Enter**. Partes previstas:
  - **Punto de partida:** `docker ps -a`, `docker network ls`, `docker volume ls` e imágenes filtradas por `tracker-`, todo vacío.
  - **El código:** árbol de `terraform/` (módulos y entornos), un módulo representativo, los dos `terraform.tfvars` (la única diferencia entre dev y prod) y fragmentos concretos (`count`, `templatefile` del `nginx.conf`, bloque `upstream`, `max_fails` / `proxy_next_upstream`, caché con `count`). Nunca los `secrets.auto.tfvars` ni el estado.
  - **Despliegue desde cero:** `make init`, `make plan` (resumen) y `make apply` de dev y de prod, con lo que tarda.
  - **Lo creado:** `make ps` de los dos entornos, redes `frontend` / `backend`, volúmenes, imágenes.
  - **Exposición mínima y conectividad:** solo Nginx (y las consolas de administración, si las hay, en `127.0.0.1`) publica puerto; las webs, la BD, Redis y MinIO no; desde la web de dev no se resuelve la BD de prod; la BD no tiene salida a internet (`backend` interna).
  - **Balanceador:** las placas `X-Instancia` rotando y la página en el navegador.
  - **Alta disponibilidad:** `make stop-web`, peticiones sin errores, `make logs` de Nginx y `make start-web`.
  - **Caché compartida y Redis caído:** `MISS` en una réplica y `HIT` en otra; `make stop-cache` y la web sigue funcionando.
  - **MinIO, monitorización y alertas** (fases 4 y 5): sprites servidos a través de Nginx, Grafana con métricas y logs, alerta en Telegram.
  - **Tests:** `make test` en los dos entornos.
  - **Por qué Telegraf y no cAdvisor:** explicar con el dibujo de las dos máquinas (Ubuntu pide, `docker-desktop` tiene los contenedores) qué falló con cAdvisor, cómo se comprobó (Prometheus sin contenedores) y por qué Telegraf sí funciona (pregunta a la API). Enseñar la consulta a Prometheus con los contenedores del entorno.
  - **Recorrido por los límites:** la exposición consiste en entender el código. Por cada defensa, decir **qué se limita, dónde está en el código y cómo se demuestra** (ver «Mapa de límites para la exposición» al final de este documento). El guion puede enseñar cada fragmento con `grep -n` y a continuación su prueba.
  - **Cambio en directo:** el profesor pedirá un cambio y habrá que predecir el `plan` antes de ejecutarlo; dejar preparado un ejemplo (por ejemplo, `replicas_web = 4` en prod).

  Detalles a decidir al hacerlo: la limpieza inicial pide confirmación (borra los datos de los dos entornos); `postgres:16` y `redis:7-alpine` se conservan porque los usa la P1 (`keep_locally`); el guion no imprime credenciales; y conviene un modo «sin pausas» para ensayarlo. Va después de las fases 4-6 para que incluya MinIO, la monitorización y las pruebas.
- **7.3** Probar el README desde cero: clonar el repositorio en una carpeta limpia y seguir **solo** sus pasos, sin saltarse ninguno, como alguien que no conoce la infraestructura. Después, ensayo de la demo con `make demo`, guía de defensa y archivo comprimido para el campus.

Hay un día de margen entre fases. Las fases 4 y 5 son las más nuevas: ir más despacio.

## Mapa de límites para la exposición (borrador vivo, 24 nov.)

La presentación es explicar el código: qué está limitado o separado, dónde y por qué. Se completa en cada fase y se usa en `make demo` (7.2) y en la guía de defensa. Se cita por fichero y palabra clave (los números de línea cambian).

| Qué se limita o separa | Dónde (fichero → buscar) | Cómo se demuestra |
|---|---|---|
| **Una sola puerta de entrada** | `modules/balanceador/main.tf` → `ports` con `ip = "127.0.0.1"`; las webs, MinIO, BD y Redis sin `ports` | `make ps`: solo el balanceador tiene flecha; el puerto antiguo de una web da `000` |
| **Solo desde este ordenador** | `ip = "127.0.0.1"` (no `0.0.0.0`) | Desde otro equipo de la wifi no se llega |
| **Redes separadas por función** | `modules/red/main.tf` → `frontend`, `backend` (`internal = true`), `almacenamiento` (`internal = true`) | Desde `frontend`, `tracker-prod-minio` y la BD no se resuelven (`gaierror`); Nginx está en `frontend` y `almacenamiento`, nunca en `backend` (`modules/balanceador/main.tf` → `networks_advanced`) |
| **Sin salida a internet** | `internal = true` en `backend` y `almacenamiento` | La BD, Redis y MinIO no pueden descargar nada |
| **Entornos aislados** | Prefijo `tracker-<entorno>` y un estado por carpeta (`envs/dev`, `envs/prod`) | Desde dev, `tracker-prod-db` no se resuelve; `destroy` de prod no toca dev |
| **Secretos fuera del código** | `sensitive = true` en las variables; valores en `secrets.auto.tfvars` (`.gitignore`) | `git ls-files` sin secretos ni estado; el `plan` muestra `(sensitive value)` |
| **Contenedores sin *root*** | `USER appuser` (web y script de dibujos), `user = "redis"`, MinIO con el usuario 65532 | El volumen de MinIO en `/home/nonroot` (el problema de permisos del 4.1.2) |
| **Imágenes fijadas** | `@sha256:` en MinIO; versiones en `nginx:1.28-alpine`, `postgres:16`, `redis:7-alpine`, `requirements.txt` | El `plan` no cambia aunque salgan versiones nuevas |
| **Redis con contraseña y sin disco** | `modules/cache/main.tf` → `--requirepass`, `--save ""`, `--appendonly no` | `redis-cli ping` sin contraseña da `NOAUTH` |
| **Dibujos de solo lectura (dos capas)** | `nginx.conf.tftpl` → `limit_except GET`; `subir_sprites.py` → `POLITICA` (`s3:GetObject`) | `PUT`/`DELETE` a `/sprites/...` dan `403`; listar `/sprites/` da `403` |
| **MinIO sin consola** | `modules/storage/main.tf` → `MINIO_BROWSER=off` | No hay panel web de MinIO |
| **Tamaño de subida** | `nginx.conf.tftpl` → `client_max_body_size 6m`; `app/guardado_anil.py` → `LIMITE_BYTES`, `PROFUNDIDAD_MAXIMA` | Test del guardado de más de 5 MB: `413` de la app |
| **Nginx no da pistas** | `nginx.conf.tftpl` → `server_tokens off` | Las cabeceras no muestran la versión de Nginx |
| **Alta disponibilidad** | `nginx.conf.tftpl` → `max_fails`, `proxy_next_upstream`, `proxy_connect_timeout`, `resolve`; `restart = "unless-stopped"` | `make stop-web WEB=2`: 9/9 peticiones `200`; vuelve sola con `start-web` |
| **Comprobaciones antes de crear** | `validation` (réplicas, contraseña de MinIO) y `postcondition` (`preparar_db`, `subir_sprites`) | Un valor no válido falla en el `plan`; un script que falla para el `apply` |
| **Monitorización** (fase 5) | Red `monitorizacion` interna; Grafana solo en `127.0.0.1` con contraseña `sensitive`; Telegraf y Alloy con solo el socket de Docker (`:ro`), sin puertos (el `:ro` no hace de solo lectura al socket: por eso imagen oficial fijada y red interna) | Se completará en la fase 5 |
| **Recolector según el entorno de ejecución** | `modules/monitorizacion/main.tf` → Telegraf (API de Docker) en lugar de cAdvisor | Consulta a Prometheus: aparecen los contenedores `tracker-<entorno>-…`; con cAdvisor, ninguno |

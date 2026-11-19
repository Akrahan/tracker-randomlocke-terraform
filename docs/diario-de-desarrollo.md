# Diario de desarrollo: Práctica 2 (Terraform)

### [Paso 0.1: Partir de un código cerrado]
- **Fecha:** 17 nov. 2026
- **Archivos:** ninguno en este repositorio. En el de la Práctica 1 (rama `extras`) se subieron los cambios pendientes de la aplicación.
- **Comandos:** `git add .`, `git commit`, `git push` en `..\Tracker_Randomlocke` (rama `extras`).
- **Justificación:** la Práctica 2 despliega la aplicación de la Práctica 1 con sus mejoras; partir de un commit subido permite saber exactamente qué versión se copió y volver a ella.
- **Pruebas:** `git status` limpio y rama `extras` sincronizada con GitHub (commit `08dad64`). Los 51 tests de la API pasaban antes del commit.
- **Preparación hecha por Claude a petición del usuario:** carpeta nueva con `CLAUDE.md`, `docs/hoja-de-ruta.md`, la aplicación copiada (`app/`, `tests/`, `scripts/descargar_sprites.py`, `.env.*.example`, `.gitattributes`, `.editorconfig`), un `.gitignore` mínimo y material de consulta local en `docs/referencia/`. Comprobado que no se copió ningún `.env` real ni datos personales.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Preparó la carpeta, la hoja de ruta y las reglas de trabajo de la práctica; el commit lo hizo el usuario.
- **Commit:** `feat: import routes from the game's maps, IVs and EVs for exact estimates, and game data regardless of run rules` (en la Práctica 1, rama `extras`).

### [Paso 0.2: Instalar Terraform y comprobar que habla con Docker Desktop]
- **Fecha:** 17 nov. 2026
- **Archivos:** ninguno del proyecto. Prueba desechable en `~/tf-prueba/main.tf` (WSL), con el provider `kreuzwerker/docker` `~> 3.0`, `host = "unix:///var/run/docker.sock"` y un recurso `docker_image` (`hello-world`); se borró al terminar. En `docs/`: hoja de ruta (Terraform en WSL, balanceador como contenedor Nginx, exposición mínima, alertas por Telegram, hábitos de trabajo), `conceptos-para-estudiar.md` y, en `docs/referencia/` (local), la transcripción y el resumen del audio del profesor.
- **Comandos:** `terraform version` (ya instalado en WSL con `apt`, v1.17.2); `terraform init` (descarga `kreuzwerker/docker` v3.9.0 y crea `.terraform.lock.hcl`), `terraform plan`, `terraform apply`, `docker images hello-world`, `terraform plan`, `terraform destroy`.
- **Justificación:** Terraform se ejecuta en WSL, igual que `make`, y llega a Docker Desktop por el socket Unix gracias a la integración con WSL. Comprobarlo con un recurso mínimo antes del paso 1.1 separa los problemas de instalación de los de la infraestructura.
- **Pruebas:** el primer `plan` mostró `1 to add`; `apply` creó la imagen y `docker images` la listó; el segundo `plan` dijo «No changes» (el código coincide con el estado: idempotencia); `destroy` la eliminó. Docker 29.8.1 responde desde WSL.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Comprobó la instalación de Terraform y Docker, preparó el `main.tf` de prueba, explicó la salida de `init` y `plan`, transcribió el audio del profesor con faster-whisper (modelo `small`, en local) y lo resumió, y anotó las decisiones en la hoja de ruta. El usuario ejecutó `init`, `plan`, `apply` y `destroy`.
- **Commit:** ninguno (aún no hay repositorio; se crea en el paso 0.3).

### [Paso 0.3: Preparar el repositorio]
- **Fecha:** 18 nov. 2026
- **Archivos:** `.gitignore` (completado con Terraform: `**/.terraform/*`, `*.tfstate`, `*.tfstate.*`, `*.tfplan`, `secrets.auto.tfvars`, `crash*.log`). En `docs/`: hoja de ruta (repositorios separados frente a monorepo, caché en los pasos 2.3 y 3.4, mejoras detectadas de la P1, mejoras opcionales pendientes) y conceptos (`.gitignore`).
- **Comandos:** `git init -b main`, `git config core.filemode false`, `git status --short --ignored`, tres `git add` y `git commit`, `git config --global credential.helper` (Git Credential Manager de Windows desde WSL), `git remote add origin ...`, `git push -u origin main`.
- **Justificación:** repositorio público propio de la P2 (no monorepo con la P1) para que el README sea la portada y los commits muestren solo el progreso de esta práctica; el código parte de una copia de la rama `extras` de la P1 (`08dad64`), sin su historial. El `.gitignore` se escribió antes del primer `git add` porque un secreto ya commiteado queda en el historial.
- **Pruebas:** patrones del `.gitignore` probados con `git check-ignore` en un repositorio desechable (17 rutas: se ignoran el estado, los planes, `secrets.auto.tfvars`, `.terraform/`, `CLAUDE.md` y `docs/referencia/`; se suben `.terraform.lock.hcl`, `terraform.tfvars` y las plantillas). Saltos de línea LF. `app/` y `tests/` idénticos a `extras` (`diff -rq`). `git status` antes del commit: solo lo publicable. Repositorio en GitHub público con 3 commits y sin material local.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Explicó el `.gitignore`, `git init`, `core.filemode`, los repositorios separados frente al monorepo y la autenticación con GitHub; revisó el `.gitignore` y el contenido antes del commit, y comprobó el repositorio publicado. El usuario escribió el `.gitignore` e hizo los commits y el push.
- **Commit:** `chore: add git and editor configuration`, `chore: import Tracker Randomlocke app from Practice 1 (branch extras, commit 08dad64)`, `docs: add roadmap, development diary and study notes` (la entrada de este diario irá en el commit del paso 0.4).

### [Paso 0.4: Documentos base]
- **Fecha:** 18 nov. 2026
- **Archivos:** `docs/diario-de-desarrollo.md`, `docs/hoja-de-ruta.md` y `docs/conceptos-para-estudiar.md` (entrada «Autenticación con GitHub: Git Credential Manager»). Sin README.
- **Comandos:** `git add docs`, `git commit`, `git push`.
- **Justificación:** el README se escribe al final (paso 7.1), cuando la arquitectura, los comandos y las salidas de los tests sean definitivos; hasta entonces, el diario recoge las pruebas de cada fase para reutilizarlas. Los mensajes de commit pasan a describir lo hecho, sin números de paso.
- **Pruebas:** `git status` limpio y `main` sincronizada con GitHub (0 commits por subir).
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Redactó las entradas del diario y de los conceptos, anotó las decisiones en la hoja de ruta y comprobó que todo estaba subido. El usuario hizo los commits y los push.
- **Commit:** `docs: record steps 0.2 and 0.3 in diary and update roadmap decisions` y `docs: explain GitHub authentication with Git Credential Manager`.

### [Paso 1.1: Estructura de Terraform, provider de Docker e init]
- **Fecha:** 18 nov. 2026
- **Archivos:** `terraform/envs/dev/versions.tf` (`required_version = ">= 1.6, < 2.0"`, provider `kreuzwerker/docker` `~> 3.9`), `terraform/envs/dev/providers.tf` (`host = "unix:///var/run/docker.sock"`) y `terraform/envs/dev/.terraform.lock.hcl` (generado por `init`). En `docs/`: concepto «Estructura de ficheros y directorio raíz».
- **Comandos:** `mkdir -p terraform/envs/dev`, `terraform fmt`, `terraform init`, `terraform validate`, `terraform plan`.
- **Justificación:** una carpeta raíz por entorno (`envs/dev`, después `envs/prod`) da a cada uno su propio estado, de modo que un `destroy` en dev no puede tocar prod (descartados los workspaces). Versiones fijadas para que el despliegue sea reproducible; los ficheros se separan por convención (`versions.tf`, `providers.tf`, y más adelante `main.tf`, `variables.tf` y `outputs.tf`).
- **Pruebas:** `init` instaló `kreuzwerker/docker` v3.9.0 y creó el lock; `validate`: «Success! The configuration is valid»; `plan`: «No changes» (aún no hay recursos). `.terraform/` queda ignorado por Git y el lock no.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Explicó la estructura por entornos, la separación en ficheros, la configuración duplicada de providers y lo que hacen `fmt`, `init`, `validate` y `plan`; dio los dos bloques de código y revisó los ficheros escritos. El usuario escribió los ficheros y ejecutó los comandos.
- **Commit:** `feat: set up Terraform dev environment with the Docker provider`

### [Paso 1.2: Redes y volumen de la base de datos]
- **Fecha:** 18 nov. 2026
- **Archivos:** `terraform/envs/dev/variables.tf` (variable `entorno` sin `default`, con validación `dev`/`prod`), `terraform/envs/dev/terraform.tfvars` (`entorno = "dev"`) y `terraform/envs/dev/main.tf` (`local.prefijo`, redes `frontend` y `backend` con `internal = true`, volumen `db_datos`). En `docs/`: hoja de ruta (prefijo `tracker-<entorno>`, dos redes, aviso sobre `revisar_sprites.py` en el 4.1) y conceptos (variables, tfvars y locals, volúmenes y redes, con las dudas resueltas).
- **Comandos:** `terraform fmt`, `terraform validate`, `terraform plan`, `terraform apply`, `docker network ls --filter name=tracker-dev`, `docker volume ls --filter name=tracker-dev`, `terraform plan`.
- **Justificación:** el prefijo `tracker-<entorno>` evita choques con los recursos de la P1 (`randomlocke-*`) y entre dev y prod; el riesgo grave es un volumen con el mismo nombre, que Docker reutiliza sin avisar. Se mantiene la segmentación del prod de la P1: `frontend` para Nginx y las webs, y `backend` interna, sin internet, para las webs, PostgreSQL y Redis.
- **Pruebas:** sin `terraform.tfvars`, el `plan` fallaba con «No value for required variable»; con él, «No changes». El `plan` previsto y obtenido fue `3 to add`. Tras el `apply` existen `tracker-dev-frontend` (`internal=false`), `tracker-dev-backend` (`internal=true`) y el volumen `tracker-dev-db-datos`; el segundo `plan` dio «No changes». `terraform.tfstate` queda ignorado por Git.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Explicó el paso fichero a fichero (variables, tfvars, locals, redes internas, volúmenes), por qué se usan nombres propios, cómo predecir el `plan` y el papel de Docker frente a Compose; revisó cada fichero y comprobó las redes y el estado. El usuario escribió los ficheros y ejecutó `plan` y `apply`.
- **Commit:** `feat: add dev networks and database volume`

### [Paso 1.3: Contenedor de PostgreSQL con credenciales sensibles]
- **Fecha:** 18 nov. 2026
- **Archivos:** `terraform/envs/dev/variables.tf` (`db_nombre`; `db_usuario` y `db_password` con `sensitive = true`, sin `default`), `terraform/envs/dev/terraform.tfvars` (`db_nombre`), `terraform/envs/dev/secrets.auto.tfvars.example` (plantilla con valores ficticios), `terraform/envs/dev/secrets.auto.tfvars` (valores reales, fuera de Git) y `terraform/envs/dev/main.tf` (`docker_image.postgres` con `keep_locally = true` y `docker_container.db`). En `docs/`: conceptos (estado y contraseñas, ficheros de `envs/dev`, para qué Terraform, puertos expuestos y publicados, entrada y salida de las redes).
- **Comandos:** `cp secrets.auto.tfvars.example secrets.auto.tfvars`, `openssl rand -base64 24`, `terraform fmt`, `terraform validate`, `terraform plan`, `terraform apply`, `docker ps --filter name=tracker-dev-db`, `terraform plan`.
- **Justificación:** las credenciales son variables `sensitive` cuyo valor vive en un fichero ignorado por Git, y la misma variable alimentará a PostgreSQL y a la web, así que siempre coinciden. El contenedor solo está en la red `backend` (interna), sin puertos publicados, con el volumen del paso 1.2, healthcheck `pg_isready`, `restart = "unless-stopped"` y `wait = true` para que el `apply` espere a que esté sano.
- **Pruebas:** primer intento de `plan` con «Variables not allowed»: los valores de `secrets.auto.tfvars` iban sin comillas (en un `.tfvars` un texto sin comillas se interpreta como expresión); se comprobó con un script que solo indica si cada valor va entre comillas, sin mostrarlo, y se corrigió. Después, el `plan` previsto y obtenido fue `2 to add, 0 to change, 0 to destroy`, con `env` como `(sensitive value)`. Tras el `apply`: `tracker-dev-db` `Up (healthy)`, solo en `tracker-dev-backend`, volumen montado en `/var/lib/postgresql/data`, sin puertos publicados (`5432/tcp` solo expuesto); la base de datos `randomlocke` responde a consultas; el segundo `plan` dio «No changes». En el repositorio solo está la plantilla `.example`.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Explicó las variables sensibles, el estado con contraseñas en claro, los ficheros de valores, cada bloque del contenedor y las redes (con diagramas); diagnosticó el error de las comillas sin leer los secretos y verificó el contenedor sin mostrar credenciales. El usuario escribió los ficheros, eligió las credenciales y ejecutó `plan` y `apply`.
- **Commit:** `feat: add PostgreSQL container with sensitive credentials and healthcheck`

### [Paso 1.4: La web con Terraform y la base de datos preparada una sola vez]
- **Fecha:** 18 y 19 nov. 2026
- **Archivos:**
  - `app/main.py` (primer cambio en la app: interruptor `INICIALIZAR_DB`, por defecto `true`, y un `if` en `lifespan`) y `app/preparar_db.py` (nuevo: llama a `inicializar_db()` y termina).
  - `terraform/envs/dev/variables.tf` (`puerto_web`) y `terraform/envs/dev/terraform.tfvars` (`puerto_web = 8100`).
  - `terraform/envs/dev/main.tf`: `local.ruta_app`; `docker_image.web` con `build { context, dockerfile, builder = "default" }` y `triggers` con la huella de `app/`; `local.entorno_db`; `docker_container.preparar_db` (misma imagen, `command = ["python", "preparar_db.py"]`, `must_run = false`, `attach = true`, `logs = true`, solo red `backend`, `postcondition` sobre `exit_code`); `docker_container.web` (redes `frontend` y `backend`, puerto `127.0.0.1:8100->8000`, healthcheck sobre `/status`, `INICIALIZAR_DB=false`, `depends_on = [docker_container.preparar_db]`).
  - En `docs/`: conceptos nuevos (imagen y huella, dependencias y orden, contenedor de un solo uso, credenciales, Git) y las dudas resueltas del paso; hoja de ruta (sprites en el 4.2).
- **Comandos:** `terraform fmt`, `terraform validate`, `terraform plan`, `terraform apply`, `terraform apply -replace=docker_container.web`, `terraform destroy`, `docker ps -a`, `docker logs`, `docker buildx history ls`, `curl /status`, y los tests de la API en un contenedor de un solo uso (`docker run --rm --network tracker-dev-frontend -e BASE_URL=http://tracker-dev-web:8000 ... pytest`).
- **Justificación:** la web se construye con Terraform desde `app/` (huella en `triggers` para que el `plan` vea los cambios de código) y se publica solo en `127.0.0.1` (exposición mínima). La preparación de la base de datos se separa de la web en un contenedor de un solo uso que va antes (`depends_on`), para que en la fase 3 varias réplicas arranquen sin pisarse.
- **Pruebas:**
  - **Construcción de la imagen:** sin `builder`, quedó bloqueada más de 5 min en «0/0 pasos» (constructor antiguo con el almacén *containerd* de Docker Desktop); con `builder = "default"` (BuildKit) falló porque `buildx` busca el Dockerfile desde `envs/dev`, y se corrigió con `dockerfile = "${local.ruta_app}/Dockerfile"`. Imagen `tracker-dev-web:latest`, 242 MB, usuario `appuser`.
  - **Web (1.4.2):** `Up (healthy)`, `127.0.0.1:8100->8000/tcp`, redes `frontend` y `backend`; `/status` devolvió `{"estado":"ok","db":"ok","cache":"no aplica"}`; al arrancar, la web cargaba 1025 especies y 54 726 filas de ataques.
  - **Preparación separada (1.4.3):** `plan` previsto y obtenido `3 to add, 0 to change, 2 to destroy` (la imagen y la web se reemplazan por la huella, `image` y `env`; `preparar_db` es nuevo). Orden del `apply`: destruir la web y la imagen → crear la imagen → `preparar_db` → la web. `preparar-db` terminó `Exited (0)` con «Base de datos preparada» en unos 2,2 s; la web arrancó después con `INICIALIZAR_DB=false`, y su `lifespan` tardó menos de 1 ms.
  - **Persistencia (1.4.4.a):** con la partida «Prueba 1» creada, `terraform apply -replace=docker_container.web` recreó solo la web; `preparar_db` no se volvió a ejecutar (misma imagen) y la partida siguió ahí (vive en el volumen). `/docs` respondió 200.
  - **Tests de la API (1.4.4.b):** `51 passed in 4.51s` (50 funciones, una parametrizada para `nuzlocke` y `randomlocke`); las partidas de prueba se borraron solas.
  - **Desde cero (1.4.4.c):** `terraform destroy` → `Destroy complete! Resources: 8 destroyed.` en 7,8 s, sin restos de `tracker-dev` y con `postgres:16` conservada (`keep_locally`). `terraform apply` → `Plan: 8 to add` y `Apply complete! Resources: 8 added, 0 changed, 0 destroyed.` en 19,2 s. Después: los tres contenedores bien (web y base de datos `healthy`, `preparar-db` `Exited (0)`), `/status` ok, catálogos 1025 y 54 726, base de datos sin partidas, `plan` «No changes» y otra vez `51 passed in 4.74s`.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Diseñó el paso en subpasos, explicó cada bloque (imagen, huella, contenedor, dependencias, contenedor de un solo uso), diagnosticó el bloqueo de la construcción con el historial de BuildKit y el esquema del provider, revisó el código del usuario y, a petición suya, ejecutó las pruebas 1.4.4.b y 1.4.4.c (tests, `destroy` y `apply`). El usuario escribió el código de la app y de Terraform y ejecutó los `apply` de los subpasos 1.4.1 a 1.4.4.a.
- **Commit:** `feat: add switch to skip DB setup on web startup and preparar_db script` (app), `feat: build and run the dev web with Terraform after one-shot DB setup` (terraform) y `docs: log web deployment, API tests and from-scratch rebuild` (docs).

### [Subpaso 2.1.1: Carpetas de los módulos y provider de cada uno]
- **Fecha:** 20 nov. 2026
- **Archivos:** `terraform/modules/red/versions.tf`, `terraform/modules/base_datos/versions.tf` y `terraform/modules/web/versions.tf` (iguales: `required_providers` con `source = "kreuzwerker/docker"`, sin versión). En `docs/`: concepto «Módulos», división de la fase 2 en subpasos (hoja de ruta) y la regla de documentar cada subpaso (`CLAUDE.md`, local).
- **Comandos:** `mkdir -p terraform/modules/red terraform/modules/base_datos terraform/modules/web` (desde la raíz), `terraform fmt -check -recursive modules`, `terraform plan` en dev.
- **Justificación:** los módulos son las piezas reutilizables que usarán dev y prod, para no duplicar código (lo que desincronizó el prod de la P1). Cada módulo declara qué provider necesita, porque sin esa declaración Terraform supondría `hashicorp/docker`, que no existe. La versión y la configuración del provider (`host`) se quedan en el módulo raíz de cada entorno.
- **Pruebas:** los tres ficheros son idénticos, en LF y sin cambios de `fmt`; el `plan` de dev da «No changes», porque nadie llama todavía a los módulos.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Explicó qué es un módulo (entradas, recursos, salidas y módulo raíz), propuso el reparto en `red`, `base_datos` y `web`, y revisó los ficheros. El usuario creó las carpetas y los ficheros.
- **Commit:** irá junto con los módulos, en el subpaso 2.1.5 (`refactor: move dev resources into reusable red, base_datos and web modules`).

### [Subpaso 2.1.2: Módulo red]
- **Fecha:** 20 nov. 2026
- **Archivos:** `terraform/modules/red/variables.tf` (entrada `prefijo`), `terraform/modules/red/main.tf` (redes `frontend` y `backend` con `internal = true`, con nombre `${var.prefijo}-...`) y `terraform/modules/red/outputs.tf` (salidas `frontend` y `backend`, con los nombres de las redes).
- **Comandos:** `terraform fmt -recursive modules`, `terraform plan` en dev.
- **Justificación:** las redes se escriben una vez y cada entorno las crea con su prefijo (`tracker-dev` o `tracker-prod`). El módulo es una caja cerrada: sus recursos no se ven desde fuera, y la base de datos y la web obtienen los nombres de las redes a través de las salidas, lo que además mantiene el orden de creación. Los nombres internos (`frontend` y `backend`) se mantienen iguales que en dev para facilitar los bloques `moved` del subpaso 2.1.5.
- **Pruebas:** ficheros correctos, en LF y sin cambios de `fmt`; el `plan` de dev sigue en «No changes» (el módulo aún no se usa; en `envs/dev` no se ha borrado nada).
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Dio el código del módulo explicado fichero a fichero, explicó para qué sirve separar en módulos y en tres ficheros (con dudas resueltas en conceptos) y revisó lo escrito. El usuario escribió los ficheros.
- **Commit:** irá junto con los módulos, en el subpaso 2.1.5.

### [Subpaso 2.1.3: Módulo base_datos]
- **Fecha:** 20 nov. 2026
- **Archivos:** `terraform/modules/base_datos/variables.tf` (entradas `prefijo`, `red_backend`, `db_nombre`, `db_usuario` y `db_password`, estas dos con `sensitive = true`), `terraform/modules/base_datos/main.tf` (volumen, imagen `postgres:16` con `keep_locally` y contenedor de PostgreSQL, copiados de dev cambiando `local.prefijo` por `var.prefijo` y `docker_network.backend.name` por `var.red_backend`) y `terraform/modules/base_datos/outputs.tf` (salida `host` con el nombre del contenedor).
- **Comandos:** `mv variable.tf variables.tf`, `terraform fmt -recursive modules`, `terraform plan` en dev.
- **Justificación:** PostgreSQL se escribe una vez para los dos entornos. Dentro del módulo solo existe lo que tiene dentro y lo que le llega por sus variables; por eso el prefijo y la red llegan como entradas, y la web obtendrá el host por la salida `host`, que además mantiene el orden base de datos → web. La marca `sensitive` se repite en el módulo porque no viaja sola.
- **Pruebas:** la primera versión tenía tres fallos: faltaba la `}` del volumen (`fmt`: «Unclosed configuration block»), faltaba `outputs.tf` y el fichero se llamaba `variable.tf`. Tras corregirlos, `fmt` pasa sin cambios, todo está en LF y el `plan` de dev sigue en «No changes» (el módulo aún no se usa; Terraform no lee un módulo hasta que alguien lo llama).
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Dio el código completo marcando las tres líneas que cambian respecto a dev, explicó cómo llegan los valores a un módulo (bloque `module` → `variable` del módulo; salidas de vuelta) y detectó los tres fallos. El usuario escribió y corrigió los ficheros.
- **Commit:** irá junto con los módulos, en el subpaso 2.1.5.

### [Subpaso 2.1.4: Módulo web]
- **Fecha:** 20 nov. 2026
- **Archivos:** `terraform/modules/web/variables.tf` (9 entradas: `prefijo`, `ruta_app`, `red_frontend`, `red_backend`, `db_host`, `db_nombre`, `db_usuario` y `db_password` (`sensitive`), y `puerto`), `terraform/modules/web/main.tf` (`local.entorno_db`, imagen con la huella y `builder = "default"`, `preparar_db` y la web, copiados de dev pasando a `var.` todo lo que venía de fuera) y `terraform/modules/web/outputs.tf` (salida `url`, construida con el puerto real del contenedor, `ports[0].external`).
- **Comandos:** `terraform fmt -recursive modules`, `terraform plan` en dev; comparación línea a línea del módulo con el código de dev.
- **Justificación:** todo lo de la web (imagen, preparación única de la base de datos y contenedor) va en una caja que dev y prod usarán con su prefijo, su puerto y sus credenciales. `ruta_app` llega como entrada en vez de calcularse dentro, para no atar el módulo a una estructura de carpetas. `ENABLE_DOCS` sigue fijo hasta el 2.2.1, y las réplicas llegan en la fase 3.
- **Pruebas:** en la primera versión faltaba `builder = "default"` en el bloque `build`. Sin él, la construcción volvería a bloquearse (como en el 1.4.1), y en el 2.1.5 el `plan` vería un cambio en la imagen y querría recrear la imagen, `preparar_db` y la web. Tras añadirlo, el módulo es idéntico al código de dev salvo las líneas en blanco y el sitio del `locals`; `fmt` pasa y el `plan` de dev sigue en «No changes».
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Dio el código completo con los cambios marcados, explicó por qué `ruta_app` es una entrada y cómo se construye la salida `url`, resolvió dudas sobre cuántos módulos habrá y por qué la caché es un módulo, y detectó la línea que faltaba. El usuario escribió y corrigió los ficheros.
- **Commit:** irá junto con los módulos, en el subpaso 2.1.5.

### [Subpaso 2.1.5: dev pasa a usar los módulos, sin destruir nada]
- **Fecha:** 20 nov. 2026
- **Archivos:** `terraform/envs/dev/main.tf` (de 141 a 32 líneas: `local.prefijo` y tres bloques `module` (`red`, `base_datos` y `web`) con los valores de dev; `db_host = module.base_datos.host` y las redes desde `module.red`), `terraform/envs/dev/moved.tf` (nuevo: 8 bloques `moved`, de cada dirección vieja a `module.<x>.<recurso>`) y `terraform/envs/dev/outputs.tf` (nuevo: `url = module.web.url`).
- **Comandos:** `terraform fmt`, `terraform init` (registra los tres módulos locales), `terraform validate`, `terraform plan`, `terraform apply`, `terraform state list`.
- **Justificación:** dev ya no contiene el «cómo», solo llama a las piezas con sus valores; prod podrá hacer lo mismo sin duplicar código. Como la dirección de cada recurso cambia al entrar en un módulo, los bloques `moved` le dicen a Terraform que son los mismos recursos, así que solo renombra sus fichas en el estado en lugar de destruir y crear (lo que habría borrado el volumen con los datos y chocado por nombres repetidos).
- **Pruebas:** `init` registró `red`, `base_datos` y `web`; `validate` correcto. El `plan` (previsto y obtenido) mostró los 8 recursos con «has moved to» y `Plan: 0 to add, 0 to change, 0 to destroy.`, más `+ url = "http://127.0.0.1:8100"`: los módulos son idénticos al código anterior. `apply`: `Apply complete! Resources: 0 added, 0 changed, 0 destroyed.` y `url = "http://127.0.0.1:8100"`. Después, `terraform state list` muestra las 8 direcciones nuevas (`module.red.docker_network.frontend`...), el segundo `plan` da «No changes», los contenedores conservan su hora de arranque (no se recrearon) y `/status` responde ok.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Explicó el problema de las direcciones y los bloques `moved` (con la comparación de la agenda de contactos), qué hacen `outputs.tf` y `moved.tf`, en qué se diferencia de borrar y crear, y para qué se usa en la práctica; dio el código, lo revisó con `fmt`, `init`, `validate` y `plan`, y verificó la migración. El usuario escribió los ficheros y ejecutó el `apply`.
- **Commit:** `refactor: move dev resources into reusable red, base_datos and web modules` (los tres módulos, los cambios de dev y `moved.tf`).

### [Subpaso 2.1.6: Comprobar la migración y retirar moved.tf]
- **Fecha:** 20 nov. 2026
- **Archivos:** se borra `terraform/envs/dev/moved.tf`.
- **Comandos:** tests de la API en un contenedor de un solo uso (`docker run --rm --network tracker-dev-frontend -e BASE_URL=http://tracker-dev-web:8000 ... pytest`), `rm terraform/envs/dev/moved.tf`, `terraform plan`, `git add -A terraform`.
- **Justificación:** la web, que ahora sale de módulos, debe funcionar igual que antes. Los bloques `moved` solo hacen falta mientras exista un estado con direcciones viejas; dev ya está migrado y prod nacerá con módulos, así que se retiran para que dev y prod queden simétricos. La migración queda en el historial (commit `c377c1c`).
- **Pruebas:** `51 passed in 4.66s` contra dev con módulos, sin partidas de prueba restantes. Sin `moved.tf`, el `plan` muestra `Refreshing state` con las direcciones `module.*` y da «No changes»: el estado ya tenía las direcciones nuevas.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Pasó los tests, explicó los pros y contras de borrar `moved.tf` (no es obligatorio; se recomienda por limpieza y simetría) y comprobó el commit. El usuario borró el fichero, ejecutó el `plan` e hizo el commit.
- **Commit:** `chore: remove moved blocks after migrating dev state to modules` (hecho: `30d4970`).

### [Subpaso 2.2.1: /docs configurable por entorno]
- **Fecha:** 20 nov. 2026
- **Archivos:** `terraform/modules/web/variables.tf` (entrada `docs_activadas`, tipo `bool`), `terraform/modules/web/main.tf` (`"ENABLE_DOCS=${var.docs_activadas}"` en lugar de `"ENABLE_DOCS=true"`), `terraform/envs/dev/variables.tf` (variable `docs_activadas`), `terraform/envs/dev/terraform.tfvars` (`docs_activadas = true`) y `terraform/envs/dev/main.tf` (`docs_activadas = var.docs_activadas` en `module "web"`).
- **Comandos:** `terraform fmt`, `terraform validate`, `terraform plan` en dev.
- **Justificación:** `ENABLE_DOCS` era lo único fijo en el módulo que debe ser distinto en prod (apagado por exposición mínima: no publicar el mapa de la API). Pasa a ser una entrada `bool` que cada entorno decide en su `terraform.tfvars`, como el puerto.
- **Pruebas:** el primer `validate` falló con «Reference to undeclared input variable» y el aviso «Value for undeclared variable»: la variable estaba en el módulo y en el `tfvars`, pero no declarada en `envs/dev/variables.tf` (cada módulo tiene sus propias variables; el cambio no se había guardado). Tras declararla, `validate` correcto y `plan` «No changes»: el texto que recibe el contenedor sigue siendo `ENABLE_DOCS=true`.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Presentó el paso 2.2 y sus subpasos, dio los cinco cambios explicados, diagnosticó el error de la variable no declarada y revisó el resultado. El usuario hizo los cambios.
- **Commit:** `feat: make API docs configurable per environment`.

### [Subpaso 2.2.2: Crear envs/prod con los mismos módulos]
- **Fecha:** 20 nov. 2026
- **Archivos:** `terraform/envs/prod/` con `versions.tf`, `providers.tf`, `variables.tf`, `main.tf`, `outputs.tf` y `secrets.auto.tfvars.example` copiados de dev (idénticos); `terraform.tfvars` propio (`entorno = "prod"`, `db_nombre = "randomlocke"`, `puerto_web = 8200`, `docs_activadas = false`); `secrets.auto.tfvars` propio, fuera de Git, con usuario y contraseña distintos de los de dev; `.terraform.lock.hcl` generado por `init`. En `docs/`: qué se copia y qué no al crear un entorno, y la duda del usuario de prod.
- **Comandos:** `mkdir -p terraform/envs/prod`, `cp terraform/envs/dev/{versions,providers,variables,main,outputs}.tf ... terraform/envs/prod/`, `cp secrets.auto.tfvars.example secrets.auto.tfvars`, `openssl rand -base64 24`, `terraform fmt`, `terraform init`, `terraform validate`, `terraform plan`.
- **Justificación:** prod usa los mismos módulos que dev y solo cambian sus valores y sus secretos. No se copian `.terraform/` ni el estado (prod creería ser dueño de los recursos de dev, y un `destroy` los borraría) ni las credenciales (si se filtran las de dev, no deben servir para prod). El usuario también es distinto, por seguridad y para reconocer el entorno.
- **Pruebas:** los cinco `.tf` y la plantilla, idénticos a dev (`cmp`); `secrets.auto.tfvars` ignorado por Git, con los valores entre comillas y distintos de los de dev (comparado por huellas, sin leerlos); `init` registró los módulos y generó un lock igual que el de dev; `fmt` sin cambios; `plan` (previsto y obtenido): `Plan: 8 to add, 0 to change, 0 to destroy.`, todos con nombre `tracker-prod-*`, `backend` con `internal = true`, la web en el 8200 y `+ url = "http://127.0.0.1:8200"`, sin tocar nada de dev.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Explicó qué copiar y qué no, cómo generar la contraseña y por qué el usuario de prod debe ser distinto; revisó los ficheros, los secretos (sin leerlos) y el `plan`. El usuario creó la carpeta, los valores y las credenciales y ejecutó `init` y `plan`.
- **Commit:** `feat: add prod environment using the same modules as dev` (tras el `apply` del subpaso 2.2.3).

### [Subpaso 2.2.3: Levantar prod y comprobar que convive con dev]
- **Fecha:** 20 nov. 2026
- **Archivos:** ninguno nuevo; el estado de prod (`terraform/envs/prod/terraform.tfstate`, fuera de Git) lo crea el `apply`.
- **Comandos:** `terraform apply` en prod; comprobaciones con `docker ps -a`, `curl` a `/status` y `/docs` de los dos entornos, `docker exec tracker-dev-web python -c "socket.create_connection(...)"`, `terraform state list`, `terraform output -raw url`, `terraform plan` en los dos; tests de la API en cada entorno (`--network tracker-<entorno>-frontend`, `BASE_URL=http://tracker-<entorno>-web:8000`); `terraform destroy` en prod, `docker ps` y `terraform apply` en prod otra vez.
- **Justificación:** el enunciado exige dos entornos levantados a la vez. Cada uno tiene su prefijo, sus redes, su volumen, su puerto y su estado, así que conviven sin pisarse y se puede destruir uno sin afectar al otro.
- **Pruebas:**
  - **Prod:** `Apply complete! Resources: 8 added`; `tracker-prod-web` y `tracker-prod-db` `healthy`, `tracker-prod-preparar-db` `Exited (0)` y catálogos 1025 y 54 726 en su propia base de datos.
  - **Convivencia:** puertos `127.0.0.1:8100` (dev) y `127.0.0.1:8200` (prod); `/docs` da 200 en dev y 404 en prod (`docs_activadas = false`); redes `tracker-{dev,prod}-{frontend,backend}` y volúmenes `tracker-{dev,prod}-db-datos` separados; cada estado con sus 8 recursos y su `url`; los dos `plan` en «No changes»; `51 passed` en dev (4,66 s) y en prod (4,51 s).
  - **Aislamiento:** desde la web de dev, `tracker-dev-db` es alcanzable y `tracker-prod-db` da `gaierror`, porque el nombre no se resuelve fuera de su red.
  - **Independencia:** `terraform destroy` en prod borró solo sus 8 recursos (contenedores, redes y volumen). Dev siguió `Up 3 hours (healthy)` y respondiendo ok. Un nuevo `apply` recreó prod, y otra vez cuatro contenedores en marcha y los dos `plan` en «No changes».
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Revisó el `plan` de prod, hizo las comprobaciones de convivencia, aislamiento y tests, y explicó cuántos contenedores debe haber y por qué `docker ps` no enseña `preparar-db`. El usuario ejecutó los `apply` y el `destroy` de prod.
- **Commit:** `feat: add prod environment using the same modules as dev` (terraform) y `docs: log prod environment creation and coexistence tests` (docs).

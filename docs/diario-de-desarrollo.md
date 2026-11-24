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

### [Subpaso 2.3.1: Módulo cache (Redis)]
- **Fecha:** 20 nov. 2026
- **Archivos:** `terraform/modules/cache/versions.tf` (copiado de `red`), `variables.tf` (`prefijo`, `red_backend` y `password` con `sensitive`), `main.tf` (imagen `redis:7-alpine` con `keep_locally` y contenedor `${prefijo}-cache`: `user = "redis"`, contraseña por variable de entorno, `--requirepass`, sin persistencia (`--save ""`, `--appendonly no`), solo red `backend`, sin puertos, healthcheck `redis-cli ping` autenticado y `wait = true`) y `outputs.tf` (salida `host`). En `docs/`: concepto «Caché con Redis» y la duda sobre los ficheros de cada módulo.
- **Comandos:** `rmdir` de una carpeta creada por error en `terraform/envs/prod/terraform/modules/cache` (vacía); `mkdir -p terraform/modules/cache` y `cp terraform/modules/red/versions.tf terraform/modules/cache/` desde la raíz; `terraform fmt -recursive modules`.
- **Justificación:** la caché es un componente propio (como PostgreSQL) que cada entorno decidirá si usa. Es la misma configuración de Redis que el prod de la P1, sin volumen porque es una caché (los datos auténticos están en PostgreSQL) y con contraseña aunque esté en una red interna.
- **Pruebas:** primero, `mkdir` y `cp` lanzados desde `envs/prod` crearon una carpeta en un sitio equivocado (vacía; se borró con `rmdir`, que solo borra carpetas vacías). Después, los tres ficheros no se habían guardado. Al final, los cuatro ficheros del módulo están correctos, en LF y sin cambios de `fmt`. El módulo aún no se usa, así que los `plan` no cambian.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Presentó el paso 2.3, dio el módulo explicado (configuración tomada del `docker-compose.prod.yml` de la P1), detectó la carpeta equivocada y los ficheros sin guardar, y repasó qué es cada fichero de un módulo. El usuario creó los ficheros.
- **Commit:** irá con la activación en prod, en el subpaso 2.3.2 (`feat: add Redis cache module and enable it only in prod`).

### [Subpaso 2.3.2: Activar la caché solo en prod y conectarla a la web]
- **Fecha:** 20 nov. 2026
- **Archivos:**
  - `terraform/modules/web/variables.tf`: `cache_activada` (`bool`), `cache_host` y `cache_password` (`sensitive`), las tres con `default`.
  - `terraform/modules/web/main.tf`: el `env` de la web añade `CACHE_ENABLED=true`, `CACHE_HOST` y `REDIS_PASSWORD` **solo si** `cache_activada` (`concat(..., var.cache_activada ? [...] : [])`).
  - `terraform/envs/{dev,prod}/variables.tf`: `cache_activada` (sin `default`) y `redis_password` (`sensitive`, `default = ""`).
  - `terraform/envs/{dev,prod}/main.tf` (idénticos): `module "cache"` con `count = var.cache_activada ? 1 : 0`, y en `module "web"` las líneas `cache_activada`, `cache_host = var.cache_activada ? module.cache[0].host : ""` y `cache_password`.
  - `terraform.tfvars`: dev `cache_activada = false`, prod `true`. `envs/prod/secrets.auto.tfvars` (fuera de Git) con `redis_password` nuevo; las dos plantillas `.example` con la línea de `redis_password`.
  - En `docs/`: dudas sobre el módulo `cache`, por qué se toca dev (código presente pero apagado) y dónde hace falta `apply`.
- **Comandos:** `cp terraform/envs/dev/{variables,main}.tf terraform/envs/prod/`, `openssl rand -base64 24`, `terraform fmt`, `terraform init` (registra el módulo `cache`), `terraform validate`, `terraform plan` en los dos, `terraform apply` en prod.
- **Justificación:** el mismo código da infraestructuras distintas según un valor del `tfvars`. `count` crea el módulo 0 o 1 veces y, con `count`, el módulo pasa a ser una lista (`module.cache[0]`), así que su salida se usa con una condición. Las variables de caché solo se añaden al `env` si está activada, para que la web de dev no se recree.
- **Pruebas:** `main.tf`, `variables.tf` y el resto de `.tf` idénticos en dev y prod (`cmp`); los secretos de prod, entre comillas, con `redis_password` distinta de `db_password` (comparado sin leerlos). `plan` de dev: «No changes». `plan` de prod (previsto y obtenido): `+ module.cache[0].docker_image.redis`, `+ module.cache[0].docker_container.cache`, `module.web.docker_container.web must be replaced` (`env` forces replacement): `Plan: 3 to add, 0 to change, 1 to destroy.` Aplicado en prod.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Diseñó el `count` y el `env` condicional para no tocar dev, dio el código por partes y explicó por qué se edita dev, qué significa `module.cache[0]` y dónde hace falta `apply`; revisó ficheros, secretos (sin leerlos) y los dos `plan`. El usuario escribió los cambios, la contraseña de Redis y ejecutó el `apply`.
- **Commit:** `feat: add Redis cache module and enable it only in prod`.

### [Subpaso 2.3.3: Comprobar la caché en prod y que dev no cambia]
- **Fecha:** 20 nov. 2026
- **Archivos:** ninguno.
- **Comandos:** `docker ps -a`, `curl` a `/status`, `docker inspect tracker-prod-cache` (redes, usuario, puertos, reinicio), `docker exec tracker-prod-cache redis-cli ping` (sin contraseña), `curl -D -` a `/moves` y `/species/6/learnset` en los dos entornos, `terraform plan` y `state list` en los dos, tests de la API en los dos y la web de prod en el navegador.
- **Justificación:** demostrar que prod tiene la caché funcionando y protegida, y que dev, con el mismo código y la caché apagada, sigue igual.
- **Pruebas:**
  - **Contenedor:** `tracker-prod-cache` `Up (healthy)`, solo en `tracker-prod-backend`, usuario `redis`, sin puertos publicados (`6379/tcp` solo expuesto) y `unless-stopped`. `redis-cli ping` sin contraseña responde `NOAUTH Authentication required.`. No existe `tracker-dev-cache`.
  - **Estado de la app:** `/status` de prod `{"estado":"ok","db":"ok","cache":"ok"}`, de dev `"cache":"no aplica"`; la web de prod muestra «Caché: conectada».
  - **MISS → HIT:** `/moves` tres veces en prod: `X-Cache: MISS`, `HIT`, `HIT` (TTL 3600). En dev: `X-Cache: OFF`. `/species/6/learnset` en prod: `MISS` en 18,6 ms y `HIT` en 1,3 ms; en dev, `OFF` en 14,5 y 10,5 ms.
  - **Terraform:** los dos `plan` en «No changes»; dev con 8 recursos en su estado y prod con 10 (los 8 de siempre más los 2 de la caché). `preparar-db` de prod no se volvió a ejecutar (misma imagen).
  - **Tests:** `51 passed` en dev (4,55 s) y en prod (4,54 s).
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Buscó las rutas que usan la caché y ejecutó todas las comprobaciones y los tests. El usuario había hecho el `apply` de prod.
- **Commit:** `docs: log Redis cache in prod with MISS/HIT checks`.

### [Subpaso 2.4.1: Makefile]
- **Fecha:** 20 nov. 2026
- **Archivos:** `Makefile` (nuevo, en la raíz): `ENV ?= dev`, `TF := terraform -chdir=terraform/envs/$(ENV)`; objetivos `help` (por defecto; lee los comentarios `##`), `comprobar-env` (solo `dev` o `prod`), `init`, `fmt`, `validate`, `plan` (`-out=plan.tfplan`), `apply` (aplica el plan guardado y lo borra), `destroy`, `output`, `ps` y `test` (tests de la API en un contenedor de un solo uso en la red `frontend` del entorno). En `docs/`: concepto «Makefile».
- **Comandos:** `nano Makefile`, `ls -l Makefile`, `grep -n '^ ' Makefile`, `make`.
- **Justificación:** todo se lanza desde la raíz con `make <comando> ENV=dev|prod`; `-chdir` evita los errores de carpeta. `plan -out` + `apply plan.tfplan` aplica exactamente lo revisado, y el plan (con secretos en claro) está en `.gitignore` y se borra tras el `apply`. `destroy` sigue pidiendo confirmación.
- **Pruebas:** al principio, `make` respondía «No targets» porque el fichero estaba vacío (0 bytes: el contenido no se había guardado). Una vez guardado (1932 bytes), en LF, con las 17 líneas de receta empezando por tabulador y ninguna por espacios, `make` muestra la ayuda con los 10 comandos. `plan.tfplan` queda ignorado por Git.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Dio el Makefile explicado (estilo de ayuda tomado del de la P1), el método para comprobar y corregir los tabuladores, detectó el fichero vacío y comparó los objetivos con los de la P1. El usuario creó y guardó el fichero.
- **Commit:** `feat: add Makefile to run Terraform and tests per environment` (tras el subpaso 2.4.2).

### [Subpaso 2.4.2: Probar el Makefile desde la raíz]
- **Fecha:** 20 nov. 2026
- **Archivos:** ninguno (el plan guardado se crea y se borra solo).
- **Comandos:** `make validate ENV=dev`, `make plan ENV=prod`, `make apply ENV=prod`, `make output ENV=prod`, `make ps ENV=prod`, `make test ENV=dev`, `make plan ENV=produccion`.
- **Justificación:** comprobar que todo el ciclo de trabajo (validar, planificar, aplicar, consultar y probar) se lanza desde la raíz para cualquiera de los dos entornos, que es lo que pide el enunciado con el Makefile.
- **Pruebas:** `validate` de dev: «Success!». `plan` de prod: «No changes» (lo ejecuta como `terraform -chdir=terraform/envs/prod plan -out=plan.tfplan`). `apply` de prod: `Apply complete! Resources: 0 added, 0 changed, 0 destroyed.` y `url = "http://127.0.0.1:8200"`; el `plan.tfplan` se borró después. `output`: la URL. `ps`: web, caché y base de datos de prod `healthy` y `preparar-db` `Exited (0)`. `test` de dev: `51 passed in 4.47s`. `ENV=produccion`: «ENV debe ser dev o prod (has puesto 'produccion')» y error antes de ejecutar nada. Hubo un aviso `make: getcwd: No such file or directory`, propio de la terminal (carpeta actual no válida), no del Makefile.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Propuso las pruebas con sus predicciones, comprobó que el plan guardado se borra y explicó cada comando y cómo usarlo (documentado en conceptos). El usuario ejecutó todos los comandos.
- **Commit:** `feat: add Makefile to run Terraform and tests per environment` (Makefile) y `docs: log Makefile and close modules and environments phase` (docs).

### [Paso 3.0: Ordenar la carpeta de la aplicación]
- **Fecha:** 20 nov. 2026
- **Archivos:** `app/datos/` (los 11 `.csv`, movidos), `app/db/schema.sql` (movido) y `app/main.py` (rutas a los ficheros de datos).
- **Comandos:** `git mv *.csv datos/`, `git mv schema.sql db/`, `make plan/apply/test ENV=dev` y lo mismo con `ENV=prod`.
- **Justificación:** `app/` mezclaba código, datos y esquema; separarlos deja el código a la vista antes de los cambios de la fase 3. Se descartó convertir el código en paquete (`src/`), porque obligaba a cambiar los `import` y el `CMD` del Dockerfile sin aportar nada a la infraestructura.
- **Pruebas:** las 12 rutas nuevas apuntan a ficheros que existen y ningún otro fichero (tests, Terraform, Makefile, Dockerfile) usaba los CSV por su ruta. `plan` de dev: `3 to add, 0 to change, 3 to destroy` (imagen, `preparar_db` y web, porque cambia el hash de `app/`; la base de datos y su volumen no se tocan). Tras el `apply`, `51 passed` en dev y en prod.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). A petición del usuario, propuso la estructura, movió los ficheros con `git mv` (conservan el historial), cambió las rutas de `main.py` (`Path(__file__).with_name(...)` → `DATOS / "..."`) y lanzó el `plan` de dev. El usuario aplicó y pasó los tests en los dos entornos.
- **Commit:** `refactor: move app CSV data and SQL schema into subfolders`

### [Subpaso 3.1.1: Que la app diga qué instancia responde]
- **Fecha:** 21 nov. 2026
- **Archivos:** `app/main.py` (variable `INSTANCIA`, campo `instancia` en `/status` y cabecera `X-Instancia` en el middleware), `app/static/index.html` (etiqueta `estado-instancia`), `app/static/app.js` (la rellena en cada consulta a `/status`) y `terraform/modules/web/main.tf` (`INSTANCIA=${var.prefijo}-web` en el `env` de la web).
- **Comandos:** `make plan ENV=dev`, `make apply ENV=dev`, `curl -sI http://127.0.0.1:8100/status`, `make test ENV=dev`.
- **Justificación:** con varias réplicas detrás de Nginx todas responden igual; para demostrar el reparto (fase 3.2) cada respuesta debe decir quién la sirvió. El nombre lo pone Terraform, que sabe cuántas réplicas hay; el *hostname* (id del contenedor) queda solo como reserva.
- **Pruebas:** `plan`: `3 to add, 0 to change, 3 to destroy` (imagen, `preparar_db` y web, por el cambio en `app/`). `/status` devuelve `"instancia":"tracker-dev-web"`; la cabecera `x-instancia: tracker-dev-web` sale también en `/moves`, no solo en `/status`; la página incluye el `span` de la etiqueta. `51 passed` en dev. Prod se actualizará en el 3.1.2.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Explicó el objetivo de la fase y dio el código por partes; en la revisión detectó la cabecera dentro del `if` (solo salía en HTML/JS/CSS), el `span` entre el punto y el texto de la caché y la clase `pista` (gris sobre la cabecera), y a petición del usuario los corrigió y separó el commit de la reorganización. El usuario escribió el resto del código y aplicó.
- **Commit:** `feat: show which web instance served each response`

### [Subpaso 3.1.2: Varias webs con count]
- **Fecha:** 21 nov. 2026
- **Archivos:** `terraform/modules/web/variables.tf` (`replicas`, con validación `>= 1`), `terraform/modules/web/main.tf` (`count = var.replicas`, nombre e `INSTANCIA` `${prefijo}-web-${count.index + 1}`, puerto `var.puerto + count.index`), `terraform/modules/web/outputs.tf` (`urls` y `nombres`), `terraform/envs/{dev,prod}/variables.tf`, `main.tf`, `outputs.tf` y `terraform.tfvars` (`replicas_web = 2` en dev y `3` en prod) y `Makefile` (`make test` contra `tracker-$(ENV)-web-1`).
- **Comandos:** `make plan`, `make apply`, `make ps`, `curl -sI http://127.0.0.1:<puerto>/status` y `make test`, en dev y en prod.
- **Justificación:** el enunciado pide 2 webs en dev y 3 o más en prod; con `count` el número de réplicas es un valor del `tfvars` y el código del módulo es el mismo. El puerto por réplica es temporal, para probarlas una a una hasta que Nginx sea el único que publique (3.2.3).
- **Pruebas:** `plan` de dev: `2 to add, 0 to change, 1 to destroy`, con `web[0]` «moved from web» (moved implícito al añadir `count`) y reemplazado por el cambio de nombre. `plan` de prod: `5 to add, 0 to change, 3 to destroy` (también imagen y `preparar_db`, que aún no tenían el 3.1.1). Tras el `apply`, todas las réplicas `healthy` (8100-8101 en dev y 8200-8202 en prod), cada puerto con su cabecera (`x-instancia: tracker-dev-web-1`, `-2`; `tracker-prod-web-1`, `-2`, `-3`), PostgreSQL y Redis sin tocar («Up 28 hours») y `51 passed` en los dos entornos.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Explicó `count`, `count.index`, `for` y *splat*, el moved implícito y por qué reemplazar una web no pierde datos; a petición del usuario escribió los cambios y generó los planes de los dos entornos. El usuario aplicó y ejecutó las pruebas.
- **Commit:** `feat: run several web replicas per environment with count`

### [Subpaso 3.1.3: Comprobar las réplicas una a una]
- **Fecha:** 21 nov. 2026
- **Archivos:** ninguno.
- **Comandos:** los de prueba del 3.1.2 (`make ps`, `curl -sI` a cada puerto, `make test`).
- **Justificación:** antes de poner Nginx delante hay que saber que cada réplica funciona por sí sola; si algo falla después, el problema estará en el balanceador y no en las webs.
- **Pruebas:** las del 3.1.2: 2 réplicas en dev y 3 en prod, todas `healthy`, cada una con un nombre distinto y `51 passed` en los dos entornos.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Dio los comandos y lo esperado; el usuario los ejecutó.
- **Commit:** va en `feat: run several web replicas per environment with count`.

### [Subpaso 3.2.1: Elegir balanceador y política de reparto]
- **Fecha:** 21 nov. 2026
- **Archivos:** `docs/hoja-de-ruta.md` (decisión), `docs/conceptos-para-estudiar.md` (conceptos «Balanceador de carga» y «Política de reparto»).
- **Comandos:** ninguno (subpaso de decisión).
- **Justificación:** **Nginx** con **round-robin**. Nginx reparte y, en la fase 4, servirá `/sprites/` desde MinIO sin exponerlo, con un `nginx.conf` que genera Terraform; round-robin encaja con peticiones cortas, réplicas idénticas y una app sin estado.
- **Pruebas:** no aplica. Alternativas valoradas y descartadas: HAProxy (comprobación activa de las webs, pero no sirve ficheros: haría falta otra pieza), Traefik (necesita el socket de Docker, equivalente a *root*, y duplica lo que decide Terraform), least_conn (igual con esta carga; una línea si hiciera falta), ip_hash (no hay sesiones en memoria y ocultaría el reparto en las pruebas) y weight (réplicas iguales).
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Comparó los tres balanceadores y las cuatro políticas con sus argumentos y recomendó Nginx con round-robin; el usuario tomó la decisión.
- **Commit:** `docs: choose Nginx with round-robin as load balancer`

### [Subpaso 3.2.2: Módulo balanceador con Nginx]
- **Fecha:** 21 nov. 2026
- **Archivos:** `terraform/modules/balanceador/` (`versions.tf`, `variables.tf`, `nginx.conf.tftpl`, `main.tf`, `outputs.tf`) y el bloque `module "balanceador"` en `terraform/envs/dev/main.tf` y `terraform/envs/prod/main.tf`.
- **Comandos:** `make init`, `make plan`, `make apply` y `make ps` en los dos entornos; `docker exec tracker-<env>-balanceador wget -qS -O /dev/null http://127.0.0.1/status` en bucle.
- **Justificación:** Nginx (`nginx:1.28-alpine`, solo en `frontend`) reparte por turnos entre las réplicas; su `upstream` lo genera Terraform con `templatefile` a partir de `module.web.nombres` y lo mete con `upload`, así que cambiar `replicas_web` cambia la configuración sola. Aún sin puerto publicado: la puerta pasa de las webs a Nginx en el 3.2.3.
- **Pruebas:** `fmt`, `init` y `validate` correctos; `plan`: `2 to add, 0 to change, 0 to destroy` en cada entorno (imagen y contenedor de Nginx; las webs, la BD y Redis no se tocan). La configuración generada para prod tiene las 3 líneas `server tracker-prod-web-N:8000 resolve;`. Tras el `apply`, `tracker-<env>-balanceador` `healthy` con `80/tcp` (expuesto, no publicado). Rotación desde dentro: dev `web-1, web-2, web-1, web-2`; prod `web-3, web-1, web-2, web-3, web-1, web-2` (round-robin; el turno no tiene por qué empezar en `web-1`).
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). A petición del usuario, escribió el módulo y lo conectó en los dos entornos, generó los planes, revisó la configuración generada y documentó el funcionamiento de Nginx en conceptos. El usuario aplicó y ejecutó las pruebas.
- **Commit:** `feat: add Nginx load balancer module with round-robin upstream`

### [Subpaso 3.2.3: Solo Nginx publica puerto]
- **Fecha:** 21 nov. 2026
- **Archivos:** `terraform/modules/web/` (sin bloque `ports`, sin variable `puerto` y sin salida `urls`; queda `nombres`), `terraform/modules/balanceador/` (variable `puerto`, bloque `ports` `127.0.0.1:<puerto> → 80` y salida `url`), `terraform/envs/{dev,prod}/main.tf`, `outputs.tf` y `variables.tf` (`puerto_web` pasa al balanceador; salida única `url`) y `Makefile` (`make test` contra `http://tracker-$(ENV)-balanceador`).
- **Comandos:** `make plan`, `make apply`, `make ps`, `curl -sI http://127.0.0.1:<puerto>/status` en bucle, `curl` al puerto antiguo de una réplica y `make test`, en los dos entornos.
- **Justificación:** exposición mínima: una sola puerta de entrada por entorno (Nginx, solo en `127.0.0.1`), para que nadie pueda saltarse el balanceador y todo el tráfico pase por él. La dirección para el usuario no cambia (8100 y 8200); cambia quién hay detrás.
- **Pruebas:** `plan`: dev `3 to add, 0 to change, 3 to destroy` y prod `4 to add, 0 to change, 4 to destroy` (cambiar los puertos de un contenedor obliga a recrearlo). Terraform creó Nginx después de las webs (depende de `module.web.nombres`), con el puerto ya libre, sin «port is already allocated». `ps`: solo el balanceador con `127.0.0.1:8100->80/tcp` (prod `8200`); las webs `8000/tcp`, sin publicar. El puerto antiguo de una réplica (8101, 8201) da `000`. `51 passed` en los dos entornos a través de Nginx. PostgreSQL y Redis sin tocar.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Explicó el cambio y el orden de creación; a petición del usuario lo escribió, validó y generó los planes. El usuario aplicó y ejecutó las pruebas.
- **Commit:** `feat: publish only Nginx and route tests through the load balancer`

### [Subpaso 3.2.4: Comprobar el reparto desde fuera]
- **Fecha:** 21 nov. 2026
- **Archivos:** ninguno.
- **Comandos:** `for i in 1 2 3 4; do curl -sI http://127.0.0.1:8100/status | grep -i instancia; done` (prod: 6 vueltas contra 8200).
- **Justificación:** demostrar con la cabecera `X-Instancia` que Nginx reparte por turnos entre todas las réplicas, ahora entrando como un usuario, por la única puerta.
- **Pruebas:** dev `web-2, web-1, web-2, web-1`; prod `web-3, web-2, web-1, web-3, web-2, web-1`. Cada réplica recibe su turno y el ciclo se repite (round-robin; el orden de partida depende del orden en que Nginx resuelve las direcciones).
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Dio los comandos y lo esperado; el usuario los ejecutó.
- **Commit:** va en `feat: publish only Nginx and route tests through the load balancer`.

### [Subpaso 3.3.1: Conmutación por error en Nginx]
- **Fecha:** 21 nov. 2026
- **Archivos:** `terraform/modules/balanceador/nginx.conf.tftpl` (`max_fails=2 fail_timeout=10s` en cada `server`; `proxy_next_upstream error timeout http_502 http_504`, `proxy_next_upstream_tries 3` y `proxy_connect_timeout 2s` en `location /`).
- **Comandos:** `make plan` y `make apply` en los dos entornos; `make ps`, `curl -sI http://127.0.0.1:<puerto>/status` en bucle y `make test`.
- **Justificación:** alta disponibilidad con la comprobación pasiva de Nginx: si una web no responde, la petición se reintenta en otra y la web queda apartada 10 s. No se reintenta con 503 (la app lo devuelve cuando falla la BD, común a todas) ni peticiones `POST`/`PATCH` ya enviadas (no duplicar datos). El reinicio automático ya lo daba `restart = "unless-stopped"`.
- **Pruebas:** `plan`: `1 to add, 0 to change, 1 to destroy` en cada entorno (solo Nginx, porque cambia el contenido de `upload`); la configuración generada para prod tiene las 3 webs con `max_fails` y `fail_timeout`. Tras el `apply`, el balanceador `healthy`, las webs sin tocar («Up 11 minutes»), las placas siguen rotando (dev `2, 1, 2, 1`; prod `3, 1, 2, 3, 1, 2`) y `51 passed` en los dos entornos. La prueba de tumbar una web es el 3.3.2.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Explicó la comprobación pasiva, cada directiva y por qué no se reintenta con 503; a petición del usuario lo escribió, validó y generó los planes, y lo documentó en conceptos («Alta disponibilidad»). El usuario aplicó y ejecutó las pruebas de prod; Claude repitió la de dev.
- **Commit:** `feat: add Nginx failover with retries and passive health checks`

### [Subpaso 3.3.2: Tumbar una web y comprobar la alta disponibilidad]
- **Fecha:** 21 nov. 2026
- **Archivos:** `Makefile` (variables `SERVICIO ?= balanceador` y `WEB ?= 1`; objetivos `logs`, `stop-web` y `start-web`, con `comprobar-env`; descripción de `test` «a través de Nginx»).
- **Comandos:** `make stop-web ENV=prod WEB=2`, `make ps ENV=prod`, 9 peticiones con `curl -s -o /dev/null -D - http://127.0.0.1:8200/status`, `make test ENV=prod`, `make logs ENV=prod SERVICIO=balanceador`, `make start-web ENV=prod WEB=2` y 6 peticiones más.
- **Justificación:** demostrar la alta disponibilidad del 3.3.1 con una caída real: el usuario no debe notar que falta una réplica, y la réplica debe volver al reparto sola al arrancar. `docker stop` + `unless-stopped`: Docker no la resucita, así que la prueba es limpia.
- **Pruebas:** con `web-2` en `Exited (0)`, las 9 peticiones dieron `200 OK`, alternando solo `web-3` y `web-1`; `51 passed` con 2 de 3 webs. En el log de Nginx, `tracker-prod-web-2 could not be resolved (3: Host not found)`: Docker quitó el nombre de su DNS y Nginx, con `resolve`, la sacó del reparto. En el mismo log, un `413` de 64 bytes (respuesta JSON de la app al test de un guardado demasiado grande, no la página de Nginx: `client_max_body_size 6m` deja pasar el cuerpo y decide la app) y el aviso de cuerpo guardado en fichero temporal (normal en peticiones grandes). Tras `make start-web` y 15 s, `web-2` volvió al turno (`3, 1, 2, 3, 1, 2`) sin tocar Nginx. Después, `plan` de prod: «No changes» (sin deriva).
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Diseñó la prueba con sus predicciones y, a petición del usuario, escribió los objetivos del Makefile y los comprobó con `make -n`; interpretó el log de Nginx y comprobó que no quedaba deriva. El usuario ejecutó la prueba.
- **Commit:** `feat: add Makefile targets to stop, start and inspect containers`

### [Subpaso 3.4.1: Caché compartida entre réplicas e invalidación]
- **Fecha:** 21 nov. 2026
- **Archivos:** ninguno (prueba sin cambios de código).
- **Comandos:** contra prod (`http://127.0.0.1:8200`): `POST /runs` (partida de prueba), 3 × `GET /runs/<id>/team` mirando `X-Cache`, `X-Latency-Ms` y `X-Instancia`, `POST /runs/<id>/events` (una captura), otras 3 lecturas y `DELETE /runs/<id>`.
- **Justificación:** con varias réplicas, la caché solo sirve si es común: lo que guarda una web debe valer para las demás y la invalidación de una debe valer para todas. Por eso Redis es un contenedor aparte y no una caché en memoria de cada web.
- **Pruebas:** antes de la captura: `MISS` en `web-1` (12,2 ms), `HIT` en `web-2` (0,9 ms) y en `web-3` (1,0 ms). Captura registrada en `web-1` (`201`). Después: `MISS` en `web-2` (10,8 ms), `HIT` en `web-3` y `web-1`, y el equipo ya con `['Pikachu']`. Partida borrada (`204`).
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Explicó la caché compartida y, a petición del usuario, ejecutó la prueba y documentó los resultados.
- **Commit:** va en `feat: add Makefile targets to stop and start Redis` (con el 3.4.2).

### [Subpaso 3.4.2: Redis caído con varias réplicas]
- **Fecha:** 21 nov. 2026
- **Archivos:** `Makefile` (objetivos `stop-cache` y `start-cache`; columna de la ayuda más ancha para los nombres largos).
- **Comandos:** `make stop-cache ENV=prod`, lecturas de `/moves` con `curl -w "%{time_total}"`, `/status` de cada réplica, `make test ENV=prod`, escrituras (`POST /runs/<id>/events`) cronometradas, `make start-cache ENV=prod`.
- **Justificación:** comprobar que la caída de Redis no tumba la aplicación (Redis es una mejora, no una dependencia) y volver a medir el retraso de ~8 s de la P1, como estaba previsto en las mejoras detectadas.
- **Pruebas:** con Redis, `HIT` en ~17-28 ms. Con Redis parado: todas las respuestas `200` con `X-Cache: DEGRADED`; `/status` de las 3 réplicas `"estado":"degraded"`, `"cache":"caida"`. La primera lectura de cada réplica tardó 2,59 s, 1,70 s y 1,70 s, y las siguientes ~25 ms (el vigilante ya la había marcado como caída). `51 passed`, pero en **207,59 s** (normalmente ~5 s): cada escritura tarda ~1,7 s con Redis parado (1,68 s y 1,71 s medidas, frente a 0,018 s con Redis), porque `invalidar_equipo` intenta `cache.delete` sin mirar `cache_estado` y la búsqueda DNS del contenedor parado no la corta `socket_connect_timeout`. Con `make start-cache`, Redis `healthy` en 6 s, `/status` `"ok"`, y `/moves` `MISS` y después `HIT` (vuelve vacío, sin persistencia); las escrituras vuelven a 0,017 s.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). A petición del usuario, escribió los objetivos del Makefile, ejecutó la prueba, detectó la lentitud de las escrituras y la confirmó con una medición aislada; lo documentó en conceptos y en la hoja de ruta.
- **Commit:** `feat: add Makefile targets to stop and start Redis`

### [Subpaso 3.4.3: Escrituras rápidas con Redis caído]
- **Fecha:** 21 nov. 2026
- **Archivos:** `app/main.py` (`invalidar_equipo`: `if cache is None or cache_estado != "ok": return`, con comentario del motivo).
- **Comandos:** `make plan` y `make apply` en los dos entornos; la medición del 3.4.2 repetida (escrituras cronometradas y `make test ENV=prod` con `make stop-cache` / `make start-cache`); `make test` en dev y prod y `plan` final.
- **Justificación:** con Redis caído, cada escritura esperaba ~1,7 s intentando borrar una clave en un Redis que la app ya sabía caído. Ahora la invalidación sigue la misma regla que las lecturas. Es seguro porque Redis no tiene persistencia: al volver está vacío.
- **Pruebas:** `plan`: dev `4 to add, 0 to change, 4 to destroy` y prod `5 to add, 0 to change, 5 to destroy` (imagen, `preparar_db` y webs; Nginx no se recreó y siguió repartiendo entre las webs nuevas gracias a `resolve`: `web-2, web-3, web-1`). Con Redis parado: escrituras `201` en 0,016 / 0,014 / 0,013 s (antes 1,68-1,71 s), lecturas ~0,024 s y `51 passed in 4.91s` (antes 207,59 s). Con Redis de vuelta: `/moves` `MISS` y después `HIT`, `/status` `"ok"`, `51 passed` en prod (4,83 s) y en dev (4,80 s), y `plan` «No changes» en los dos entornos.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Detectó la causa en el 3.4.2, propuso la corrección y, con el visto bueno del usuario, la escribió y generó los planes; volvió a medir tras el `apply` del usuario y lo documentó.
- **Commit:** `fix: skip Redis invalidation while the cache is marked as down`

### [Subpaso 4.1.1: Elegir la imagen de MinIO]
- **Fecha:** 24 nov. 2026
- **Archivos:** `docs/hoja-de-ruta.md` (decisión y subpasos de la fase 4), `docs/conceptos-para-estudiar.md` (dudas sobre MinIO).
- **Comandos:** `docker manifest inspect` de las imágenes candidatas; consulta de la API de Docker Hub para `minio/minio`; `docker buildx imagetools inspect cgr.dev/chainguard/minio:latest` (huella y configuración, sin descargar la imagen); `curl` a `/sprites/25.png` en prod.
- **Justificación:** el enunciado prefiere MinIO, pero su imagen oficial ya no existe. Se elige **`cgr.dev/chainguard/minio`**, que es MinIO compilado desde su código público (AGPL) y mantenido por Chainguard, fijado por su huella para que la versión no cambie.
- **Pruebas:** `minio/minio` en Docker Hub: 404 en la API y `denied` en el manifiesto; `quay.io/minio/minio:latest`: «no such manifest». Disponibles: `cgr.dev/chainguard/minio`, `bitnamilegacy/minio`, `pgsty/minio`, `dxflrs/garage`, `chrislusf/seaweedfs` y `rustfs/rustfs`. Chainguard: huella `sha256:f2e56aceb4d38ad9b05c901270946e2353b19f86ba4396f25cf75b15b455b38c`, construida el 24 nov. 2026, `amd64` y `arm64`, punto de entrada `/usr/bin/minio`, usuario 65532 (no *root*). Situación de partida: `/sprites/25.png` en prod da 404.
- **Asistencia de IA:** Claude Code (Claude Opus 5.5). Comprobó qué imágenes existen, buscó qué pasó con MinIO, comparó las alternativas y explicó las dudas (qué es MinIO, diferencia con un volumen y con una base de datos, licencia); el usuario tomó la decisión.
- **Commit:** `docs: choose Chainguard MinIO image and plan storage phase`

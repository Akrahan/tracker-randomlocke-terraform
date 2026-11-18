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

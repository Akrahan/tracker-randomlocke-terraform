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

# Conceptos para estudiar: Práctica 2 (Terraform)

Conceptos necesarios para entender y defender la práctica, ordenados por temas.

## Índice

1. [Terraform](#terraform)
   - [Infraestructura como código (IaC) y Terraform](#infraestructura-como-código-iac-y-terraform)
   - [Provider](#provider)
   - [Estado y ciclo plan/apply (idempotencia)](#estado-y-ciclo-planapply-idempotencia)
   - [Estructura de ficheros y directorio raíz (root module)](#estructura-de-ficheros-y-directorio-raíz-root-module)
2. Docker
3. Red y balanceo
4. Alta disponibilidad
5. Monitorización y logs
6. Almacenamiento
7. Automatización
8. [Seguridad](#seguridad)
   - [Exposición mínima y proxy inverso](#exposición-mínima-y-proxy-inverso)
   - [.gitignore: qué no se sube y patrones de exclusión](#gitignore-qué-no-se-sube-y-patrones-de-exclusión)
   - [Autenticación con GitHub: Git Credential Manager](#autenticación-con-github-git-credential-manager)

---

## Terraform

### Infraestructura como código (IaC) y Terraform
- **Qué es:** IaC es describir la infraestructura (redes, máquinas, contenedores, volúmenes...) en ficheros de texto en lugar de crearla a mano. Terraform es una herramienta de HashiCorp que lee esos ficheros (`.tf`, en lenguaje HCL) y crea, cambia o borra los recursos para que la realidad coincida con lo escrito. Es **declarativo**: dices *qué* quieres tener, no *los pasos* para conseguirlo.
- **Para qué se usa:** repetir un despliegue idéntico tantas veces como haga falta (dev, prod, otra máquina), versionarlo en Git, revisarlo antes de aplicarlo (`terraform plan`) y evitar errores manuales.
- **Dónde y cómo se usa en mi proyecto:** en `terraform/` (paso 1.1 en adelante). Ciclo básico: `terraform init` (descarga providers), `terraform plan` (muestra qué cambiaría), `terraform apply` (lo aplica) y `terraform destroy` (lo borra todo).
- **Por qué así:** lo pide el enunciado. Frente a Docker Compose (Práctica 1), Terraform guarda un **estado** con lo que ha creado, calcula diferencias y sirve igual para Docker que para una nube real (AWS, Azure...), cambiando solo el provider. Alternativas: Pulumi (IaC con lenguajes de programación), OpenTofu (bifurcación libre de Terraform, casi idéntica), Ansible (más orientado a configurar máquinas que a crear recursos, y de estilo más imperativo).
- **Pregunta de defensa:** ¿qué diferencia hay entre un enfoque declarativo como Terraform y uno imperativo como un script de `docker run`?

### Provider
- **Qué es:** un plugin que traduce los recursos de Terraform a llamadas a la API de un sistema concreto. Terraform por sí solo no sabe crear nada; el provider de Docker sabe hablar con el motor de Docker, el de AWS con AWS, etc.
- **Para qué se usa:** separar el núcleo de Terraform (estado, plan, dependencias) de cada plataforma. Se declara en el bloque `terraform { required_providers { ... } }` y `terraform init` lo descarga del Terraform Registry a la carpeta `.terraform/`.
- **Dónde y cómo se usa en mi proyecto:** el provider `kreuzwerker/docker` (versión fijada con `~> 3.0`). Terraform se ejecuta en WSL (Ubuntu) y llega al motor de Docker Desktop por el socket Unix `unix:///var/run/docker.sock` gracias a la integración con WSL. Si se ejecutase desde Windows, usaría la tubería con nombre `npipe:////./pipe/docker_engine`.
- **Por qué así:** el enunciado pide simular la nube con Docker. Se fija la versión para que el despliegue sea reproducible (un `init` futuro no baja una versión mayor con cambios incompatibles); el fichero `.terraform.lock.hcl` deja anotada la versión exacta y sí se sube a Git.
- **Pregunta de defensa:** si mañana quisieras desplegar esto en AWS, ¿qué parte de tu código Terraform cambiaría y cuál no?

### Estado y ciclo plan/apply (idempotencia)
- **Qué es:** el **estado** (`terraform.tfstate`) es el fichero donde Terraform apunta qué recursos ha creado y con qué atributos. `plan` compara tres cosas: lo que pide el código, lo que dice el estado y lo que hay de verdad (la consulta al provider), y propone acciones: `+` crear, `~` cambiar, `-` destruir, `-/+` reemplazar. `apply` ejecuta esas acciones y actualiza el estado. **Idempotencia** significa que aplicar dos veces el mismo código no cambia nada la segunda vez.
- **Para qué se usa:** el estado permite a Terraform saber qué es suyo (para cambiarlo o destruirlo) y calcular solo las diferencias, en lugar de recrearlo todo. El `plan` sirve para revisar los cambios antes de hacerlos.
- **Dónde y cómo se usa en mi proyecto:** en la prueba del paso 0.2, el primer `plan` dio `1 to add` (estado vacío), y tras el `apply` el segundo dio «No changes» porque código, estado y realidad coincidían. Habrá un estado por entorno (`envs/dev` y `envs/prod`), así que destruir uno no toca el otro. Con `terraform plan -out=plan.tfplan` y `terraform apply plan.tfplan` se aplica exactamente lo revisado.
- **Por qué así:** el estado guarda valores en claro, contraseñas incluidas, así que **nunca va a Git** (`.gitignore`). En equipos se guarda en un *backend* remoto con bloqueo (por ejemplo S3 con bloqueo); aquí basta el estado local porque solo trabaja una persona. El `.terraform.lock.hcl` (versiones de los providers) sí va a Git; la carpeta `.terraform/` (los binarios descargados) no.
- **Pregunta de defensa:** si borras a mano un contenedor con `docker rm` y luego haces `terraform plan`, ¿qué mostrará y por qué?

### Estructura de ficheros y directorio raíz (root module)
- **Qué es:** Terraform lee **todos los `.tf` de la carpeta donde se ejecuta** y los trata como un solo conjunto; el nombre de cada fichero no importa para Terraform, solo para las personas. Esa carpeta es el **root module** y tiene su propio `.terraform/`, su lock y su estado. Por convención se reparte así: `versions.tf` (versión de Terraform y providers), `providers.tf` (configuración del provider), `main.tf` (recursos), `variables.tf` (entradas), `outputs.tf` (salidas) y `terraform.tfvars` (valores).
- **Para qué se usa:** encontrar rápido cada cosa y separar entornos: cada carpeta raíz es un despliegue independiente con su estado.
- **Dónde y cómo se usa en mi proyecto:** `terraform/envs/dev/` es el root module de dev (y en la fase 2 lo será `terraform/envs/prod/`). Los comandos se ejecutan dentro de esa carpeta (`cd terraform/envs/dev && terraform init`) o con `terraform -chdir=terraform/envs/dev init`, que es lo que usará el Makefile. Las piezas reutilizables irán en `terraform/modules/`.
- **Por qué así:** una carpeta por entorno da **estados separados**: un `destroy` en dev no puede tocar prod. Alternativa descartada: *workspaces* de Terraform (un mismo directorio con varios estados), que son más fáciles de confundir («¿en qué workspace estoy?») y no permiten diferencias de estructura entre entornos. `required_version` y la versión del provider se fijan para que el despliegue sea reproducible.
- **Pregunta de defensa:** si escribes un recurso en `outputs.tf` en lugar de `main.tf`, ¿funciona? ¿Por qué se separan entonces en varios ficheros?

## Seguridad

### Exposición mínima y proxy inverso
- **Qué es:** exponer al exterior solo los servicios imprescindibles; el resto vive en una red interna a la que solo llegan los otros contenedores. Un **proxy inverso** es un servidor (aquí Nginx) que recibe las peticiones de fuera y las reenvía a los servicios internos, de modo que el cliente nunca habla con ellos directamente.
- **Para qué se usa:** cada puerto publicado es una puerta que un atacante puede probar (fuerza bruta contra una consola, una vulnerabilidad de la versión...). Con menos puertas hay menos **superficie de ataque**. En una nube real también ahorra dinero: las IP públicas, los balanceadores y el tráfico de salida se pagan.
- **Dónde y cómo se usa en mi proyecto:** solo el contenedor de Nginx publica un puerto hacia el anfitrión. MinIO, PostgreSQL, Redis, las webs y Prometheus no tienen bloque `ports` en Terraform: solo están en la red Docker del entorno. Los sprites se piden a Nginx (por ejemplo `http://localhost:8080/static/pikachu.png`, valores ficticios) y Nginx los reenvía a MinIO solo para lectura. Las consolas de administración, si hacen falta en la demo, se publican en `127.0.0.1` y no en `0.0.0.0`, para que no sean accesibles desde otras máquinas de la red.
- **Por qué así:** alternativas descartadas: publicar MinIO directamente (el navegador se conectaría al almacenamiento y quedarían expuestas su API y su consola) o usar URLs prefirmadas de S3 (seguro, pero más complejo y no hace falta para estáticos públicos). Pasar por Nginx centraliza la entrada en un solo punto, donde también se puede añadir caché, límites o cabeceras.
- **Pregunta de defensa:** ¿qué diferencia hay entre publicar un puerto en `0.0.0.0` y en `127.0.0.1`, y por qué MinIO no publica ninguno?

### .gitignore: qué no se sube y patrones de exclusión
- **Qué es:** un fichero con patrones de rutas que Git no debe empezar a seguir. Cada línea es un patrón: `*` vale cualquier texto, `**/` cualquier carpeta, una `/` final indica carpeta y `!` al principio **niega** un patrón anterior («excepto esto»). `#` solo es comentario al principio de la línea.
- **Para qué se usa:** que no lleguen al repositorio secretos (`.env`, `secrets.auto.tfvars`, el estado de Terraform), ficheros generados (`.terraform/`, `__pycache__/`) ni material local. Importante: solo afecta a ficheros **no seguidos todavía**. Si un secreto ya entró en un commit, añadirlo después al `.gitignore` no lo saca del historial.
- **Dónde y cómo se usa en mi proyecto:** en `.gitignore` (paso 0.3), con bloques para variables de entorno, Python, editor, material local y Terraform. Se comprobó con `git check-ignore` en un repositorio de prueba: se ignoran el estado, los planes, `secrets.auto.tfvars`, `.terraform/`, `CLAUDE.md` y `docs/referencia/`, y se suben `.terraform.lock.hcl`, `terraform.tfvars` y las plantillas `.example`.
- **Por qué así:** la estrategia es **ignorar por defecto lo sensible y hacer excepciones explícitas** para las plantillas. Buena práctica aplicable más adelante (aún no aplicada): en lugar de listar `.env`, `.env.dev` y `.env.prod` por nombre, usar `.env` + `.env.*` + `!.env.*.example`. Así, un `.env.test` futuro se ignoraría solo y las plantillas seguirían subiéndose. Se ha dejado como está porque de momento solo existen esos dos entornos.
- **Pregunta de defensa:** si por error subiste un `terraform.tfstate` en un commit y luego lo añades al `.gitignore`, ¿está resuelto? ¿Qué harías?

### Autenticación con GitHub: Git Credential Manager
- **Qué es:** Git, por sí solo, no guarda contraseñas. Delega en un *credential helper*, un programa que le da las credenciales cuando un servidor las pide. El **Git Credential Manager (GCM)**, incluido en Git para Windows, inicia sesión en GitHub con el navegador (OAuth), recibe un **token** y lo guarda cifrado en el Administrador de credenciales de Windows.
- **Para qué se usa:** GitHub no acepta la contraseña de la cuenta en las operaciones de Git por HTTPS; exige un token. El GCM lo obtiene y lo reutiliza, así que no hay que crear tokens a mano ni escribirlos en cada `push`.
- **Dónde y cómo se usa en mi proyecto:** el Git de WSL usa el GCM de Windows gracias a `git config --global credential.helper "/mnt/c/Program\ Files/Git/mingw64/bin/git-credential-manager.exe"`. En el primer `git push`, el GCM ya tenía un token guardado de una sesión anterior en GitHub (de la P1) y lo entregó sin abrir el navegador. Se ve en Windows: Administrador de credenciales → Credenciales de Windows → `git:https://github.com`. Se revoca en GitHub: Settings → Applications → Authorized OAuth Apps.
- **Por qué así:** alternativas descartadas: un *Personal Access Token* creado a mano (hay que copiarlo, guardarlo y renovarlo, con riesgo de pegarlo donde no toca) o claves SSH (seguras, pero requieren generar la clave y registrarla). El GCM guarda el token cifrado y fuera del proyecto. Contrapartida: cualquiera que use tu sesión de Windows puede hacer `push` en tu nombre.
- **Pregunta de defensa:** si GitHub no acepta tu contraseña para Git, ¿con qué te autenticaste al hacer `push` y dónde está guardada esa credencial?

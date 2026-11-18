# Conceptos para estudiar: Práctica 2 (Terraform)

Conceptos necesarios para entender y defender la práctica, ordenados por temas.

## Índice

1. [Terraform](#terraform)
   - [Infraestructura como código (IaC) y Terraform](#infraestructura-como-código-iac-y-terraform)
   - [Provider](#provider)
   - [Estado y ciclo plan/apply (idempotencia)](#estado-y-ciclo-planapply-idempotencia)
   - [Estructura de ficheros y directorio raíz (root module)](#estructura-de-ficheros-y-directorio-raíz-root-module)
   - [Variables, tfvars y locals](#variables-tfvars-y-locals)
2. [Docker](#docker)
   - [Volumen de Docker](#volumen-de-docker)
3. [Red y balanceo](#red-y-balanceo)
   - [Redes de Docker y segmentación (frontend/backend)](#redes-de-docker-y-segmentación-frontendbackend)
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
- **Dudas resueltas:**
  - *¿Para qué pasarlo todo a Terraform si con Compose ya funcionaba?* Por lo que pide la práctica (simular un despliegue en la nube con IaC) y por lo que aporta: `plan` enseña los cambios antes de hacerlos; el estado permite saber qué es de Terraform y destruirlo limpiamente; dev y prod salen del mismo código con distintos `tfvars` (en la P1 el prod se quedó desactualizado); y el mismo método sirve para una nube real cambiando el provider.
  - *¿Estamos pasando el proyecto de Docker a Terraform?* No: **Docker se queda**, porque sigue ejecutando los contenedores y hace el papel de «la nube». Lo que se sustituye es **Docker Compose**: P1 `docker-compose.yml` → Compose → Docker; P2 ficheros `.tf` → Terraform (provider de Docker) → Docker. La app y su Dockerfile son los mismos.
  - *¿Por qué no reutilizar los contenedores de la P1?* Se podría con `terraform import` (adoptar un recurso existente en el estado), pero el proyecto debe poder crearse desde cero en otro ordenador, dos herramientas (Compose y Terraform) mandarían sobre lo mismo, el prod de la P1 tiene la imagen antigua y se perdería la demostración de que Terraform lo crea todo. `import` sirve en el mundo real para pasar a código infraestructura creada a mano. De la P1 se aprovechan el código, el Dockerfile, las imágenes públicas y, opcionalmente, los datos (copia y restauración).
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
- **Dudas resueltas:**
  - *¿Cómo predigo lo que dirá el `plan`?* Solo los bloques `resource` crean cosas (`terraform`, `provider`, `variable`, `locals` y los `tfvars` no). Se compara cada `resource` del código con el estado: si está en el código y no en el estado, `+` add; si está en los dos con algún valor distinto, `~` change (o `-/+` si ese valor obliga a recrearlo); si está en el estado y ya no en el código, `-` destroy. En el paso 1.2 había 3 `resource` y el estado estaba vacío: `3 to add`.
  - *¿Qué es `terraform.tfstate`, cuándo se crea y por qué tendrá contraseñas?* Es la «memoria» de Terraform: un JSON con cada recurso creado y todos sus atributos. Se crea en el primer `apply` (en dev, en el paso 1.2), se actualiza en cada `apply` y `destroy`, y se lee en cada `plan`. Nunca se edita a mano. Con redes y volúmenes no tiene secretos; desde el contenedor de PostgreSQL guarda su atributo `env` (con `POSTGRES_PASSWORD`) **en texto plano**, porque necesita el valor para detectar cambios. `sensitive = true` solo lo oculta en pantalla. `terraform state list` enseña qué recursos hay sin mostrar valores.
  - *¿Qué es `(known after apply)`?* Un valor que asigna Docker al crear el recurso, como el `id` o el `mountpoint` de un volumen, y que Terraform no puede saber antes. Lo que escribes tú (el `name`) sí sale en el plan. Después del `apply`, Terraform usa ese `id` para consultar cada recurso (`Refreshing state... [id=...]`).
- **Pregunta de defensa:** si borras a mano un contenedor con `docker rm` y luego haces `terraform plan`, ¿qué mostrará y por qué?

### Estructura de ficheros y directorio raíz (root module)
- **Qué es:** Terraform lee **todos los `.tf` de la carpeta donde se ejecuta** y los trata como un solo conjunto; el nombre de cada fichero no importa para Terraform, solo para las personas. Esa carpeta es el **root module** y tiene su propio `.terraform/`, su lock y su estado. Por convención se reparte así: `versions.tf` (versión de Terraform y providers), `providers.tf` (configuración del provider), `main.tf` (recursos), `variables.tf` (entradas), `outputs.tf` (salidas) y `terraform.tfvars` (valores).
- **Para qué se usa:** encontrar rápido cada cosa y separar entornos: cada carpeta raíz es un despliegue independiente con su estado.
- **Dónde y cómo se usa en mi proyecto:** `terraform/envs/dev/` es el root module de dev (y en la fase 2 lo será `terraform/envs/prod/`). Los comandos se ejecutan dentro de esa carpeta (`cd terraform/envs/dev && terraform init`) o con `terraform -chdir=terraform/envs/dev init`, que es lo que usará el Makefile. Las piezas reutilizables irán en `terraform/modules/`.
- **Por qué así:** una carpeta por entorno da **estados separados**: un `destroy` en dev no puede tocar prod. Alternativa descartada: *workspaces* de Terraform (un mismo directorio con varios estados), que son más fáciles de confundir («¿en qué workspace estoy?») y no permiten diferencias de estructura entre entornos. `required_version` y la versión del provider se fijan para que el despliegue sea reproducible.
- **Dudas resueltas:**
  - *¿Qué es cada fichero de `envs/dev` y para qué sirve?* `versions.tf`: qué Terraform y qué provider hacen falta. `providers.tf`: cómo conectarse a Docker. `variables.tf`: qué datos necesita el código (entorno, nombre de la base de datos, usuario, contraseña). `terraform.tfvars`: valores no secretos (en Git). `secrets.auto.tfvars`: valores secretos (fuera de Git); `secrets.auto.tfvars.example`: su plantilla con valores ficticios (en Git). `main.tf`: los recursos (redes, volumen, imagen y contenedor). Los genera Terraform: `.terraform/` (provider descargado, fuera de Git), `.terraform.lock.hcl` (versión exacta, en Git) y `terraform.tfstate` (la memoria, fuera de Git).
  - *¿Pasa algo si lo pongo todo en un solo fichero?* No: Terraform junta todos los `.tf` antes de hacer nada. Se separan por comprensión, por convención de la comunidad y porque el enunciado pide organizar `variables.tf`, `outputs.tf`, etc.
  - *¿Y si dos ficheros tienen el mismo bloque `provider "docker"`?* Error `Duplicate provider configuration`, aunque sean idénticos: al juntarlos hay dos configuraciones por defecto del mismo provider. Para tener dos se usa `alias`.
- **Pregunta de defensa:** si escribes un recurso en `outputs.tf` en lugar de `main.tf`, ¿funciona? ¿Por qué se separan entonces en varios ficheros?

### Variables, tfvars y locals
- **Qué es:** una **variable** (`variable "entorno" { ... }` en `variables.tf`) es una entrada del código: se declara con tipo, descripción y, opcionalmente, una `validation`, y se usa como `var.entorno`. Su valor se da en `terraform.tfvars`, que Terraform carga solo, igual que cualquier `*.auto.tfvars`. Un **local** (`locals { prefijo = "..." }`, usado como `local.prefijo`) es un valor calculado dentro del código, que no se puede cambiar desde fuera.
- **Para qué se usa:** el mismo código sirve para dev y prod cambiando solo los valores (número de webs, puertos, caché...). Los locals evitan repetir expresiones, como el prefijo de los nombres.
- **Dónde y cómo se usa en mi proyecto:** `terraform/envs/dev/variables.tf` declara `entorno` con una validación que solo admite `"dev"` o `"prod"`; `terraform.tfvars` le da el valor `entorno = "dev"`; `main.tf` define `local.prefijo = "tracker-${var.entorno}"` y todos los recursos se llaman `tracker-dev-...`. Los secretos irán en variables `sensitive` con el valor en `secrets.auto.tfvars` (ignorado por Git).
- **Por qué así:** el prefijo evita choques con los recursos de la P1 (`randomlocke-*`) y entre dev y prod, que deben convivir. La `validation` falla en el `plan` con un mensaje claro si alguien escribe `entorno = "produccion"`. Variable frente a local: lo que cambia entre entornos va en una variable; lo que se deduce de otras cosas, en un local.
- **Dudas resueltas:**
  - *¿Qué pasa si la variable no tiene valor?* Sin `default` ni `tfvars`, Terraform lo pregunta en la terminal (mostrando la `description`); sin poder preguntar (`-input=false`, como en un Makefile) falla con `No value for required variable`. Es intencionado: nunca adivina el entorno.
  - *¿Pasa algo si los recursos se llaman igual que los de la P1?* Los nombres son únicos por tipo en Docker. Un contenedor repetido da error; una red, según la versión, error o duplicado. El caso grave es el **volumen**: Docker devuelve el existente sin avisar, Terraform lo toma como suyo y un `destroy` de la P2 borraría los datos de la P1.
  - *¿Y `randomlocke-dev2`?* Funcionaría, pero los filtros de Docker buscan por trozos (`--filter name=randomlocke-dev` también encontraría `randomlocke-dev2-...`) y un comando de limpieza podría tocar la P1. Seguros: `tracker-dev` o `randomlocke2-dev`. Cambiar el prefijo con recursos ya creados los recrea (`-/+`), porque en Docker el nombre no se puede cambiar.
  - *Si prod tiene caché, ¿tendrá más recursos que dev?* Sí, pero cuando se escriba su `resource`, en el paso 2.3. Con el código del paso 1.2 los dos tendrían 3 (2 redes y el volumen). La caché será un contenedor con `count = var.cache_activada ? 1 : 0` (1 en prod, 0 en dev), y las webs con `count = var.num_webs` (2 y 3): el mismo código con otros valores en el `tfvars`. Redis no lleva volumen porque es una caché sin persistencia.
- **Pregunta de defensa:** ¿qué diferencia hay entre `var.entorno` y `local.prefijo`, y dónde cambiarías el número de webs de prod?

## Docker

### Volumen de Docker
- **Qué es:** un espacio de almacenamiento que gestiona Docker, fuera del sistema de ficheros del contenedor. Si el contenedor se borra o se recrea, los datos del volumen siguen ahí.
- **Para qué se usa:** que los datos sobrevivan a los contenedores. Un contenedor es desechable: Terraform lo recrea cuando cambia su imagen o su configuración, y sin volumen PostgreSQL perdería todas las partidas en cada cambio.
- **Dónde y cómo se usa en mi proyecto:** `resource "docker_volume" "db_datos"` en `terraform/envs/dev/main.tf` crea `tracker-dev-db-datos`; en el paso 1.3 se montará en `/var/lib/postgresql/data` del contenedor de PostgreSQL.
- **Por qué así:** volumen gestionado por Docker frente a *bind mount* (una carpeta de Windows montada): en `/mnt/c` los permisos de NTFS dan problemas a PostgreSQL y es más lento. Cuidado: el volumen es un recurso de Terraform, así que `terraform destroy` **también lo borra**. En dev es aceptable; para prod se puede valorar `lifecycle { prevent_destroy = true }`, que hace fallar cualquier plan que lo destruya.
- **Pregunta de defensa:** si cambias la versión de la imagen de PostgreSQL y Terraform recrea el contenedor, ¿se pierden los datos? ¿Y con `terraform destroy`?

## Red y balanceo

### Redes de Docker y segmentación (frontend/backend)
- **Qué es:** una red de Docker (tipo *bridge* por defecto) es una red privada virtual entre contenedores. Los contenedores de una misma red se encuentran por nombre gracias al DNS interno de Docker (por ejemplo, la web conecta a `tracker-dev-db`). Una red con `internal = true` no tiene salida a internet ni deja publicar puertos.
- **Para qué se usa:** aislar. Si un contenedor no está en una red, no puede hablar con los que están en ella. Separar en capas limita lo que puede alcanzar un atacante que comprometa una pieza.
- **Dónde y cómo se usa en mi proyecto:** `terraform/envs/dev/main.tf` crea `tracker-dev-frontend` (Nginx y webs) y `tracker-dev-backend` (`internal = true`: webs, PostgreSQL y Redis). Las webs están en las dos redes: reciben por `frontend` y consultan por `backend`. Nginx no ve la base de datos, y la base de datos no puede salir a internet.
- **Por qué así:** es el diseño que ya tenía el prod de la P1 (`frontend` y `backend` internal), ahora en los dos entornos para que dev se parezca a prod. Alternativa descartada: una sola red, como el dev de la P1, que es más simple pero deja todo al alcance de todo. El sitio de MinIO (Nginx necesita alcanzarlo) se decide en la fase 4.
- **Dudas resueltas:**
  - *`docker ps` muestra `5432/tcp` en PostgreSQL: ¿está expuesto?* No. `5432/tcp` solo indica el puerto que la imagen **declara** (`EXPOSE`) y en el que escucha **dentro** de su red. Un puerto **publicado** se vería como `0.0.0.0:5432->5432/tcp` y solo aparece si el recurso tiene un bloque `ports`. Comprobado con `docker inspect`: `PortBindings` vacío. Las webs llegarán a `tracker-dev-db:5432` por la red `backend`; desde el ordenador, no se puede.
  - *¿Qué pasaría si PostgreSQL estuviera también en `frontend`?* Dos riesgos: todo lo que haya en `frontend` (Nginx) podría conectarse a la base de datos, y PostgreSQL ganaría salida a internet por esa red, que no es interna. Basta con que un contenedor esté en una red no interna para que tenga salida.
  - *¿`frontend` tiene acceso directo al exterior?* Hacia fuera (salida), sí: sus contenedores pueden conectarse a internet (Grafana lo necesitará para Telegram). Hacia dentro (entrada), no: desde fuera solo se llega a un contenedor si **publica** un puerto. Son dos direcciones distintas: `internal = true` corta la salida; no publicar puertos corta la entrada.
- **Pregunta de defensa:** si Nginx está solo en `frontend`, ¿podría conectarse a PostgreSQL? ¿Y PostgreSQL podría descargar algo de internet?

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

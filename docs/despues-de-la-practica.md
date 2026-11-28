# Después de la práctica: llevar el Tracker a internet

Este documento reúne lo que se ha ido apuntando durante la práctica para **cuando se publique la web de verdad**. No forma parte de la entrega ni de la presentación.

**Cómo leerlo:** la práctica tenía restricciones propias:
- simular la nube en un portátil, con Terraform y el provider de Docker;
- dos entornos en la misma máquina;
- cumplir el enunciado;
- tres días de plazo para cada fase.

Muchas decisiones fueron buenas **para la práctica**, pero no tienen por qué serlo para un servicio real. Antes de publicar, conviene **revisarlas desde cero** con las preguntas de un proyecto real (cuánto tráfico, cuánto dinero, cuánto tiempo de mantenimiento, qué pasa si se cae), y no dar por hecho que lo de aquí es lo correcto.

Última actualización: 28 nov. 2026.

---

## 1. Decisiones de la práctica que hay que replantear

| Decisión en la práctica | Por qué se tomó | Qué replantearse en un despliegue real |
|---|---|---|
| **Terraform con el provider de Docker**, todo en una máquina | Lo pide el enunciado: simular la nube en local | Terraform suele crear la **infraestructura del proveedor** (servidor, red, cortafuegos, DNS, balanceador, base de datos gestionada). Los contenedores los despliega otra herramienta: Docker Compose en un servidor pequeño; Kubernetes o un servicio de contenedores gestionado si crece |
| **dev y prod en el mismo ordenador** | Lo pide el enunciado («los dos a la vez») | Entornos en máquinas (o cuentas) distintas: un fallo o un `destroy` en dev no puede tocar prod |
| **«Alta disponibilidad» con 3 réplicas en una sola máquina** | Demostrar el reparto y la conmutación | Si cae la máquina, cae todo. La alta disponibilidad real necesita **varias máquinas** (y, si importa mucho, varias zonas) detrás de un balanceador |
| **Imagen de la web construida por Terraform en el portátil** | Simplicidad: `make apply` lo hace todo | Construir la imagen en una **integración continua** (por ejemplo, GitHub Actions), subirla a un **registro** (GitHub Container Registry) con versión, y desplegar esa versión exacta |
| **PostgreSQL en un contenedor junto a todo lo demás** | Lo pide la P1 y cabe en un portátil | Base de datos **gestionada** (copias, actualizaciones y réplicas incluidas) o, si es propia, copias automáticas fuera del servidor y prueba de restauración |
| **MinIO propio para los dibujos** | El enunciado pide simular S3 | Un S3 real (Amazon S3, Cloudflare R2, Backblaze B2) o directamente una **CDN**: los dibujos no cambian nunca |
| **Telegraf en lugar de cAdvisor** | cAdvisor no ve los contenedores con Docker Desktop + WSL | En un servidor Linux con Docker Engine, cAdvisor funciona: **cAdvisor + `node-exporter`** (métricas de la máquina). Telegraf también valdría |
| **Monitorización en la misma máquina que la app** | Todo en un portátil | Si la máquina cae, cae también quien tendría que avisar. Monitorización en **otra máquina** o un servicio externo, más una comprobación desde fuera |
| **Nginx gratuito con round-robin** | Peticiones cortas, réplicas iguales y reparto visible en la demo | Ver la sección 3 |
| **Estado de Terraform en el portátil** | Una sola persona | Estado **remoto, cifrado y con bloqueo** (por ejemplo, en un almacenamiento S3), con copia |
| **Secretos en `secrets.auto.tfvars`** | Simple y fuera de Git | Un **gestor de secretos** (del proveedor, Vault, o los secretos cifrados de la integración continua). Rotar las contraseñas y no reutilizar las de la práctica |
| **Todo en `127.0.0.1`, sin HTTPS** | Solo se usa en el portátil | Ver la sección 2 |

## 2. Publicar la web con dominio propio, en orden

1. **Servidor Linux en la nube:** un VPS pequeño, de unos pocos euros al mes, con **Docker Engine instalado directamente**. En Linux, el motor y quien da las órdenes son la misma máquina. Terraform y los módulos servirían casi sin cambios: el provider apuntaría al Docker del servidor.
2. **Monitorización:** cAdvisor + `node-exporter` (o seguir con Telegraf); solo cambian el recolector y las consultas de Grafana.
3. **Dominio y DNS:** comprar el dominio y apuntar su registro `A` a la IP del servidor.
4. **HTTPS:** certificado gratuito de Let's Encrypt en Nginx (o Caddy, que lo renueva solo), y redirigir HTTP a HTTPS.
5. **Exposición:**
   - Nginx publica los puertos 80 y 443 en `0.0.0.0` (todo internet); el resto, sin puertos.
   - Cortafuegos (`ufw`) que solo abra 22, 80 y 443. **Ojo:** los puertos que Docker publica en `0.0.0.0` **se saltan `ufw`** (Docker escribe sus propias reglas de red). Todo lo que no sea Nginx debe seguir sin puertos o en `127.0.0.1`.
   - SSH solo con clave, sin contraseña.
   - Grafana y cualquier consola, **nunca abiertas a internet**: por túnel SSH (`ssh -L 3200:127.0.0.1:3200 usuario@servidor`) o por una VPN (WireGuard, Tailscale). La tentación de abrirlas «por comodidad» (verlas desde el móvil al recibir una alerta) es justo lo que hay que evitar.
6. **Secretos y estado:** contraseñas largas y distintas por entorno; el estado de Terraform fuera del portátil y con copia.
7. **Copias de seguridad:** `pg_dump` diario de PostgreSQL guardado fuera del servidor, y **probar a restaurarlo**: una copia sin probar no es una copia.
8. **Mantenimiento:** actualizaciones de seguridad del sistema y de las imágenes (revisar las versiones fijadas cada cierto tiempo) y alertas de Telegram activas.
9. **Legal:** aviso legal, privacidad y cookies (RGPD) y el riesgo de propiedad intelectual (sección 6).

## 3. Reparto de carga y rendimiento

**Round-robin no es lo mejor con tráfico real.** Reparte por turnos sin mirar cómo está cada réplica: si una petición pesada (importar un guardado) ocupa una web, le siguen llegando las mismas que a las demás.

| Estrategia | Cómo reparte | Dónde | Valoración |
|---|---|---|---|
| round-robin (la de la práctica) | Por turnos | Nginx, por defecto | Bien con poco tráfico y peticiones iguales |
| **`least_conn`** | A la réplica con menos peticiones en curso | Nginx gratuito, una línea | **La opción razonable por defecto** |
| `random two least_conn` | Elige dos al azar y manda a la menos cargada («el poder de dos opciones») | Nginx gratuito | Casi tan buena como mirarlas todas; útil con muchas réplicas o varios balanceadores |
| `least_time` | A la que responde más rápido | Nginx Plus (de pago) | Muy buena, de pago |
| EWMA / por latencia | Media de lo que tarda cada una últimamente | Envoy, Linkerd, HAProxy | Para cuando sea grande |
| `ip_hash` / `hash` | El mismo usuario, siempre a la misma réplica | Nginx gratuito | No hace falta: la app no guarda nada en la memoria de cada web |

**Lo que más se nota no es el algoritmo:**

1. **Comprobaciones de salud activas:** que el balanceador pruebe las webs por su cuenta. Nginx gratuito solo se entera cuando una petición falla. Lo hacen HAProxy o Nginx Plus.
2. **`keepalive` hacia las webs:** reutilizar conexiones en lugar de abrir una por petición.
3. **Varios procesos por réplica** (`uvicorn --workers N`): ahora cada web es un solo proceso y usa un solo núcleo.
4. **Caché y CDN** para los dibujos y lo que no cambia.
5. **Límite de peticiones** (`limit_req`) contra abusos.
6. **En la nube:** el balanceador del proveedor con **autoescalado** (más réplicas cuando sube la carga).

**Punto de partida razonable:**
```nginx
upstream webs {
    least_conn;
    keepalive 32;
    server ... max_fails=2 fail_timeout=10s;
}
```
Después, **medir antes de complicarlo**: con Grafana se ve dónde está de verdad el cuello de botella.

## 4. Seguridad que quedó pendiente

| Pendiente | Por qué importa | Cómo |
|---|---|---|
| **Las webs tienen salida a internet sin necesitarla** | Comparten la red `frontend` con Nginx, que no es interna. Si alguien se apoderara de una web, podría descargar herramientas o sacar datos | Una red interna aparte entre Nginx y las webs; `frontend` solo para Nginx |
| **Telegraf y Alloy usan el socket de Docker directamente** | Quien usa el socket puede dar órdenes a Docker (`:ro` no lo impide) | Un proxy del socket (por ejemplo, `tecnativa/docker-socket-proxy` con solo `CONTAINERS=1` y lectura) |
| **`.gitignore` de los `.env` por nombre** | Un entorno nuevo (`.env.staging`) se subiría por error | `.env.*` + `!.env.*.example` |
| **Subida de guardados en una web pública** | Cualquiera podría enviar ficheros preparados o saturar el servidor | Ver «Subida de archivos» en `conceptos-para-estudiar.md`: lo que ya está hecho y lo que faltaría (límite por usuario, cuentas…) |
| **Contenedores sin límites de memoria ni CPU** | Uno descontrolado puede tumbar a todos | `memory` y `cpu_shares` en `docker_container`, o los límites de la plataforma |

## 5. Monitorización y alertas

**Más alertas** (además de web caída, servicio caído, CPU alta y errores 5xx):

| Alerta | Consulta orientativa | Por qué |
|---|---|---|
| **Reinicios** | `increase(docker_container_status_restart_count[10m]) > 0` | Una web que se cae y Docker levanta en segundos **no dispara «Web caída»** (espera 1 minuto). Así se ven los fallos que se repiten |
| **Web encendida pero colgada** | `docker_container_health_failing_streak >= 3` | Falla su *healthcheck* aunque el contenedor esté en marcha |
| **Monitorización ciega** | `up{job="telegraf"} == 0` + un aviso periódico de «sigo vivo» (*watchdog*) | Si el recolector cae, hoy saltaría «Web caída» con un mensaje engañoso; el *watchdog* confirma que el propio sistema de avisos funciona |
| **Memoria alta** | Uso sobre el límite del contenedor > 80-90 % | Necesita poner límites (sin ellos, el porcentaje es sobre toda la máquina) |
| **La máquina** (con `node-exporter`) | Disco casi lleno; CPU y memoria totales | Un disco lleno tumba la base de datos |
| **El servicio** | Latencia alta (tiempos de Nginx en los logs); certificado HTTPS a punto de caducar | Lo que nota el usuario antes de que algo «se caiga» |
| **Desde fuera** | Un servicio externo de *uptime* que pida la web cada minuto | Si cae el servidor entero, Grafana cae con él y no puede avisar |

**Otras mejoras:**
- `keep_firing_for`, para no recibir avisos de ida y vuelta si algo parpadea.
- Revisar los tiempos de aviso (hoy 2-4 minutos) según lo que se quiera tolerar.
- Separar los avisos «críticos» (despiertan) de los «aviso» (se miran al día siguiente).

## 6. Producto: límite gratuito de importaciones y anuncios

Idea: importar el guardado del juego sería gratis **una vez al día**; para volver a importar el mismo día, el usuario vería un anuncio.

- **Cuentas de usuario:** el límite tiene que ir por usuario. Por IP no sirve: varias personas comparten una IP (casa, universidad) y una persona puede cambiarla.
- **Contador en el servidor**, nunca en el navegador (se borra o se falsea): en Redis con caducidad de un día (`INCR` + `EXPIRE`), o en PostgreSQL si debe sobrevivir a un reinicio de Redis (en la práctica, Redis no guarda nada en disco).
- **Anuncio con recompensa verificado por el servidor:** la red de anuncios debe confirmar al servidor que se vio el anuncio; si solo lo dice el navegador, cualquiera se lo salta.
- **Requisitos legales en la UE:** consentimiento de cookies y de anuncios personalizados (RGPD), aviso legal y política de privacidad.
- **Propiedad intelectual:** la app usa nombres y dibujos de Pokémon. Cobrar o poner anuncios en una herramienta de fans con material de Nintendo / The Pokémon Company puede acabar en una reclamación y en el cierre de la web. **Informarse antes de monetizar.**

## 7. Orden sugerido

1. Revisar la sección 1 y decidir la plataforma: un VPS con Docker o un servicio gestionado.
2. Integración continua que construya y publique la imagen.
3. Servidor + dominio + HTTPS + cortafuegos + SSH con clave (sección 2).
4. Base de datos con copias probadas.
5. Webs en red interna, proxy del socket y límites de recursos (sección 4).
6. Monitorización fuera de la máquina, alertas nuevas y comprobación externa (sección 5).
7. `least_conn`, `keepalive`, `--workers` y CDN, **después de medir** (sección 3).
8. Solo entonces, cuentas de usuario y monetización, con la parte legal resuelta (sección 6).

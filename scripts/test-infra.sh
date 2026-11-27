#!/usr/bin/env bash
# Pruebas de la infraestructura de un entorno (no de la app: esas son `make test`).
# Cada prueba corresponde a una fila del «Mapa de límites» de docs/hoja-de-ruta.md.
# Uso: make test-infra ENV=dev|prod   (el Makefile pasa URL, GRAFANA y TF_VAR_gid_docker)
# No lee ni muestra ningún secreto. Para un momento web-2 (alta disponibilidad) y la vuelve a arrancar.
set -uo pipefail

ENV="${1:?Uso: test-infra.sh dev|prod}"
P="tracker-$ENV"
OTRO=$([ "$ENV" = dev ] && echo prod || echo dev)
URL="${URL:?falta URL (lo pasa el Makefile)}"
GRAFANA="${GRAFANA:?falta GRAFANA (lo pasa el Makefile)}"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"

BIEN=0
MAL=0
ok() { echo "  ✅ $*"; BIEN=$((BIEN + 1)); }
ko() { echo "  ❌ $*"; MAL=$((MAL + 1)); }
titulo() { echo; echo "▶ $*"; }

# Resuelve un nombre desde dentro de una red de Docker (contenedor de un solo uso)
resuelve() { docker run --rm --network "$1" --entrypoint getent nginx:1.28-alpine hosts "$2" >/dev/null 2>&1; }

# Consulta HTTP desde dentro de una red de Docker (la monitorización no publica puertos)
dentro() { docker run --rm --network "$1" --entrypoint wget grafana/grafana:13.3.2 -qO- "$2"; }

echo "Pruebas de infraestructura · entorno $ENV · $(date '+%d/%m/%Y %H:%M')"

# ---------------------------------------------------------------------------------------------
titulo "1. Una sola puerta de entrada (solo Nginx y Grafana publican puerto, y en 127.0.0.1)"
PUBLICADOS=$(docker ps --filter "name=^$P-" --format '{{.Names}} {{.Ports}}' | grep -- '->' || true)
echo "$PUBLICADOS" | sed 's/^/     /'
OTROS=$(echo "$PUBLICADOS" | grep -vE "^$P-(balanceador|grafana) " | grep -v '^$' || true)
[ -z "$OTROS" ] && ok "ningún otro contenedor publica puertos" || ko "publican puertos de más: $OTROS"
echo "$PUBLICADOS" | grep -q '0\.0\.0\.0\|:::' && ko "hay puertos abiertos a todas las interfaces" || ok "todos los puertos publicados están en 127.0.0.1"

# ---------------------------------------------------------------------------------------------
titulo "2. Reparto entre réplicas (round-robin de Nginx)"
REPLICAS=$(docker ps --filter "name=^$P-web-" --format '{{.Names}}' | wc -l)
INSTANCIAS=$(for _ in $(seq 30); do curl -s -D - -o /dev/null "$URL/status" | tr -d '\r' | sed -n 's/^[Xx]-[Ii]nstancia: //p'; done | sort | uniq -c)
echo "$INSTANCIAS" | sed 's/^/     /'
DISTINTAS=$(echo "$INSTANCIAS" | grep -c . || true)
[ "$DISTINTAS" -eq "$REPLICAS" ] && ok "30 peticiones repartidas entre las $REPLICAS réplicas" || ko "respondieron $DISTINTAS instancias de $REPLICAS"

# ---------------------------------------------------------------------------------------------
titulo "3. Alta disponibilidad: con web-2 parada, la web sigue respondiendo"
docker stop "$P-web-2" >/dev/null
CODIGOS=$(for _ in $(seq 20); do curl -s -o /dev/null -w '%{http_code}\n' "$URL/status"; done | sort | uniq -c)
echo "     códigos con web-2 parada:"; echo "$CODIGOS" | sed 's/^/       /'
[ "$(echo "$CODIGOS" | grep -v ' 200$' | grep -c . || true)" -eq 0 ] && ok "20/20 respuestas 200 con una réplica parada" || ko "hubo respuestas distintas de 200"

echo "     terraform plan con web-2 parada (no debe borrarla: must_run = false)…"
terraform -chdir="$RAIZ/terraform/envs/$ENV" plan -detailed-exitcode -input=false -lock=false >/dev/null 2>&1
CODIGO_PLAN=$?
EXISTE=$(docker ps -a --filter "name=^$P-web-2$" --format '{{.Names}}')
[ "$CODIGO_PLAN" -eq 0 ] && [ -n "$EXISTE" ] && ok "plan «No changes» y web-2 sigue existiendo (parada)" || ko "plan con cambios (código $CODIGO_PLAN) o web-2 desaparecida"

docker start "$P-web-2" >/dev/null
for _ in $(seq 30); do [ "$(docker inspect -f '{{.State.Health.Status}}' "$P-web-2")" = healthy ] && break; sleep 2; done
[ "$(docker inspect -f '{{.State.Health.Status}}' "$P-web-2")" = healthy ] && ok "web-2 vuelve a estar healthy" || ko "web-2 no vuelve a healthy"

# ---------------------------------------------------------------------------------------------
titulo "4. Caché compartida entre réplicas (solo si el entorno tiene caché)"
if [ -n "$(docker ps --filter "name=^$P-cache$" --format '{{.Names}}')" ]; then
  RUN=$(curl -s -X POST "$URL/runs" -H 'Content-Type: application/json' -d '{"name":"ZZ prueba infra"}' | sed -n 's/.*"id":\([0-9]*\).*/\1/p')
  C1=$(curl -s -D - -o /dev/null "$URL/runs/$RUN/team" | tr -d '\r' | sed -n 's/^[Xx]-[Cc]ache: //p;s/^[Xx]-[Ii]nstancia: /@/p' | paste -sd' ')
  C2=$(curl -s -D - -o /dev/null "$URL/runs/$RUN/team" | tr -d '\r' | sed -n 's/^[Xx]-[Cc]ache: //p;s/^[Xx]-[Ii]nstancia: /@/p' | paste -sd' ')
  curl -s -o /dev/null -X DELETE "$URL/runs/$RUN"
  echo "     1.ª lectura: $C1 · 2.ª lectura: $C2   (partida de prueba $RUN, ya borrada)"
  echo "$C1" | grep -q MISS && echo "$C2" | grep -q HIT && ok "MISS y después HIT (en réplicas distintas: la caché es común)" || ko "no se vio MISS → HIT"
else
  echo "     $ENV no tiene caché (cache_activada = false): se omite"
fi

# ---------------------------------------------------------------------------------------------
titulo "5. Dibujos desde MinIO a través de Nginx, solo lectura"
TIPO=$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "$URL/sprites/25.png")
PUT=$(curl -s -o /dev/null -w '%{http_code}' -X PUT --data x "$URL/sprites/prueba.png")
DEL=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$URL/sprites/25.png")
LISTA=$(curl -s -o /dev/null -w '%{http_code}' "$URL/sprites/")
echo "     GET 25.png: $TIPO · PUT: $PUT · DELETE: $DEL · listar: $LISTA"
[ "$TIPO" = "200 image/png" ] && ok "el dibujo se sirve (200 image/png)" || ko "el dibujo no se sirve bien"
[ "$PUT" = 403 ] && [ "$DEL" = 403 ] && [ "$LISTA" = 403 ] && ok "subir, borrar y listar dan 403" || ko "alguna escritura o el listado no da 403"

# ---------------------------------------------------------------------------------------------
titulo "6. Redes separadas y entornos aislados"
for RED in frontend backend almacenamiento monitorizacion grafana; do
  echo "     $P-$RED: internal=$(docker network inspect -f '{{.Internal}}' "$P-$RED")"
done
[ "$(docker network inspect -f '{{.Internal}}' "$P-backend")$(docker network inspect -f '{{.Internal}}' "$P-almacenamiento")$(docker network inspect -f '{{.Internal}}' "$P-monitorizacion")" = truetruetrue ] \
  && ok "backend, almacenamiento y monitorizacion son internas (sin salida a internet)" || ko "alguna red que debía ser interna no lo es"
resuelve "$P-frontend" "$P-balanceador" && ok "control: desde frontend se resuelve el balanceador" || ko "control fallido: desde frontend no se resuelve nada"
! resuelve "$P-frontend" "$P-db" && ! resuelve "$P-frontend" "$P-minio" && ! resuelve "$P-frontend" "$P-loki" \
  && ok "desde frontend no se ven la base de datos, MinIO ni Loki" || ko "desde frontend se ve algo que no debería"
resuelve "$P-monitorizacion" "$P-loki" && ! resuelve "$P-monitorizacion" "tracker-$OTRO-loki" && ! resuelve "$P-monitorizacion" "tracker-$OTRO-db" \
  && ok "la monitorización de $ENV ve su Loki, pero no el Loki ni la BD de $OTRO" || ko "los entornos no están aislados"

# ---------------------------------------------------------------------------------------------
titulo "7. Grafana cerrado"
SALUD=$(curl -s -o /dev/null -w '%{http_code}' "$GRAFANA/api/health")
SIN=$(curl -s -o /dev/null -w '%{http_code}' "$GRAFANA/api/search")
FALSAS=$(curl -s -o /dev/null -w '%{http_code}' -u falso:falso "$GRAFANA/api/search")
METRICS=$(curl -s -o /dev/null -w '%{http_code}' "$GRAFANA/metrics")
echo "     salud: $SALUD · sin contraseña: $SIN · credenciales falsas: $FALSAS · /metrics: $METRICS"
[ "$SALUD" = 200 ] && [ "$SIN" = 401 ] && [ "$FALSAS" = 401 ] && ok "Grafana funciona y pide usuario y contraseña" || ko "Grafana no responde o no pide contraseña"
[ "$METRICS" != 200 ] && ok "/metrics no da datos sin contraseña" || ko "/metrics responde sin contraseña"

# ---------------------------------------------------------------------------------------------
titulo "8. La monitorización tiene datos de todos los contenedores del entorno"
ESPERADOS=$(docker ps --filter "name=^$P-" --format '{{.Names}}' | sort)
EN_PROM=$(dentro "$P-monitorizacion" "http://$P-prometheus:9090/api/v1/query?query=count%20by%20(container_name)%20(docker_container_mem_usage)" | grep -o '"container_name":"[^"]*"' | cut -d'"' -f4 | sort)
# Loki, por defecto, solo mira las últimas horas: se le pide toda la retención (7 días)
DESDE=$(( ($(date +%s) - 7 * 24 * 3600) * 1000000000 ))
EN_LOKI=$(dentro "$P-monitorizacion" "http://$P-loki:3100/loki/api/v1/label/container_name/values?start=$DESDE" | grep -o "\"$P-[^\"]*\"" | tr -d '"' | sort)
FALTA_PROM=$(comm -23 <(echo "$ESPERADOS") <(echo "$EN_PROM"))
FALTA_LOKI=$(comm -23 <(echo "$ESPERADOS") <(echo "$EN_LOKI"))
echo "     contenedores en marcha: $(echo "$ESPERADOS" | wc -l) · en Prometheus: $(echo "$EN_PROM" | grep -c .) · en Loki: $(echo "$EN_LOKI" | grep -c .)"
[ -z "$FALTA_PROM" ] && ok "Prometheus tiene CPU y memoria de todos (Telegraf)" || ko "faltan en Prometheus: $FALTA_PROM"
[ -z "$FALTA_LOKI" ] && ok "Loki tiene los logs de todos (Alloy)" || ko "faltan en Loki: $FALTA_LOKI"
[ -z "$(echo "$EN_PROM$EN_LOKI" | grep -v "^$P-" | grep -v '^$')" ] && ok "solo contenedores de $ENV (nada del otro entorno ni de la P1)" || ko "se cuelan contenedores de fuera del entorno"

# ---------------------------------------------------------------------------------------------
titulo "9. Alertas creadas desde el código (Telegram solo en prod)"
FICHEROS=$(docker exec "$P-grafana" ls /etc/grafana/provisioning/alerting/ | paste -sd' ')
echo "     ficheros de alertas en Grafana: $FICHEROS"
# grep -c y no -q: con pipefail, -q corta docker logs a medias y daría un falso fallo
[ "$(docker logs "$P-grafana" 2>&1 | grep -c 'finished to provision alerting')" -gt 0 ] && ok "Grafana cargó las reglas de alerta" || ko "Grafana no cargó las reglas"
NREGLAS=$(docker exec "$P-grafana" grep -c '^      - uid:' /etc/grafana/provisioning/alerting/alertas.yml)
[ "$NREGLAS" -eq 4 ] && ok "4 reglas: web caída, CPU alta, servicio caído y errores 5xx" || ko "hay $NREGLAS reglas"
if [ "$ENV" = prod ]; then
  echo "$FICHEROS" | grep -q telegram.yml && ok "prod tiene el aviso por Telegram" || ko "prod no tiene telegram.yml"
else
  echo "$FICHEROS" | grep -q telegram.yml && ko "dev no debería avisar por Telegram" || ok "dev no avisa por Telegram (solo se ven en Grafana)"
fi

# ---------------------------------------------------------------------------------------------
titulo "10. Secretos y estado fuera de Git"
SUBIDOS=$(git -C "$RAIZ" ls-files | grep -E '(^|/)secrets\.auto\.tfvars$|tfstate|(^|/)\.env(\.[a-z]+)?$|plan\.tfplan$' || true)
[ -z "$SUBIDOS" ] && ok "ni secrets.auto.tfvars, ni .env, ni terraform.tfstate, ni planes en Git" || ko "en Git hay: $SUBIDOS"
git -C "$RAIZ" check-ignore -q "terraform/envs/$ENV/secrets.auto.tfvars" && ok "secrets.auto.tfvars de $ENV está ignorado" || ko "secrets.auto.tfvars de $ENV no está ignorado"

# ---------------------------------------------------------------------------------------------
echo
echo "Resultado ($ENV): $BIEN correctas, $MAL fallidas"
[ "$MAL" -eq 0 ]

# Automatiza Terraform y las pruebas de cada entorno.
# Uso: make <comando> ENV=dev|prod   (si no se indica, ENV=dev)

.DEFAULT_GOAL := help

ENV ?= dev
TF  := terraform -chdir=terraform/envs/$(ENV)
PLAN := terraform/envs/$(ENV)/plan.tfplan
SERVICIO ?= balanceador
WEB ?= 1
# Grupo dueño del socket de Docker (cambia en cada ordenador): Telegraf lo necesita para leer la API sin ser root
export TF_VAR_gid_docker := $(shell stat -c '%g' /var/run/docker.sock 2>/dev/null)

.PHONY: help comprobar-env init fmt validate plan apply destroy output web grafana ps test logs stop-web start-web stop-cache start-cache

help: ## Muestra esta ayuda
	@awk 'BEGIN {FS = ":.*## "; print "\nUso: make <comando> ENV=dev|prod (por defecto, dev)\n"} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""

comprobar-env:
	@case "$(ENV)" in dev|prod) ;; *) echo "ENV debe ser dev o prod (has puesto '$(ENV)')"; exit 1 ;; esac

init: comprobar-env ## Prepara el entorno: descarga el provider y registra los módulos
	$(TF) init

fmt: ## Da formato a todos los ficheros de Terraform
	terraform fmt -recursive terraform

validate: comprobar-env ## Comprueba que la configuración es válida
	$(TF) validate

plan: comprobar-env ## Enseña lo que cambiaría y lo guarda para aplicarlo
	$(TF) plan -out=plan.tfplan

apply: comprobar-env ## Aplica exactamente el último plan guardado
	@test -f $(PLAN) || { echo "No hay plan guardado: primero, make plan ENV=$(ENV)"; exit 1; }
	$(TF) apply plan.tfplan
	@rm -f $(PLAN)

destroy: comprobar-env ## Destruye el entorno entero (pide confirmación)
	$(TF) destroy

output: comprobar-env ## Muestra las salidas del entorno (la URL de la web)
	$(TF) output

# Abre "$$url" en el navegador: explorer.exe abre el de Windows desde WSL (devuelve error
# aunque funcione, de ahí el || true); en Linux, xdg-open. Solo direcciones, nunca credenciales.
ABRIR = if command -v explorer.exe >/dev/null; then explorer.exe "$$url" || true; \
	elif command -v xdg-open >/dev/null; then xdg-open "$$url"; \
	else echo "Ábrelo en el navegador"; fi

web: comprobar-env ## Abre la web del entorno en el navegador (a través de Nginx)
	@url="$$($(TF) output -raw url)"; echo "Web de $(ENV): $$url"; $(ABRIR)

grafana: comprobar-env ## Abre el panel de Grafana del entorno en el navegador (pide usuario y contraseña)
	@url="$$($(TF) output -raw grafana)/d/contenedores"; echo "Grafana de $(ENV): $$url"; $(ABRIR)

ps: comprobar-env ## Estado de los contenedores del entorno
	docker ps -a --filter name=tracker-$(ENV)- --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

test: comprobar-env ## Pasa los tests de la API a través de Nginx
	docker run --rm --network tracker-$(ENV)-frontend \
		-e BASE_URL=http://tracker-$(ENV)-balanceador \
		-v "$(CURDIR)/tests:/tests:ro" python:3.12-slim \
		sh -c "pip install --quiet --root-user-action=ignore pytest >/dev/null 2>&1 && python -m pytest -q -p no:cacheprovider /tests"

logs: comprobar-env ## Últimas líneas del log de un contenedor (SERVICIO=balanceador, web-1, db...)
	docker logs --tail 30 tracker-$(ENV)-$(SERVICIO)

stop-web: comprobar-env ## Para una réplica de la web, para probar la alta disponibilidad (WEB=2)
	docker stop tracker-$(ENV)-web-$(WEB)

start-web: comprobar-env ## Vuelve a arrancar una réplica parada (WEB=2)
	docker start tracker-$(ENV)-web-$(WEB)

stop-cache: comprobar-env ## Para Redis, para probar que la web sigue sin caché (solo prod)
	docker stop tracker-$(ENV)-cache

start-cache: comprobar-env ## Vuelve a arrancar Redis (solo prod)
	docker start tracker-$(ENV)-cache

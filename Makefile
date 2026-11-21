# Automatiza Terraform y las pruebas de cada entorno.
# Uso: make <comando> ENV=dev|prod   (si no se indica, ENV=dev)

.DEFAULT_GOAL := help

ENV ?= dev
TF  := terraform -chdir=terraform/envs/$(ENV)
PLAN := terraform/envs/$(ENV)/plan.tfplan

.PHONY: help comprobar-env init fmt validate plan apply destroy output ps test

help: ## Muestra esta ayuda
	@awk 'BEGIN {FS = ":.*## "; print "\nUso: make <comando> ENV=dev|prod (por defecto, dev)\n"} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-10s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
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

ps: comprobar-env ## Estado de los contenedores del entorno
	docker ps -a --filter name=tracker-$(ENV)- --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

test: comprobar-env ## Pasa los tests de la API contra la web del entorno
	docker run --rm --network tracker-$(ENV)-frontend \
		-e BASE_URL=http://tracker-$(ENV)-balanceador \
		-v "$(CURDIR)/tests:/tests:ro" python:3.12-slim \
		sh -c "pip install --quiet --root-user-action=ignore pytest >/dev/null 2>&1 && python -m pytest -q -p no:cacheprovider /tests"

locals {
  prefijo = "tracker-${var.entorno}"
}

resource "docker_network" "frontend" {
  name = "${local.prefijo}-frontend"
}

resource "docker_network" "backend" {
  name     = "${local.prefijo}-backend"
  internal = true
}

resource "docker_volume" "db_datos" {
  name = "${local.prefijo}-db-datos"
}

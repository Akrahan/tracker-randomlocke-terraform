resource "docker_network" "frontend" {
  name = "${var.prefijo}-frontend"
}

resource "docker_network" "backend" {
  name     = "${var.prefijo}-backend"
  internal = true
}

resource "docker_network" "almacenamiento" {
  name     = "${var.prefijo}-almacenamiento"
  internal = true
}

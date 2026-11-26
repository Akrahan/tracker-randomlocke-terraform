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

resource "docker_network" "monitorizacion" {
  name     = "${var.prefijo}-monitorizacion"
  internal = true
}

# Solo para Grafana: red NO interna, para que pueda publicar su puerto (en 127.0.0.1) y salir
# a internet (alertas a Telegram). Nadie más está en ella (mínimo privilegio).
resource "docker_network" "grafana" {
  name = "${var.prefijo}-grafana"
}

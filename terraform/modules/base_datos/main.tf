resource "docker_volume" "db_datos" {
  name = "${var.prefijo}-db-datos"
}

resource "docker_image" "postgres" {
  name         = "postgres:16"
  keep_locally = true
}

resource "docker_container" "db" {
  name    = "${var.prefijo}-db"
  image   = docker_image.postgres.image_id
  restart = "unless-stopped"

  env = [
    "POSTGRES_DB=${var.db_nombre}",
    "POSTGRES_USER=${var.db_usuario}",
    "POSTGRES_PASSWORD=${var.db_password}",
  ]

  networks_advanced {
    name = var.red_backend
  }

  volumes {
    volume_name    = docker_volume.db_datos.name
    container_path = "/var/lib/postgresql/data"
  }

  healthcheck {
    test         = ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
    interval     = "10s"
    timeout      = "5s"
    retries      = 5
    start_period = "20s"
  }

  wait = true
}

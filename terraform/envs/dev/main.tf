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

resource "docker_image" "postgres" {
  name         = "postgres:16"
  keep_locally = true
}

resource "docker_container" "db" {
  name    = "${local.prefijo}-db"
  image   = docker_image.postgres.image_id
  restart = "unless-stopped"

  env = [
    "POSTGRES_DB=${var.db_nombre}",
    "POSTGRES_USER=${var.db_usuario}",
    "POSTGRES_PASSWORD=${var.db_password}",
  ]

  networks_advanced {
    name = docker_network.backend.name
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

locals {
  ruta_app = "${path.module}/../../../app"
}

resource "docker_image" "web" {
  name = "${local.prefijo}-web:latest"

  build {
    context    = local.ruta_app
    dockerfile = "${local.ruta_app}/Dockerfile"
    builder    = "default"
  }

  triggers = {
    codigo = sha1(join("", [
      for f in sort(fileset(local.ruta_app, "**")) :
      filesha1("${local.ruta_app}/${f}") if !strcontains(f, "__pycache__")
    ]))
  }
}

locals {
  entorno_db = [
    "DB_HOST=${docker_container.db.name}",
    "POSTGRES_DB=${var.db_nombre}",
    "POSTGRES_USER=${var.db_usuario}",
    "POSTGRES_PASSWORD=${var.db_password}",
  ]
}

resource "docker_container" "preparar_db" {
  name     = "${local.prefijo}-preparar-db"
  image    = docker_image.web.image_id
  command  = ["python", "preparar_db.py"]
  env      = local.entorno_db
  must_run = false
  attach   = true
  logs     = true

  networks_advanced {
    name = docker_network.backend.name
  }

  lifecycle {
    postcondition {
      condition     = self.exit_code == 0
      error_message = "La preparación de la base de datos ha fallado (código de salida distinto de 0)."
    }
  }
}

resource "docker_container" "web" {
  name    = "${local.prefijo}-web"
  image   = docker_image.web.image_id
  restart = "unless-stopped"

  depends_on = [docker_container.preparar_db]

  env = concat(local.entorno_db, [
    "ENABLE_DOCS=true",
    "INICIALIZAR_DB=false",
  ])

  networks_advanced {
    name = docker_network.frontend.name
  }

  networks_advanced {
    name = docker_network.backend.name
  }

  ports {
    internal = 8000
    external = var.puerto_web
    ip       = "127.0.0.1"
  }

  healthcheck {
    test         = ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/status', timeout=3)"]
    interval     = "10s"
    timeout      = "5s"
    retries      = 3
    start_period = "30s"
  }

  wait         = true
  wait_timeout = 120
}

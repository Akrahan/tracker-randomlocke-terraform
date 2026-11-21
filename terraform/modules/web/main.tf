locals {
  entorno_db = [
    "DB_HOST=${var.db_host}",
    "POSTGRES_DB=${var.db_nombre}",
    "POSTGRES_USER=${var.db_usuario}",
    "POSTGRES_PASSWORD=${var.db_password}",
  ]
}

resource "docker_image" "web" {
  name = "${var.prefijo}-web:latest"
  build {
    context    = var.ruta_app
    dockerfile = "${var.ruta_app}/Dockerfile"
    builder    = "default"
  }

  triggers = {
    codigo = sha1(join("", [
      for f in sort(fileset(var.ruta_app, "**")) :
      filesha1("${var.ruta_app}/${f}") if !strcontains(f, "__pycache__")
    ]))
  }
}

resource "docker_container" "preparar_db" {
  name     = "${var.prefijo}-preparar-db"
  image    = docker_image.web.image_id
  command  = ["python", "preparar_db.py"]
  env      = local.entorno_db
  must_run = false
  attach   = true
  logs     = true

  networks_advanced {
    name = var.red_backend
  }

  lifecycle {
    postcondition {
      condition     = self.exit_code == 0
      error_message = "La preparación de la base de datos ha fallado (código de salida distinto de 0)."
    }
  }
}

resource "docker_container" "web" {
  count   = var.replicas
  name    = "${var.prefijo}-web-${count.index + 1}"
  image   = docker_image.web.image_id
  restart = "unless-stopped"

  depends_on = [docker_container.preparar_db]

  env = concat(local.entorno_db, [
    "ENABLE_DOCS=${var.docs_activadas}",
    "INICIALIZAR_DB=false",
    "INSTANCIA=${var.prefijo}-web-${count.index + 1}",
    ], var.cache_activada ? [
    "CACHE_ENABLED=true",
    "CACHE_HOST=${var.cache_host}",
    "REDIS_PASSWORD=${var.cache_password}",
  ] : [])

  networks_advanced {
    name = var.red_frontend
  }

  networks_advanced {
    name = var.red_backend
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

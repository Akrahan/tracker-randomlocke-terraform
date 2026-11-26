resource "docker_image" "telegraf" {
  name         = "telegraf:1.38"
  keep_locally = true
}

resource "docker_image" "prometheus" {
  name         = "prom/prometheus:v3.16.0"
  keep_locally = true
}

resource "docker_image" "grafana" {
  name         = "grafana/grafana:13.3.2"
  keep_locally = true
}

# Telegraf (en lugar de cAdvisor): pregunta a la API de Docker por el estado, la CPU y la memoria de cada
# contenedor. Con Docker Desktop + WSL, cAdvisor no ve los contenedores (le prestan las carpetas de Ubuntu);
# la API, por el socket, sí llega al motor. Solo el socket; sin puertos y en la red interna.
resource "docker_container" "telegraf" {
  name    = "${var.prefijo}-telegraf"
  image   = docker_image.telegraf.image_id
  restart = "unless-stopped"

  upload {
    content = templatefile("${path.module}/telegraf.conf.tftpl", {
      prefijo = var.prefijo
    })
    file = "/etc/telegraf/telegraf.conf"
  }

  networks_advanced {
    name = var.red_monitorizacion
  }

  # El socket de Docker: :ro impide modificar el fichero, pero no hablar por él (ver conceptos)
  volumes {
    host_path      = "/var/run/docker.sock"
    container_path = "/var/run/docker.sock"
    read_only      = true
  }

  # Telegraf no se ejecuta como root: se le añade el grupo dueño del socket para poder usarlo
  group_add = [tostring(var.gid_docker)]
}

resource "docker_volume" "prometheus" {
  name = "${var.prefijo}-prometheus-datos"
}

# Prometheus: pregunta a Telegraf cada 15 s y guarda el historial (7 días) de este entorno.
resource "docker_container" "prometheus" {
  name    = "${var.prefijo}-prometheus"
  image   = docker_image.prometheus.image_id
  restart = "unless-stopped"

  command = [
    "--config.file=/etc/prometheus/prometheus.yml",
    "--storage.tsdb.path=/prometheus",
    "--storage.tsdb.retention.time=7d",
  ]

  upload {
    content = templatefile("${path.module}/prometheus.yml.tftpl", {
      telegraf = docker_container.telegraf.name
    })
    file = "/etc/prometheus/prometheus.yml"
  }

  networks_advanced {
    name = var.red_monitorizacion
  }

  # /prometheus ya es del usuario «nobody» en la imagen: Docker copia ese dueño al volumen vacío
  volumes {
    volume_name    = docker_volume.prometheus.name
    container_path = "/prometheus"
  }

  healthcheck {
    test         = ["CMD", "wget", "-q", "-O", "/dev/null", "http://localhost:9090/-/healthy"]
    interval     = "10s"
    timeout      = "5s"
    retries      = 3
    start_period = "10s"
  }

  wait = true
}

resource "docker_volume" "grafana" {
  name = "${var.prefijo}-grafana-datos"
}

# Grafana: paneles (y en la fase 5.3, alertas). Fuente de datos y panel creados al arrancar
# (provisioning), sin configurar nada a mano. Cerrado: sin acceso anónimo ni registro, contraseña
# sensitive, puerto solo en 127.0.0.1.
resource "docker_container" "grafana" {
  name    = "${var.prefijo}-grafana"
  image   = docker_image.grafana.image_id
  restart = "unless-stopped"

  env = [
    "GF_SECURITY_ADMIN_USER=${var.grafana_usuario}",
    "GF_SECURITY_ADMIN_PASSWORD=${var.grafana_password}",
    "GF_AUTH_ANONYMOUS_ENABLED=false",
    "GF_USERS_ALLOW_SIGN_UP=false",
    "GF_SECURITY_DISABLE_GRAVATAR=true",
    # Que no envíe datos de uso ni busque novedades en internet
    "GF_ANALYTICS_REPORTING_ENABLED=false",
    "GF_ANALYTICS_CHECK_FOR_UPDATES=false",
    "GF_ANALYTICS_CHECK_FOR_PLUGIN_UPDATES=false",
    "GF_NEWS_NEWS_FEED_ENABLED=false",
  ]

  upload {
    content = templatefile("${path.module}/grafana-datasources.yml.tftpl", {
      prometheus = "http://${docker_container.prometheus.name}:9090"
    })
    file = "/etc/grafana/provisioning/datasources/prometheus.yml"
  }

  upload {
    content = file("${path.module}/grafana-dashboards.yml")
    file    = "/etc/grafana/provisioning/dashboards/tracker.yml"
  }

  upload {
    content = file("${path.module}/panel-contenedores.json")
    file    = "/etc/grafana/dashboards/contenedores.json"
  }

  # monitorizacion (interna): para preguntar a Prometheus.
  # grafana (no interna, solo Grafana): para publicar su puerto y, en el 5.3, salir a Telegram.
  networks_advanced {
    name = var.red_monitorizacion
  }

  networks_advanced {
    name = var.red_grafana
  }

  ports {
    internal = 3000
    external = var.puerto_grafana
    ip       = "127.0.0.1"
  }

  # /var/lib/grafana ya es del usuario de Grafana (472) en la imagen: Docker copia ese dueño al volumen vacío
  volumes {
    volume_name    = docker_volume.grafana.name
    container_path = "/var/lib/grafana"
  }

  healthcheck {
    test         = ["CMD", "wget", "-q", "-O", "/dev/null", "http://localhost:3000/api/health"]
    interval     = "10s"
    timeout      = "5s"
    retries      = 5
    start_period = "30s"
  }

  wait         = true
  wait_timeout = 120
}

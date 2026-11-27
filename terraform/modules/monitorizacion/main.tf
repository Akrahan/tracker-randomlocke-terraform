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

resource "docker_image" "loki" {
  name         = "grafana/loki:3.7.4"
  keep_locally = true
}

resource "docker_image" "alloy" {
  name         = "grafana/alloy:v1.22.0"
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

resource "docker_volume" "loki" {
  name = "${var.prefijo}-loki-datos"
}

# Loki: guarda los logs de este entorno 7 días y responde a las búsquedas de Grafana.
# Sin puertos y en la red interna. Sin healthcheck en Docker: la imagen es mínima
# (sin shell ni wget, como MinIO); Alloy reintenta los envíos si aún no está listo.
resource "docker_container" "loki" {
  name    = "${var.prefijo}-loki"
  image   = docker_image.loki.image_id
  restart = "unless-stopped"

  command = ["-config.file=/etc/loki/config.yaml"]

  upload {
    content = file("${path.module}/loki.yaml")
    file    = "/etc/loki/config.yaml"
  }

  networks_advanced {
    name = var.red_monitorizacion
  }

  # Loki se ejecuta como el usuario 10001, dueño de /loki en la imagen: Docker copia ese dueño al volumen vacío
  volumes {
    volume_name    = docker_volume.loki.name
    container_path = "/loki"
  }
}

resource "docker_volume" "alloy" {
  name = "${var.prefijo}-alloy-datos"
}

# Alloy: recoge los logs de los contenedores de este entorno por la API de Docker (el socket,
# como Telegraf) y los envía a Loki. Sin puertos y en la red interna.
resource "docker_container" "alloy" {
  name    = "${var.prefijo}-alloy"
  image   = docker_image.alloy.image_id
  restart = "unless-stopped"

  command = [
    "run", "/etc/alloy/config.alloy",
    "--storage.path=/var/lib/alloy/data",
    "--disable-reporting",
  ]

  upload {
    content = templatefile("${path.module}/alloy.config.tftpl", {
      prefijo = var.prefijo
      loki    = "http://${docker_container.loki.name}:3100"
    })
    file = "/etc/alloy/config.alloy"
  }

  networks_advanced {
    name = var.red_monitorizacion
  }

  # Solo el socket de Docker (el :ro no lo hace de solo lectura: ver conceptos)
  volumes {
    host_path      = "/var/run/docker.sock"
    container_path = "/var/run/docker.sock"
    read_only      = true
  }

  # Posiciones: por qué línea va de cada contenedor. /var/lib/alloy/data ya es del usuario alloy
  volumes {
    volume_name    = docker_volume.alloy.name
    container_path = "/var/lib/alloy/data"
  }

  # La imagen se ejecuta como root: se usa su usuario alloy (mínimo privilegio)
  # y se le añade el grupo dueño del socket, como a Telegraf
  user      = "alloy"
  group_add = [tostring(var.gid_docker)]
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
      loki       = "http://${docker_container.loki.name}:3100"
    })
    file = "/etc/grafana/provisioning/datasources/fuentes.yml"
  }

  upload {
    content = file("${path.module}/grafana-dashboards.yml")
    file    = "/etc/grafana/provisioning/dashboards/tracker.yml"
  }

  upload {
    content = file("${path.module}/panel-contenedores.json")
    file    = "/etc/grafana/dashboards/contenedores.json"
  }

  # Reglas de alerta (web caída, CPU alta, servicio caído y errores 5xx), iguales en los dos entornos
  upload {
    content = templatefile("${path.module}/grafana-alertas.yml.tftpl", {
      prefijo      = var.prefijo
      replicas_web = var.replicas_web
      servicios    = var.servicios_criticos
    })
    file = "/etc/grafana/provisioning/alerting/alertas.yml"
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

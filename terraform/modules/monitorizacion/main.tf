resource "docker_image" "telegraf" {
  name         = "telegraf:1.38"
  keep_locally = true
}

resource "docker_image" "prometheus" {
  name         = "prom/prometheus:v3.16.0"
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

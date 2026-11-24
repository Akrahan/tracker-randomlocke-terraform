resource "docker_image" "nginx" {
  name         = "nginx:1.28-alpine"
  keep_locally = true
}

resource "docker_container" "balanceador" {
  name    = "${var.prefijo}-balanceador"
  image   = docker_image.nginx.image_id
  restart = "unless-stopped"

  networks_advanced {
    name = var.red_frontend
  }

  # Para llegar a MinIO (los dibujos); Nginx no entra en backend, así que no ve la base de datos
  networks_advanced {
    name = var.red_almacenamiento
  }

  ports {
    internal = 80
    external = var.puerto
    ip       = "127.0.0.1"
  }

  upload {
    content = templatefile("${path.module}/nginx.conf.tftpl", {
      webs        = var.webs
      puerto_webs = var.puerto_webs
      minio_host  = var.minio_host
      bucket      = var.bucket
    })
    file = "/etc/nginx/conf.d/default.conf"
  }

  healthcheck {
    test         = ["CMD", "wget", "-q", "-O", "/dev/null", "http://127.0.0.1/nginx-salud"]
    interval     = "10s"
    timeout      = "5s"
    retries      = 3
    start_period = "5s"
  }

  wait = true
}

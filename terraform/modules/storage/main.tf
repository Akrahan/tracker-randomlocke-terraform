resource "docker_image" "minio" {
  # MinIO compilado por Chainguard, fijado por su huella (decisión del 4.1.1)
  name         = "cgr.dev/chainguard/minio@sha256:f2e56aceb4d38ad9b05c901270946e2353b19f86ba4396f25cf75b15b455b38c"
  keep_locally = true
}

resource "docker_volume" "datos" {
  name = "${var.prefijo}-minio-datos"
}

resource "docker_container" "minio" {
  name     = "${var.prefijo}-minio"
  image    = docker_image.minio.image_id
  restart  = "unless-stopped"
  must_run = false # un plan no borra el contenedor si está parado (ver modules/web)

  # MinIO guarda los ficheros en esta carpeta, dentro del volumen
  command = ["server", "/home/nonroot/datos"]

  env = [
    "MINIO_ROOT_USER=${var.usuario}",
    "MINIO_ROOT_PASSWORD=${var.password}",
    # Sin consola web: exposición mínima (los ficheros llegan por Nginx)
    "MINIO_BROWSER=off",
  ]

  networks_advanced {
    name = var.red_almacenamiento
  }

  # El volumen va en /home/nonroot (la «casa» del usuario 65532 en la imagen):
  # Docker le da al volumen vacío el mismo dueño, y MinIO puede escribir sin ser root.
  volumes {
    volume_name    = docker_volume.datos.name
    container_path = "/home/nonroot"
  }
}

# Script de inicialización (contenedor de un solo uso, como preparar_db): crea el bucket, le pone
# lectura pública de sus objetos y sube los dibujos que falten. Si cambia el script, se vuelve a ejecutar.
resource "docker_image" "sprites" {
  name = "${var.prefijo}-sprites:latest"
  build {
    context    = var.ruta_sprites
    dockerfile = "${var.ruta_sprites}/Dockerfile"
    builder    = "default"
  }

  triggers = {
    codigo = sha1(join("", [
      for f in sort(fileset(var.ruta_sprites, "**")) :
      filesha1("${var.ruta_sprites}/${f}") if !strcontains(f, "__pycache__")
    ]))
  }
}

resource "docker_container" "subir_sprites" {
  name     = "${var.prefijo}-subir-sprites"
  image    = docker_image.sprites.image_id
  must_run = false
  attach   = true
  logs     = true

  env = [
    "MINIO_ENDPOINT=http://${docker_container.minio.name}:9000",
    "MINIO_USUARIO=${var.usuario}",
    "MINIO_PASSWORD=${var.password}",
    "BUCKET=${var.bucket}",
  ]

  # almacenamiento: para hablar con MinIO; red_salida (frontend): para descargar los dibujos de internet
  networks_advanced {
    name = var.red_almacenamiento
  }

  networks_advanced {
    name = var.red_salida
  }

  lifecycle {
    postcondition {
      condition     = self.exit_code == 0
      error_message = "La subida de los dibujos a MinIO ha fallado (código de salida distinto de 0)."
    }
  }
}

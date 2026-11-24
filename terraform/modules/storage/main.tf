resource "docker_image" "minio" {
  # MinIO compilado por Chainguard, fijado por su huella (decisión del 4.1.1)
  name         = "cgr.dev/chainguard/minio@sha256:f2e56aceb4d38ad9b05c901270946e2353b19f86ba4396f25cf75b15b455b38c"
  keep_locally = true
}

resource "docker_volume" "datos" {
  name = "${var.prefijo}-minio-datos"
}

resource "docker_container" "minio" {
  name    = "${var.prefijo}-minio"
  image   = docker_image.minio.image_id
  restart = "unless-stopped"

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

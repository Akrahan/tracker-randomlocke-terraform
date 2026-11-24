output "host" {
  description = "Nombre del contenedor de MinIO en la red (para Nginx y el script de inicialización)"
  value       = docker_container.minio.name
}

output "bucket" {
  description = "Bucket con los dibujos, de lectura pública (para la ruta /sprites/ de Nginx)"
  value       = var.bucket
}

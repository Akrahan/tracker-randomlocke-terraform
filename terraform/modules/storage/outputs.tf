output "host" {
  description = "Nombre del contenedor de MinIO en la red (para Nginx y el script de inicialización)"
  value       = docker_container.minio.name
}

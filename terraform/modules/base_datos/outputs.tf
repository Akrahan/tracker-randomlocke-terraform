output "host" {
  description = "Nombre del contenedor de PostgreSQL; es su nombre en la red (DB_HOST de la web)"
  value       = docker_container.db.name
}

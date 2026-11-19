output "host" {
  description = "Nombre del contenedor de Redis; es su nombre en la red (CACHE_HOST de la web)"
  value       = docker_container.cache.name
}

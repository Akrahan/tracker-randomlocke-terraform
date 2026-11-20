output "urls" {
  description = "Dirección de cada réplica (temporal, hasta que esté Nginx)"
  value       = [for c in docker_container.web : "http://127.0.0.1:${c.ports[0].external}"]
}

output "nombres" {
  description = "Nombres de las réplicas en la red, para el balanceador"
  value       = docker_container.web[*].name
}

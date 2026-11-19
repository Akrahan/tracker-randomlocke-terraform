output "frontend" {
  description = "Nombre de la red frontend"
  value       = docker_network.frontend.name
}

output "backend" {
  description = "Nombre de la red backend (interna, sin internet)"
  value       = docker_network.backend.name
}

output "nombres" {
  description = "Nombres de las réplicas en la red, para el balanceador"
  value       = docker_container.web[*].name
}

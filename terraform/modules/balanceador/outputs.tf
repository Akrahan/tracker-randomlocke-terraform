output "nombre" {
  description = "Nombre del contenedor de Nginx en la red"
  value       = docker_container.balanceador.name
}

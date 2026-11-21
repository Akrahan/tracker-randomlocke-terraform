output "nombre" {
  description = "Nombre del contenedor de Nginx en la red"
  value       = docker_container.balanceador.name
}

output "url" {
  description = "Dirección de la aplicación (entrada por Nginx)"
  value       = "http://127.0.0.1:${docker_container.balanceador.ports[0].external}"
}

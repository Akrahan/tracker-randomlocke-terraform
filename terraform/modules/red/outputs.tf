output "frontend" {
  description = "Nombre de la red frontend"
  value       = docker_network.frontend.name
}

output "backend" {
  description = "Nombre de la red backend (interna, sin internet)"
  value       = docker_network.backend.name
}

output "almacenamiento" {
  description = "Nombre de la red de almacenamiento (interna: MinIO, Nginx y el script de inicialización)"
  value       = docker_network.almacenamiento.name
}

output "monitorizacion" {
  description = "Nombre de la red de monitorización (interna: cAdvisor, Prometheus, Loki, Alloy y Grafana)"
  value       = docker_network.monitorizacion.name
}

output "grafana" {
  description = "Nombre de la red de Grafana (no interna: puerto publicado y salida a Telegram; solo Grafana)"
  value       = docker_network.grafana.name
}

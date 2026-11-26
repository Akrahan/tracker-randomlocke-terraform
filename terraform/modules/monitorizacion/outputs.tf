output "prometheus" {
  description = "Dirección de Prometheus en la red interna (para Grafana)"
  value       = "http://${docker_container.prometheus.name}:9090"
}

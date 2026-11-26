output "prometheus" {
  description = "Dirección de Prometheus en la red interna (para Grafana)"
  value       = "http://${docker_container.prometheus.name}:9090"
}

output "grafana" {
  description = "Dirección de Grafana en este ordenador"
  value       = "http://127.0.0.1:${docker_container.grafana.ports[0].external}"
}

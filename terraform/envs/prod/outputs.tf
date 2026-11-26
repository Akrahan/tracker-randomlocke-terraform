output "url" {
  description = "Dirección de la aplicación de este entorno (entrada por Nginx)"
  value       = module.balanceador.url
}

output "grafana" {
  description = "Dirección de Grafana de este entorno (solo desde este ordenador)"
  value       = module.monitorizacion.grafana
}

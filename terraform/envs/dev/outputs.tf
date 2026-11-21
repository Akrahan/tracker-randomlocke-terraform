output "url" {
  description = "Dirección de la aplicación de este entorno (entrada por Nginx)"
  value       = module.balanceador.url
}

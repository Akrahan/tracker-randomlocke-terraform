output "urls" {
  description = "Dirección de cada réplica de la web (temporal, hasta que esté Nginx)"
  value       = module.web.urls
}

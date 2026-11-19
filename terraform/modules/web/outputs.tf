output "url" {
  description = "Dirección para abrir la web en el navegador"
  value       = "http://127.0.0.1:${docker_container.web.ports[0].external}"
}

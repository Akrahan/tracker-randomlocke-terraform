variable "prefijo" {
  description = "Prefijo de los nombres de los recursos (por ejemplo, tracker-prod)"
  type        = string
}

variable "red_backend" {
  description = "Nombre de la red interna a la que se conecta Redis"
  type        = string
}

variable "password" {
  description = "Contraseña de Redis"
  type        = string
  sensitive   = true
}

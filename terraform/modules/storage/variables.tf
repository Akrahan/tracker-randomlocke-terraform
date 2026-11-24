variable "prefijo" {
  description = "Prefijo de los nombres de los recursos (por ejemplo, tracker-prod)"
  type        = string
}

variable "red_almacenamiento" {
  description = "Red interna en la que está MinIO"
  type        = string
}

variable "usuario" {
  description = "Usuario administrador de MinIO"
  type        = string
  sensitive   = true
}

variable "password" {
  description = "Contraseña del administrador de MinIO (8 caracteres como mínimo)"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.password) >= 8
    error_message = "MinIO exige una contraseña de al menos 8 caracteres."
  }
}

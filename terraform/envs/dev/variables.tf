variable "entorno" {
  description = "Nombre del entorno; forma parte del nombre de todos los recursos"
  type        = string

  validation {
    condition     = contains(["dev", "prod"], var.entorno)
    error_message = "El entorno debe ser \"dev\" o \"prod\"."
  }
}

variable "db_nombre" {
  description = "Nombre de la base de datos de la aplicación"
  type        = string
}

variable "db_usuario" {
  description = "Usuario de PostgreSQL"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "Contraseña del usuario de PostgreSQL"
  type        = string
  sensitive   = true
}

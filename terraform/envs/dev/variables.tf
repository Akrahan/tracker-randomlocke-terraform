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

variable "puerto_web" {
  description = "Puerto de tu ordenador por el que se abre la web"
  type        = number
}

variable "docs_activadas" {
  description = "Si es true, la web publica su documentación interactiva (/docs)"
  type        = bool
}

variable "cache_activada" {
  description = "Si es true, se crea la caché Redis y la web la usa"
  type        = bool
}

variable "redis_password" {
  description = "Contraseña de Redis (solo hace falta si cache_activada es true)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "replicas_web" {
  description = "Número de copias de la web"
  type        = number
}

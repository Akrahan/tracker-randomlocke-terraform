variable "prefijo" {
  description = "Prefijo de los nombres de los recursos (por ejemplo, tracker-dev)"
  type        = string
}

variable "red_backend" {
  description = "Nombre de la red interna a la que se conecta PostgreSQL"
  type        = string
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

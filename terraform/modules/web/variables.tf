variable "prefijo" {
  description = "Prefijo de los nombres de los recursos (por ejemplo, tracker-dev)"
  type        = string
}

variable "ruta_app" {
  description = "Ruta a la carpeta app/ con el código y el Dockerfile de la web"
  type        = string
}

variable "red_frontend" {
  description = "Nombre de la red por la que se llega a la web"
  type        = string
}

variable "red_backend" {
  description = "Nombre de la red interna por la que la web habla con PostgreSQL"
  type        = string
}

variable "db_host" {
  description = "Nombre del contenedor de PostgreSQL en la red (DB_HOST)"
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

variable "puerto" {
  description = "Puerto de este ordenador por el que se abre la web"
  type        = number
}

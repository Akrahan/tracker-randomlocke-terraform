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
  description = "Puerto de tu ordenador por el que se entra a la aplicación (lo publica Nginx)"
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

variable "minio_usuario" {
  description = "Usuario administrador de MinIO"
  type        = string
  sensitive   = true
}

variable "minio_password" {
  description = "Contraseña del administrador de MinIO (8 caracteres como mínimo)"
  type        = string
  sensitive   = true
}

variable "gid_docker" {
  description = "Grupo (número) dueño del socket de Docker, para Telegraf. Lo pasa el Makefile (TF_VAR_gid_docker)"
  type        = number
}

variable "puerto_grafana" {
  description = "Puerto de tu ordenador por el que se abre Grafana (solo en 127.0.0.1)"
  type        = number
}

variable "grafana_usuario" {
  description = "Usuario administrador de Grafana"
  type        = string
  sensitive   = true
}

variable "grafana_password" {
  description = "Contraseña del administrador de Grafana (12 caracteres como mínimo)"
  type        = string
  sensitive   = true
}

variable "telegram_activado" {
  description = "Si las alertas se envían a Telegram (solo en prod; en dev se ven en Grafana)"
  type        = bool
  default     = false
}

variable "telegram_token" {
  description = "Token del bot de Telegram (lo da @BotFather). Solo hace falta si telegram_activado es true"
  type        = string
  sensitive   = true
  default     = ""

  validation {
    condition     = !var.telegram_activado || can(regex("^[0-9]+:[A-Za-z0-9_-]+$", var.telegram_token))
    error_message = "Con telegram_activado = true hace falta un telegram_token válido (número:letras) en secrets.auto.tfvars."
  }
}

variable "telegram_chat_id" {
  description = "ID del chat al que escribe el bot (el número de \"chat\":{\"id\": en getUpdates)"
  type        = string
  sensitive   = true
  default     = ""

  validation {
    condition     = !var.telegram_activado || can(regex("^-?[0-9]+$", var.telegram_chat_id))
    error_message = "Con telegram_activado = true hace falta un telegram_chat_id numérico en secrets.auto.tfvars."
  }
}

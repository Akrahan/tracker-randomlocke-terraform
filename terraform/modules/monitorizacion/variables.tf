variable "prefijo" {
  description = "Prefijo de los nombres de los recursos (por ejemplo, tracker-prod)"
  type        = string
}

variable "red_monitorizacion" {
  description = "Red interna de la monitorización"
  type        = string
}

variable "gid_docker" {
  description = "Grupo (número) dueño del socket de Docker: Telegraf lo necesita para preguntar a la API sin ser root. Lo calcula el Makefile (stat -c %g /var/run/docker.sock)"
  type        = number
}

variable "red_grafana" {
  description = "Red propia de Grafana, no interna (puerto publicado y salida a internet)"
  type        = string
}

variable "puerto_grafana" {
  description = "Puerto de este ordenador por el que se abre Grafana (solo en 127.0.0.1)"
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

  validation {
    condition     = length(var.grafana_password) >= 12
    error_message = "La contraseña de Grafana debe tener al menos 12 caracteres."
  }
}

variable "replicas_web" {
  description = "Número de webs desplegadas: la alerta «Web caída» salta si hay menos en marcha"
  type        = number
}

variable "servicios_criticos" {
  description = "Servicios sin los que la app no funciona (sin el prefijo): la alerta «Servicio caído» salta si falta alguno"
  type        = list(string)
}

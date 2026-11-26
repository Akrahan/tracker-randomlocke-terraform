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

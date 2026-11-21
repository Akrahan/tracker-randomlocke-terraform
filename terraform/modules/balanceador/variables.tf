variable "prefijo" {
  description = "Prefijo de los nombres de los recursos (por ejemplo, tracker-prod)"
  type        = string
}

variable "red_frontend" {
  description = "Red por la que Nginx habla con las webs"
  type        = string
}

variable "webs" {
  description = "Nombres de las réplicas de la web en la red"
  type        = list(string)
}

variable "puerto_webs" {
  description = "Puerto en el que escuchan las webs dentro de su contenedor"
  type        = number
  default     = 8000
}

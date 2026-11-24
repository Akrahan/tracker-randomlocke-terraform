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

variable "puerto" {
  description = "Puerto de este ordenador por el que se entra a la aplicación (la única puerta)"
  type        = number
}

variable "red_almacenamiento" {
  description = "Red interna de MinIO, para servir los dibujos"
  type        = string
}

variable "minio_host" {
  description = "Nombre del contenedor de MinIO en la red"
  type        = string
}

variable "bucket" {
  description = "Bucket con los dibujos (de lectura pública)"
  type        = string
}

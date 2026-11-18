variable "entorno" {
  description = "Nombre del entorno; forma parte del nombre de todos los recursos"
  type        = string

  validation {
    condition     = contains(["dev", "prod"], var.entorno)
    error_message = "El entorno debe ser \"dev\" o \"prod\"."
  }
}

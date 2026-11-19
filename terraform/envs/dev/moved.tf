# Los recursos de dev pasaron a módulos. Estos bloques le indican a Terraform
# que son los mismos recursos con otra dirección, para no destruirlos.

moved {
  from = docker_network.frontend
  to   = module.red.docker_network.frontend
}

moved {
  from = docker_network.backend
  to   = module.red.docker_network.backend
}

moved {
  from = docker_volume.db_datos
  to   = module.base_datos.docker_volume.db_datos
}

moved {
  from = docker_image.postgres
  to   = module.base_datos.docker_image.postgres
}

moved {
  from = docker_container.db
  to   = module.base_datos.docker_container.db
}

moved {
  from = docker_image.web
  to   = module.web.docker_image.web
}

moved {
  from = docker_container.preparar_db
  to   = module.web.docker_container.preparar_db
}

moved {
  from = docker_container.web
  to   = module.web.docker_container.web
}

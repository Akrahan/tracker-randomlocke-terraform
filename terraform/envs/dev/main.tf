locals {
  prefijo = "tracker-${var.entorno}"
}

module "red" {
  source  = "../../modules/red"
  prefijo = local.prefijo
}

module "base_datos" {
  source = "../../modules/base_datos"

  prefijo     = local.prefijo
  red_backend = module.red.backend
  db_nombre   = var.db_nombre
  db_usuario  = var.db_usuario
  db_password = var.db_password
}

module "web" {
  source = "../../modules/web"

  prefijo        = local.prefijo
  ruta_app       = "${path.module}/../../../app"
  red_frontend   = module.red.frontend
  red_backend    = module.red.backend
  db_host        = module.base_datos.host
  db_nombre      = var.db_nombre
  db_usuario     = var.db_usuario
  db_password    = var.db_password
  replicas       = var.replicas_web
  docs_activadas = var.docs_activadas
  cache_activada = var.cache_activada
  cache_host     = var.cache_activada ? module.cache[0].host : ""
  cache_password = var.redis_password
}

module "cache" {
  source = "../../modules/cache"
  count  = var.cache_activada ? 1 : 0

  prefijo     = local.prefijo
  red_backend = module.red.backend
  password    = var.redis_password
}

module "balanceador" {
  source = "../../modules/balanceador"

  prefijo            = local.prefijo
  red_frontend       = module.red.frontend
  red_almacenamiento = module.red.almacenamiento
  webs               = module.web.nombres
  minio_host         = module.storage.host
  bucket             = module.storage.bucket
  puerto             = var.puerto_web
}

module "storage" {
  source = "../../modules/storage"

  prefijo            = local.prefijo
  red_almacenamiento = module.red.almacenamiento
  red_salida         = module.red.frontend
  ruta_sprites       = "${path.module}/../../../scripts/sprites"
  usuario            = var.minio_usuario
  password           = var.minio_password
}

module "monitorizacion" {
  source = "../../modules/monitorizacion"

  prefijo            = local.prefijo
  red_monitorizacion = module.red.monitorizacion
  gid_docker         = var.gid_docker
}

resource "docker_image" "redis" {
  name         = "redis:7-alpine"
  keep_locally = true
}

resource "docker_container" "cache" {
  name    = "${var.prefijo}-cache"
  image   = docker_image.redis.image_id
  restart = "unless-stopped"
  user    = "redis"

  # must_run = false: si el contenedor está parado (make stop-*), un terraform plan no lo borra.
  # Con el valor por defecto (true), el provider de Docker borra los contenedores parados al
  # leer el estado, incluso en un plan (pasó con web-2 el 27 nov.). Docker lo sigue
  # reiniciando solo si se cae (restart), y make start-* lo vuelve a arrancar.
  must_run = false

  env = ["REDIS_PASSWORD=${var.password}"]

  command = ["sh", "-c", "exec redis-server --requirepass \"$REDIS_PASSWORD\" --save \"\" --appendonly no"]

  networks_advanced {
    name = var.red_backend
  }

  healthcheck {
    test         = ["CMD-SHELL", "REDISCLI_AUTH=$REDIS_PASSWORD redis-cli ping | grep -q PONG"]
    interval     = "10s"
    timeout      = "5s"
    retries      = 5
    start_period = "5s"
  }

  wait = true
}

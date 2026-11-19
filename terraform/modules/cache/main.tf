resource "docker_image" "redis" {
  name         = "redis:7-alpine"
  keep_locally = true
}

resource "docker_container" "cache" {
  name    = "${var.prefijo}-cache"
  image   = docker_image.redis.image_id
  restart = "unless-stopped"
  user    = "redis"

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

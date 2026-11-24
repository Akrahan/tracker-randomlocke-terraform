"""Prepara el bucket de los dibujos en MinIO y sube los que falten (contenedor de un solo uso).

1. Espera a que MinIO responda (/minio/health/live).
2. Crea el bucket si no existe y le pone una política de lectura pública solo para sus objetos: cualquiera
   puede pedir un dibujo por su nombre, pero nadie puede listar, subir ni borrar sin credenciales.
3. Mira qué dibujos hay ya y descarga solo los que faltan del repositorio público PokeAPI/sprites:
   1-649 en pixel art de 5.ª generación (Blanco/Negro); 650-1025 no existen en ese estilo y se usa el dibujo
   por defecto. Les recorta el margen transparente (como hacía el script de la P1) y los sube como image/png.

Es idempotente: si ya están todos, no descarga nada. Termina con código 1 si falla algún dibujo.
Las claves son «25.png» y «shiny/25.png», así que la ruta /sprites/25.png del navegador coincide con
«bucket/clave» en MinIO. Usa boto3, el cliente oficial de AWS: el mismo código serviría contra Amazon S3.
"""
import io
import json
import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import boto3
from botocore.config import Config
from PIL import Image

ENDPOINT = os.environ["MINIO_ENDPOINT"]  # por ejemplo, http://tracker-prod-minio:9000
BUCKET = os.environ.get("BUCKET", "sprites")
ORIGEN = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon"
ULTIMA_ESPECIE = 1025
ULTIMA_QUINTA_GEN = 649

s3 = boto3.client(
    "s3",
    endpoint_url=ENDPOINT,
    aws_access_key_id=os.environ["MINIO_USUARIO"],
    aws_secret_access_key=os.environ["MINIO_PASSWORD"],
    region_name="us-east-1",  # MinIO no usa regiones, pero boto3 necesita una
    config=Config(signature_version="s3v4", retries={"max_attempts": 3}),
)

# Lectura pública de los objetos del bucket (s3:GetObject); sin ListBucket, PutObject ni DeleteObject
POLITICA = {
    "Version": "2012-10-17",
    "Statement": [{
        "Effect": "Allow",
        "Principal": {"AWS": ["*"]},
        "Action": ["s3:GetObject"],
        "Resource": [f"arn:aws:s3:::{BUCKET}/*"],
    }],
}


def esperar_minio(intentos: int = 30) -> None:
    for _ in range(intentos):
        try:
            urllib.request.urlopen(f"{ENDPOINT}/minio/health/live", timeout=2)
            return
        except Exception:
            time.sleep(1)
    sys.exit(f"MinIO no responde en {ENDPOINT}")


def preparar_bucket() -> None:
    existentes = [b["Name"] for b in s3.list_buckets().get("Buckets", [])]
    if BUCKET not in existentes:
        s3.create_bucket(Bucket=BUCKET)
        print(f"bucket «{BUCKET}» creado")
    s3.put_bucket_policy(Bucket=BUCKET, Policy=json.dumps(POLITICA))


def claves_existentes() -> set[str]:
    claves = set()
    for pagina in s3.get_paginator("list_objects_v2").paginate(Bucket=BUCKET):
        claves.update(objeto["Key"] for objeto in pagina.get("Contents", []))
    return claves


def clave(numero: int, shiny: bool) -> str:
    return f"shiny/{numero}.png" if shiny else f"{numero}.png"


def url(numero: int, shiny: bool) -> str:
    carpeta = "shiny/" if shiny else ""
    if numero <= ULTIMA_QUINTA_GEN:
        return f"{ORIGEN}/versions/generation-v/black-white/{carpeta}{numero}.png"
    return f"{ORIGEN}/{carpeta}{numero}.png"


def subir(trabajo: tuple[int, bool]) -> str:
    numero, shiny = trabajo
    try:
        with urllib.request.urlopen(url(numero, shiny), timeout=20) as respuesta:
            imagen = Image.open(io.BytesIO(respuesta.read())).convert("RGBA")
        caja = imagen.getchannel("A").getbbox()
        if caja:
            imagen = imagen.crop(caja)
        datos = io.BytesIO()
        imagen.save(datos, "PNG", optimize=True)
        s3.put_object(
            Bucket=BUCKET,
            Key=clave(numero, shiny),
            Body=datos.getvalue(),
            ContentType="image/png",
            CacheControl="public, max-age=86400",
        )
        return "subido"
    except Exception as error:  # una especie que falle no debe parar el resto
        return f"error: {error}"


def main() -> None:
    esperar_minio()
    preparar_bucket()
    ya_estan = claves_existentes()
    trabajos = [(n, shiny) for shiny in (False, True) for n in range(1, ULTIMA_ESPECIE + 1)]
    pendientes = [t for t in trabajos if clave(*t) not in ya_estan]
    print(f"en el bucket: {len(ya_estan)} · por subir: {len(pendientes)}")

    with ThreadPoolExecutor(max_workers=16) as hilos:
        resultados = list(zip(pendientes, hilos.map(subir, pendientes)))

    subidos = sum(r == "subido" for _, r in resultados)
    errores = [(clave(*t), r) for t, r in resultados if r.startswith("error")]
    print(f"subidos: {subidos} · ya estaban: {len(trabajos) - len(pendientes)} · errores: {len(errores)}")
    for nombre, motivo in errores[:10]:
        print(f"  {nombre}: {motivo}")
    sys.exit(1 if errores else 0)


if __name__ == "__main__":
    main()

"""Prepara la base de datos (tablas y catálogos) una sola vez, antes de arrancar las webs.

Lo ejecuta un contenedor de un solo uso con la misma imagen que la web.
"""
from main import inicializar_db

if __name__ == "__main__":
    inicializar_db()
    print("Base de datos preparada")

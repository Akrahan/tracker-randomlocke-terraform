FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN useradd --system --no-create-home --uid 10001 --shell /usr/sbin/nologin appuser

COPY subir_sprites.py .

USER appuser

CMD ["python", "subir_sprites.py"]

FROM python:3.10-slim

# Evita que Python genere archivos .pyc y permite ver logs en tiempo real
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# Copiamos primero los requerimientos para aprovechar la caché de Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# COPIAR TODO EL CONTENIDO (Esto incluye tus archivos .py y los .json)
COPY . .

# Exponer el puerto que usa Cloud Run
EXPOSE 8080

# Comando para iniciar la app con Gunicorn
CMD ["gunicorn", "--bind", ":8080", "--workers", "1", "--threads", "8", "--timeout", "0", "cerebro:app"]
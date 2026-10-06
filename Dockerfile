FROM node:22-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY actual-project/frontend/package*.json ./
RUN npm ci
COPY actual-project/frontend/ ./
ENV VITE_API_BASE_URL=/api
RUN npm run build

FROM python:3.13-slim-bookworm AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 RADAR_ENV=production PORT=5000 TRUST_PROXY_HEADERS=1
WORKDIR /app/actual-project/backend
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 libstdc++6 && rm -rf /var/lib/apt/lists/*
COPY actual-project/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY actual-project/backend/ ./
COPY actual-project/ml-model/models/sea_taco_yolo11m_best.onnx /app/actual-project/ml-model/models/sea_taco_yolo11m_best.onnx
COPY --from=frontend /build/frontend/dist /app/actual-project/frontend/dist
RUN python scripts/check_runtime_assets.py
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.getenv('PORT','5000')+'/api/health',timeout=4)"
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:$PORT 'wsgi:create_app()'"]

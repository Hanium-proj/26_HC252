# 배포용. 로컬 개발은 docker-compose.yml 의 Qdrant 만 쓰고 API 는 호스트에서 실행한다.
FROM python:3.11-slim

WORKDIR /app

# 의존성을 먼저 설치해 소스 변경 시 레이어 캐시를 재사용한다
COPY requirements.txt .
RUN pip install --no-cache-dir torch==2.14.1 torchvision==0.29.1 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts

# 인덱스는 이미지에 굽지 않는다. MIMIC 파생 데이터가 이미지에 포함되면
# 이미지 배포 자체가 credentialed 데이터 재배포가 된다.
RUN ln -s /data/model-cache /root/.torchxrayvision
ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["sh", "-c", "mkdir -p /data/model-cache && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY docs/ ./docs/

WORKDIR /app/backend

RUN chmod +x start.sh

EXPOSE 8000

CMD bash start.sh

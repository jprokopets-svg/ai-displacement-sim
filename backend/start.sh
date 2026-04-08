#!/bin/bash
# Decompress the pre-built database if the .db doesn't exist but .gz does
DB_PATH="data/processed/displacement.db"
GZ_PATH="data/processed/displacement.db.gz"

if [ ! -f "$DB_PATH" ] && [ -f "$GZ_PATH" ]; then
    echo "Decompressing database from $GZ_PATH..."
    gunzip -k "$GZ_PATH"
    echo "Database ready: $(ls -lh $DB_PATH | awk '{print $5}')"
elif [ -f "$DB_PATH" ]; then
    echo "Database exists: $(ls -lh $DB_PATH | awk '{print $5}')"
else
    echo "WARNING: No database found. API will return empty results."
fi

# Start the server
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

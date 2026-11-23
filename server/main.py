"""Composition root. Run with: uvicorn main:app --host 127.0.0.1 --port 3001"""

from app.interfaces.http.app import create_app

app = create_app()

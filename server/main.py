"""Composition root. Run with: uvicorn main:app --host 127.0.0.1 --port 3001"""

import logging

from app.interfaces.http.app import create_app

logging.basicConfig(level=logging.INFO)
app = create_app()

"""Environment config. Loads the repo-root .env.local in local dev so the
Python service shares one env file with Next.js; on Railway the variables
come from the process environment instead."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5")
CREDENTIALS_ENCRYPTION_KEY = os.environ.get("CREDENTIALS_ENCRYPTION_KEY", "")
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "PYTHON_API_ALLOWED_ORIGINS", "http://localhost:3000"
    ).split(",")
    if o.strip()
]

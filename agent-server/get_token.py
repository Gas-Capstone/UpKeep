"""
Grab a JWT for your test user so the agent server can act as them during
development. Supabase tokens expire after about an hour — re-run this when
calls start failing with an auth error.

    pip install supabase python-dotenv
    python get_token.py

Paste the printed token into .env as TEST_JWT.
"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]

EMAIL = os.environ["TEST_USER_EMAIL"]
PASSWORD = os.environ["TEST_USER_PASSWORD"]

client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
session = client.auth.sign_in_with_password({"email": EMAIL, "password": PASSWORD})

print("\nUser id:", session.user.id)
print("\nTEST_JWT=" + session.session.access_token)
print("\nCopy that line into your .env file.\n")

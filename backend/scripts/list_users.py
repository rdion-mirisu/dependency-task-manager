#!/usr/bin/env python3
"""List all users in the database. Run from backend folder: python scripts/list_users.py"""
import os
import sys

# Run from backend/ so app and models are importable
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(backend_dir)
sys.path.insert(0, backend_dir)

from app import app
from models import User

with app.app_context():
    users = User.query.all()
    print(f"Total users: {len(users)}")
    for u in users:
        print(f"  id={u.id!r}  username={u.username!r}  email={u.email!r}")

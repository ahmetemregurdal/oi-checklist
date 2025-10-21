#!/usr/bin/env python3
import sys
import json
import re
import requests

def verify_ojuz(cookie: str):
  headers = {
    'Cookie': f'oidc-auth={cookie}',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  }
  try:
    r = requests.get('https://oj.uz', headers=headers, timeout=5)
    if r.status_code != 200:
      sys.stdout.write(json.dumps({"error": "Failed to fetch homepage"}))
      sys.exit(1)
    match = re.search(r'<span><a href="/profile/([^"]+)">([^<]+)</a></span>', r.text)
    if not match:
      sys.stdout.write(json.dumps({"error": "Invalid oj.uz cookie"}))
      sys.exit(1)
    username = match.group(2).strip()
    sys.stdout.write(json.dumps({"username": username}))
    sys.exit(0)
  except Exception as e:
    sys.stdout.write(json.dumps({"error": str(e)}))
    sys.exit(1)

if __name__ == "__main__":
  verify_ojuz(sys.argv[1])
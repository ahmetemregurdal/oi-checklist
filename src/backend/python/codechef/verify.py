#!/usr/bin/env python3

import json
import sys
import cloudscraper
import re

BASE = "https://codechef.com"

def extract_codechef_username(html: str) -> str | None:
  """
  Extract the username from window.codeChefUserData inside a giant HTML page.
  Returns the username string, or None if not logged in.
  """
  m = re.search(
    r"window\.codeChefUserData\s*=\s*(\{.*?\})\s*;",
    html,
    flags=re.S
  )
  if not m:
    return None
  json_text = m.group(1)
  try:
    data = json.loads(json_text)
  except Exception:
    return None
  return data.get("user", {}).get("username")

def main():
  data = json.loads(sys.stdin.read())
  session = data.get("session")
  s = cloudscraper.create_scraper()
  s.cookies.set("SESS93b6022d778ee317bf48f7dbffe03173", session)

  resp = s.get(BASE)
  username = extract_codechef_username(resp.text)
  if username is None:
    sys.stdout.write(json.dumps({"error": "Invalid codechef session"}))
    sys.exit(1)
  sys.stdout.write(json.dumps({"username": username}))
  sys.exit(0)

if __name__ == "__main__":
  main()
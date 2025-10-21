#!/usr/bin/env python3
import sys
import json
import re
import hashlib
import cloudscraper
from bs4 import BeautifulSoup

BASE = "https://qoj.ac"

def make_scraper(session_id: str | None = None):
  s = cloudscraper.create_scraper()
  if session_id:
    s.cookies.set("UOJSESSID", session_id, domain="qoj.ac")
  s.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  })
  return s

def is_logged_in(soup: BeautifulSoup) -> bool:
  if soup.select_one('a.nav-link[href="//qoj.ac/login"]'):
    return False
  if soup.select_one('span.uoj-username'):
    return True
  if soup.select_one('a.nav-link[href^="//qoj.ac/logout"]'):
    return True
  return False

def get_login_token(scraper) -> str:
  r = scraper.get(f"{BASE}/login", timeout=20)
  r.raise_for_status()
  m = re.search(r'_token\s*:\s*"([^"]+)"', r.text)
  if not m:
    raise Exception("CSRF token not found")
  return m.group(1)

def perform_login(scraper, username: str, password: str):
  token = get_login_token(scraper)
  hashed_password = hashlib.md5(password.encode("utf-8")).hexdigest()
  payload = {
    "_token": token,
    "login": "",
    "username": username,
    "password": hashed_password,
  }
  r = scraper.post(f"{BASE}/login", data=payload, timeout=20)
  r.raise_for_status()
  if r.text.strip() != "ok":
    raise Exception("Login failed")

def get_new_session(username: str, password: str) -> str:
  scraper = cloudscraper.create_scraper()
  scraper.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  })
  perform_login(scraper, username, password)
  for cookie in scraper.cookies:
    if cookie.name == "UOJSESSID" and "qoj.ac" in cookie.domain:
      return cookie.value
  raise Exception("UOJSESSID not found after login")

def main():
  try:
    data = json.loads(sys.stdin.read())
    old_session = data.get("oldSession")
    username = data.get("username")
    password = data.get("password")

    scraper = make_scraper(old_session)
    test_url = f"{BASE}/submissions?submitter={username}&page=1"
    r = scraper.get(test_url, timeout=10)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    if is_logged_in(soup):
      sys.stdout.write(json.dumps({"session": old_session}))
      sys.exit(0)

    # refresh session
    new_session = get_new_session(username, password)
    sys.stdout.write(json.dumps({"session": new_session}))
    sys.exit(0)

  except Exception as e:
    sys.stdout.write(json.dumps({"error": str(e)}))
    sys.exit(1)

if __name__ == "__main__":
  main()
#!/usr/bin/env python3
import sys
import json
import re
import cloudscraper
from bs4 import BeautifulSoup

BASE = "https://qoj.ac"

def make_scraper(session_id: str):
  s = cloudscraper.create_scraper()
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

def extract_username(soup: BeautifulSoup, html: str) -> str | None:
  badge = soup.select_one('span.uoj-username')
  if badge:
    name = (badge.get('data-nickname') or badge.get_text(strip=True) or '').strip()
    if name:
      return name
  m = re.search(r'href="//qoj\.ac/user/profile/([^"]+)"', html)
  if m:
    return m.group(1).strip()
  return None

def main():
  try:
    data = json.loads(sys.stdin.read())
    session = data.get("session")
    if not session:
      sys.stdout.write(json.dumps({"error": "Missing session"}))
      sys.exit(1)

    scraper = make_scraper(session)
    resp = scraper.get(BASE, timeout=10)
    if resp.status_code != 200:
      sys.stdout.write(json.dumps({"error": f"HTTP {resp.status_code}"}))
      sys.exit(1)

    soup = BeautifulSoup(resp.text, "html.parser")
    if not is_logged_in(soup):
      sys.stdout.write(json.dumps({"error": "Invalid session"}))
      sys.exit(1)

    username = extract_username(soup, resp.text)
    if not username:
      sys.stdout.write(json.dumps({"error": "Could not extract username"}))
      sys.exit(1)

    sys.stdout.write(json.dumps({"username": username}))
    sys.exit(0)

  except Exception as e:
    sys.stdout.write(json.dumps({"error": str(e)}))
    sys.exit(1)

if __name__ == "__main__":
  main()
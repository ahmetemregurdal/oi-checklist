#!/usr/bin/env python3
import sys
import json
import re
import requests
import time
import random
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup

def main():
  data = json.loads(sys.stdin.read())
  cookie = data['cookie']
  username = data['username']
  problems = data['problems']

  try:
    profile_url = f"https://oj.uz/profile/{username}"
    prof_res = requests.get(profile_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}, timeout=10)
    if prof_res.status_code == 200:
      prof_soup = BeautifulSoup(prof_res.text, 'html.parser')
      profile_links = set()
      for a in prof_soup.find_all('a', href=True):
        href = a['href']
        if href.startswith('/problem/view/'):
          profile_links.add('https://oj.uz' + href)
      if profile_links:
        filtered = []
        for p in problems:
          oj_link = None
          for link_entry in p.get('problemLinks', []):
            if link_entry.get('platform') == 'oj.uz':
              oj_link = link_entry.get('url')
              break
          if oj_link in profile_links:
            np = dict(p)
            np['link'] = oj_link
            filtered.append(np)
        problems = filtered
    else:
      sys.stdout.write(json.dumps({"error": "Failed to fetch profile page"}))
      sys.exit(1)
  except Exception as e:
    sys.stdout.write(json.dumps({"error": str(e)}))
    sys.exit(1)

  headers = {
    'Cookie': f'oidc-auth={cookie}',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  }

  def fetch_score(problem):
    try:
      time.sleep(random.uniform(0.2, 0.5))
      res = requests.get(problem['link'], headers=headers, timeout=5, allow_redirects=True)
      print(res, file=sys.stderr)
      match = re.search(r"circleProgress\(\s*{\s*value:\s*([0-9.]+)", res.text)
      if match:
        score = round(float(match.group(1)) * 100)
        return (problem, score)
    except Exception as e:
      sys.stdout.write(json.dumps({"error": str(e)}))
      sys.exit(1)
    return None

  results = []
  with ThreadPoolExecutor(max_workers=8) as executor:
    for result in executor.map(fetch_score, problems):
      if result is not None:
        results.append(result)

  if not results:
    sys.stdout.write(json.dumps({'error': 'Invalid or expired cookie'}))
    sys.exit(1)

  scores_out = []
  for problem, new_score in results:
    scores_out.append({'problemId': problem.get('id'), 'score': new_score})

  sys.stdout.write(json.dumps({'scores': scores_out}))
  sys.exit(0)

if __name__ == '__main__':
  main()
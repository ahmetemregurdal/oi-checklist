#!/usr/bin/env python3
import sys
import json
import re
import time
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor
import cloudscraper
from bs4 import BeautifulSoup

BASE = "https://qoj.ac"

def iso_to_dt(iso_str: str) -> datetime:
  return datetime.fromisoformat(str(iso_str).replace('Z', '+00:00')).astimezone(timezone.utc)

def dt_to_iso_utc(dt: datetime) -> str:
  return dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')

def make_scraper(session_cookie: str):
  s = cloudscraper.create_scraper()
  s.cookies.set(name='UOJSESSID', value=session_cookie, domain='qoj.ac', path='/')
  s.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  })
  return s

def extract_problem_id_from_url(url: str) -> int | None:
  m = re.search(r'/problem/(\d+)', url or "")
  return int(m.group(1)) if m else None

def parse_server_time_offset(soup: BeautifulSoup) -> timedelta:
  p_tag = soup.find("p", string=re.compile(r"Server Time:\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}"))
  if not p_tag:
    return timedelta(0)
  m = re.search(r"Server Time:\s*([0-9:\-\s]{19})", p_tag.get_text(" ", strip=True))
  if not m:
    return timedelta(0)
  server_naive = datetime.strptime(m.group(1), "%Y-%m-%d %H:%M:%S")
  now_utc = datetime.utcnow()
  return server_naive - now_utc

def parse_submissions_rows_for_page(html: str, server_offset: timedelta):
  soup = BeautifulSoup(html, "html.parser")
  rows = soup.select("table tbody tr")
  results = []
  for row in rows:
    try:
      a_sub = row.select_one("td a[href^='/submission/']")
      if not a_sub:
        continue
      sub_id = a_sub["href"].rsplit("/", 1)[-1]

      a_prob = row.select_one("td a[href*='/problem/']")
      if not a_prob:
        continue
      prob_href = a_prob["href"]
      pid = extract_problem_id_from_url(prob_href)
      if pid is None:
        continue

      smalls = row.find_all("small")
      if not smalls:
        continue
      tstr = smalls[0].get_text(strip=True)
      local_naive = datetime.strptime(tstr, "%Y-%m-%d %H:%M:%S")
      dt_utc = (local_naive - server_offset).replace(tzinfo=timezone.utc)

      results.append({
        "submission_id": sub_id,
        "problem_id": pid,
        "submission_time_iso": dt_to_iso_utc(dt_utc),
      })
    except Exception as _:
      continue
  return results

def discover_max_page(scraper, username: str) -> int:
  url = f"{BASE}/submissions?submitter={username}&page=10000000"
  r = scraper.get(url, timeout=20)
  if r.status_code != 200:
    return 1
  soup = BeautifulSoup(r.text, "html.parser")
  active = soup.select_one("li.page-item.active a.page-link")
  if active:
    try:
      return int(active.get_text(strip=True))
    except ValueError:
      pass
  max_page = 1
  for a in soup.select("li.page-item a.page-link"):
    try:
      n = int(a.get_text(strip=True))
      if n > max_page:
        max_page = n
    except ValueError:
      continue
  return max_page

def fetch_submission_details(scraper, sub_id: str):
  try:
    url = f"{BASE}/submission/{sub_id}"
    r = scraper.get(url, timeout=20)
    if r.status_code != 200:
      sys.stdout.write(json.dumps({'error': f'Failed to fetch submission {sub_id}: {r.status_code}'}))
      sys.exit(1)
    soup = BeautifulSoup(r.text, "html.parser")

    # Recover problem id from any /problem/<id> link
    pid = None
    a_prob = soup.select_one("a[href*='/problem/']")
    if a_prob:
      pid = extract_problem_id_from_url(a_prob["href"])

    # Extract subtask scores
    subtask_scores = []
    total_score = 0.0

    for hdr in soup.select("div.card-header"):
      title_el = hdr.select_one("h3.card-title")
      if not title_el:
        continue
      title_txt = title_el.get_text(" ", strip=True)
      if not re.search(r'^\s*Subtask\b', title_txt, flags=re.I):
        continue

      header_text = hdr.get_text(" ", strip=True)
      m = re.search(r'(?i)score:\s*([0-9]+(?:\.[0-9]+)?)', header_text)
      if m:
        val = float(m.group(1))
        subtask_scores.append(int(val) if val.is_integer() else round(val, 2))
      else:
        subtask_scores.append(0)

    if subtask_scores:
      total_val = sum(float(x) for x in subtask_scores)
      total_score = int(total_val) if float(total_val).is_integer() else round(total_val, 2)
    else:
      score_badge = soup.select_one("a.uoj-score[data-score]")
      if score_badge and score_badge.get("data-score"):
        try:
          sc = float(score_badge["data-score"])
          total_score = int(sc) if sc.is_integer() else round(sc, 2)
          subtask_scores = [total_score]
        except Exception:
          pass

    return {
      'problem_id': pid,
      'total_score': total_score,
      'subtask_scores': subtask_scores
    }
  except Exception as e:
    sys.stdout.write(json.dumps({'error': f'Error fetching submission {sub_id}: {e}'}))
    sys.exit(1)

def main():
  try:
    data = json.loads(sys.stdin.read())
    session = data['session']
    username = data['username']
    contest = data['contest']

    started_at = contest['startedAt']
    ended_at = contest['endedAt']

    start_dt = iso_to_dt(started_at)
    if ended_at is None:
      end_dt = datetime.now(timezone.utc)
    else:
      end_dt = iso_to_dt(ended_at)

    problems = contest['contest']['problems']

    # map qoj problem id -> contest_problem_id
    problem_id_map = {}
    for cprob in problems:
      cprob_id = cprob['id']
      prob = cprob['problem']
      for pl in prob.get('problemLinks', []):
        if pl.get('platform') == 'qoj.ac':
          pid = extract_problem_id_from_url(pl.get('url'))
          if pid is not None:
            problem_id_map[pid] = {'contest_problem_id': cprob_id}

    scraper = make_scraper(session)

    max_page = discover_max_page(scraper, username)

    relevant = []
    stop_pagination = False
    for page in range(1, max_page + 1):
      if stop_pagination:
        break
      url = f"{BASE}/submissions?submitter={username}&page={page}"
      r = scraper.get(url, timeout=20)
      if r.status_code != 200:
        sys.stdout.write(json.dumps({'error': f'Failed to fetch submissions page: {r.status_code}'}))
        sys.exit(1)

      soup = BeautifulSoup(r.text, "html.parser")
      server_offset = parse_server_time_offset(soup)
      items = parse_submissions_rows_for_page(r.text, server_offset)

      if not items:
        continue

      for it in items:
        try:
          sub_dt = iso_to_dt(it['submission_time_iso'])
          if sub_dt < start_dt:
            stop_pagination = True
            break
          if sub_dt > end_dt:
            continue
          pid = it['problem_id']
          if pid in problem_id_map:
            relevant.append({
              'submission_id': it['submission_id'],
              'submission_time': it['submission_time_iso'],
              'contest_problem_id': problem_id_map[pid]['contest_problem_id']
            })
        except Exception as e:
          sys.stdout.write(json.dumps({'error': f'Error processing submission row: {e}'}))
          sys.exit(1)

      time.sleep(0.5)

    def worker(s):
      det = fetch_submission_details(scraper, s['submission_id'])
      return {
        'virtualContestId': contest['userId'],
        'contestProblemId': s['contest_problem_id'],
        'time': s['submission_time'],
        'score': det['total_score'],
        'subtaskScores': det['subtask_scores']
      }

    submissions_out = []
    if relevant:
      with ThreadPoolExecutor(max_workers=5) as ex:
        for item in ex.map(worker, relevant):
          if item is not None:
            submissions_out.append(item)

    submissions_out.sort(key=lambda x: x['time'])
    sys.stdout.write(json.dumps({'submissions': submissions_out}))
    sys.exit(0)

  except Exception as e:
    sys.stdout.write(json.dumps({'error': str(e)}))
    sys.exit(1)

if __name__ == '__main__':
  main()
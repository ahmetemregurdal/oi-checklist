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

def _iso_to_dt(iso_str: str) -> datetime:
  return datetime.fromisoformat(iso_str.replace('Z', '+00:00')).astimezone(timezone.utc)

def _dt_to_iso_utc(dt: datetime) -> str:
  return dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')

def _extract_problem_id_from_url(url: str) -> int | None:
  m = re.search(r'/problem/(\d+)', url)
  return int(m.group(1)) if m else None

def _parse_server_time_offset(soup: BeautifulSoup) -> timedelta:
  p_tag = soup.find("p", string=re.compile(r"Server Time:\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}"))
  if not p_tag:
    return timedelta(0)
  m = re.search(r"Server Time:\s*([0-9:\-\s]{19})", p_tag.get_text(" ", strip=True))
  if not m:
    return timedelta(0)
  server_naive = datetime.strptime(m.group(1), "%Y-%m-%d %H:%M:%S")
  now_utc = datetime.utcnow()
  return server_naive - now_utc

def _parse_submissions_rows_for_page(html: str, server_offset: timedelta):
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
      pid = _extract_problem_id_from_url(prob_href)
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
        "submission_time_iso": _dt_to_iso_utc(dt_utc),
      })
    except Exception:
      continue
  return results, soup

def _fetch_submission_details(scraper, sub_id: str):
  url = f"{BASE}/submission/{sub_id}"
  r = scraper.get(url, timeout=20)
  if r.status_code != 200:
    return None
  soup = BeautifulSoup(r.text, "html.parser")

  pid = None
  a_prob = soup.select_one("a[href*='/problem/']")
  if a_prob:
    pid = _extract_problem_id_from_url(a_prob["href"])

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
    "submission_id": sub_id,
    "problem_id": pid,
    "subtask_scores": subtask_scores,
    "total_score": total_score,
  }

def _discover_max_page(scraper, username: str) -> int:
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

def main():
  try:
    data = json.loads(sys.stdin.read())
    cookie = data.get("cookie")
    username = data.get("username")
    problems = data.get("problems", [])

    # map qoj problem IDs from provided problems
    problem_map = {}
    for p in problems:
      link = None
      for entry in p.get("problemLinks", []):
        if entry.get("platform") == "qoj.ac":
          link = entry.get("url")
          break
      pid = _extract_problem_id_from_url(link or "")
      if pid is not None:
        problem_map[pid] = {"id": p.get("id"), "link": link}

    if not problem_map:
      sys.stdout.write(json.dumps({"scores": []}))
      sys.exit(0)

    scraper = cloudscraper.create_scraper()
    scraper.cookies.set(name="UOJSESSID", value=cookie, domain="qoj.ac", path="/")
    scraper.headers.update({"User-Agent": "Mozilla/5.0"})

    max_page = _discover_max_page(scraper, username)

    detailed_submissions = []
    for page in range(1, max_page + 1):
      url = f"{BASE}/submissions?submitter={username}&page={page}"
      r = scraper.get(url, timeout=20)
      if r.status_code != 200:
        break

      soup = BeautifulSoup(r.text, "html.parser")
      server_offset = _parse_server_time_offset(soup)

      items, _ = _parse_submissions_rows_for_page(r.text, server_offset)
      if not items:
        continue

      relevant = [it for it in items if it.get('problem_id') in problem_map]

      if relevant:
        def _worker(sub_info):
          try:
            det = _fetch_submission_details(scraper, sub_info['submission_id'])
            if not det:
              return None
            pid = det['problem_id'] if det['problem_id'] is not None else sub_info['problem_id']
            return {
              'submission_id': sub_info['submission_id'],
              'submission_time': sub_info['submission_time_iso'],
              'problem_id': pid,
              'total_score': det.get('total_score', 0),
              'subtask_scores': det.get('subtask_scores') or [],
            }
          except Exception:
            return None

        with ThreadPoolExecutor(max_workers=6) as ex:
          for res in ex.map(_worker, relevant):
            if res:
              detailed_submissions.append(res)
            time.sleep(0.05)

      time.sleep(0.2)

    # aggregate exactly like the original
    problem_best = {}
    for sub in detailed_submissions:
      pid = sub['problem_id']
      if pid not in problem_map:
        continue
      if pid not in problem_best:
        problem_best[pid] = {
          'total_score': float(sum(sub['subtask_scores'])) if isinstance(sub['subtask_scores'], list) else float(sub['total_score'] or 0),
          'subtask_scores': [float(x) for x in (sub['subtask_scores'] or [])],
          'earliest_improvement_time': sub['submission_time'],
        }
      else:
        cur = problem_best[pid]
        a = cur['subtask_scores']
        b = [float(x) for x in (sub['subtask_scores'] or [])]
        max_len = max(len(a), len(b))
        merged = []
        improved_any = False
        for i in range(max_len):
          va = a[i] if i < len(a) else 0.0
          vb = b[i] if i < len(b) else 0.0
          if vb > va:
            improved_any = True
          merged.append(vb if vb > va else va)
        new_total = float(sum(merged))
        if new_total > cur['total_score']:
          t_old = _iso_to_dt(cur['earliest_improvement_time'])
          t_new = _iso_to_dt(sub['submission_time'])
          earliest = _dt_to_iso_utc(min(t_old, t_new))
          problem_best[pid] = {
            'total_score': new_total,
            'subtask_scores': merged,
            'earliest_improvement_time': earliest,
          }
        else:
          if improved_any:
            t_old = _iso_to_dt(cur['earliest_improvement_time'])
            t_new = _iso_to_dt(sub['submission_time'])
            if t_new < t_old:
              cur['earliest_improvement_time'] = _dt_to_iso_utc(t_new)
            cur['subtask_scores'] = merged

    results = []
    for pid, best in problem_best.items():
      prob = problem_map[pid]
      results.append({"problemId": prob["id"], "score": round(best['total_score'], 2)})

    sys.stdout.write(json.dumps({"scores": results}))
    sys.exit(0)

  except Exception as e:
    sys.stdout.write(json.dumps({"error": str(e)}))
    sys.exit(1)

if __name__ == "__main__":
  main()
#!/usr/bin/env python3
import sys
import json
import re
import time
from datetime import datetime, timezone
import requests
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor

def main():
  try:
    data = json.loads(sys.stdin.read())
    username = data['username']
    contest = data['contest']

    started_at = contest['startedAt']
    ended_at = contest['endedAt']

    start_dt = datetime.fromisoformat(str(started_at).replace('Z', '+00:00'))
    if ended_at is None:
      end_dt = datetime.now(timezone.utc)
    else:
      end_dt = datetime.fromisoformat(str(ended_at).replace('Z', '+00:00'))

    problems = contest['contest']['problems']

    problem_link_map = {}
    for cprob in problems:
      cprob_id = cprob['id']
      prob = cprob['problem']
      for pl in prob.get('problemLinks', []):
        if pl.get('platform') == 'oj.uz':
          problem_link_map[pl['url']] = {
            'contest_problem_id': cprob_id
          }

    headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }

    relevant_submissions = []
    submissions_url = f"https://oj.uz/submissions?handle={username}"

    while submissions_url:
      resp = requests.get(submissions_url, headers=headers, timeout=10)
      if resp.status_code != 200:
        sys.stdout.write(json.dumps({'error': f'Failed to fetch submissions page: {resp.status_code}'}))
        sys.exit(1)

      soup = BeautifulSoup(resp.text, 'html.parser')
      rows = soup.select('table.table tbody tr')
      if not rows:
        break

      last_submission_id = None

      for row in rows:
        try:
          tspan = row.find('span', {'data-timestamp-iso': True})
          if not tspan:
            continue
          ts_str = tspan['data-timestamp-iso']
          ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))

          if ts < start_dt:
            submissions_url = None
            break
          if ts > end_dt:
            continue

          sub_a = row.find('a', href=re.compile(r'/submission/\d+'))
          if not sub_a:
            continue
          submission_id = sub_a['href'].split('/')[-1]
          last_submission_id = submission_id

          prob_a = row.find('a', href=re.compile(r'/problem/view/'))
          if not prob_a:
            continue
          prob_url = 'https://oj.uz' + prob_a['href']

          if prob_url in problem_link_map:
            relevant_submissions.append({
              'submission_id': submission_id,
              'submission_time': ts_str,
              'contest_problem_id': problem_link_map[prob_url]['contest_problem_id']
            })
        except Exception as e:
          sys.stdout.write(json.dumps({'error': f'Error processing submission row: {e}'}))
          sys.exit(1)

      if submissions_url and last_submission_id:
        submissions_url = f"https://oj.uz/submissions?handle={username}&direction=down&id={last_submission_id}"
        time.sleep(0.5)
      else:
        submissions_url = None

    def fetch_details(s):
      try:
        url = f"https://oj.uz/submission/{s['submission_id']}"
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code != 200:
          sys.stdout.write(json.dumps({'error': f'Failed to fetch submission {s["submission_id"]}: {r.status_code}'}))
          sys.exit(1)
        soup = BeautifulSoup(r.text, 'html.parser')
        divs = soup.find_all('div', id=re.compile(r'subtask_results_div_\d+'))

        subscores = []
        total = 0.0
        for d in divs:
          span = d.find('span', class_=re.compile(r'subtask-score'))
          if not span:
            subscores.append(0)
            continue
          txt = span.get_text().strip()
          m = re.search(r'([0-9]+(?:\.[0-9]+)?)\s*/\s*([0-9]+(?:\.[0-9]+)?)', txt)
          if not m:
            subscores.append(0)
            continue
          earned = float(m.group(1))
          earned_rounded = round(earned, 2)
          if earned_rounded == int(earned_rounded):
            earned_rounded = int(earned_rounded)
          total += float(earned_rounded)
          subscores.append(earned_rounded)

        return {
          'virtualContestId': contest['userId'],
          'contestProblemId': s['contest_problem_id'],
          'time': s['submission_time'],
          'score': total,
          'subtaskScores': subscores
        }
      except Exception as e:
        sys.stdout.write(json.dumps({'error': f'Error fetching submission {s["submission_id"]}: {e}'}))
        sys.exit(1)

    submissions_out = []
    if relevant_submissions:
      with ThreadPoolExecutor(max_workers=5) as ex:
        for item in ex.map(fetch_details, relevant_submissions):
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
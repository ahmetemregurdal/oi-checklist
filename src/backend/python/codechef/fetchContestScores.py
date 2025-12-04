#!/usr/bin/env python3
import sys
import json
import re
import time
from datetime import datetime, timezone

import cloudscraper
from bs4 import BeautifulSoup

BASE = "https://www.codechef.com"


############################################################
#   TIME HELPERS
############################################################

def iso_to_epoch_ms(iso_str: str) -> int:
    """
    Convert ISO8601 like '2025-11-30T03:30:00Z' to milliseconds since epoch (UTC).
    """
    dt = datetime.fromisoformat(str(iso_str).replace('Z', '+00:00')).astimezone(timezone.utc)
    return int(dt.timestamp() * 1000)


def epoch_ms_to_iso(ms: int) -> str:
    """
    Convert milliseconds since epoch to ISO8601 UTC string with 'Z'.
    """
    dt = datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc)
    return dt.isoformat().replace('+00:00', 'Z')


############################################################
#   HTTP + RATE-LIMIT HELPERS
############################################################

def fetch_json_with_retry(scraper, url, params=None, max_attempts=7):
    """
    Fetch JSON from CodeChef with retry & exponential backoff.
    Works for BOTH: /recent/user and /api/submission-details/<id>.
    """
    backoff = 2.0
    for _ in range(max_attempts):
        r = scraper.get(url, params=params, timeout=20)

        if r.status_code == 200:
            try:
                return r.json()
            except Exception:
                return None

        if r.status_code == 429:
            time.sleep(backoff)
            backoff *= 1.5
            continue

        # Non-rate-limit HTTP error -> treat as fatal for this call
        return None

    return None


############################################################
#   PARSERS
############################################################

def _extract_problem_code_from_url(url: str) -> str | None:
    if not url:
        return None
    m = re.search(r"/problems/([A-Za-z0-9_]+)", url)
    return m.group(1) if m else None


def extract_subtask_scores(testinfo_html: str):
    """
    Given the HTML from data.data.other_details.testInfo,
    return a list of subtask scores (floats), e.g. [32.0, 68.0].
    """
    if not testinfo_html:
        return []
    text = re.sub(r"<[^>]+>", "", testinfo_html)
    pattern = re.compile(r"Subtask\s*Score\s*:\s*([0-9]+(?:\.[0-9]+)?)%", re.I)
    return [float(m.group(1)) for m in pattern.finditer(text)]


def parse_recent_submissions(content_html: str):
    """
    Parse the HTML snippet returned under 'content' from
    https://www.codechef.com/recent/user to extract submission ids
    and problem codes.
    """
    soup = BeautifulSoup(content_html, "html.parser")
    rows = soup.select("table.dataTable tbody tr")
    results = []

    for row in rows:
        try:
            a_prob = row.select_one("td a[href*='/problems/']")
            if not a_prob:
                continue

            href = a_prob.get("href", "")
            code = _extract_problem_code_from_url(href) or a_prob.get_text(strip=True)
            if not code:
                continue

            a_sol = row.select_one("td a[href^='/viewsolution/']")
            if not a_sol:
                continue

            m = re.search(r"/viewsolution/(\d+)", a_sol.get("href", ""))
            if not m:
                continue

            sub_id = m.group(1)

            results.append({
                "submission_id": sub_id,
                "problem_code": code,
            })
        except Exception:
            continue

    return results


############################################################
#   SUBMISSION DETAILS
############################################################

def fetch_submission_details(scraper, sub_id: str):
    """
    Call https://www.codechef.com/api/submission-details/<id>
    and return:
      - problem_code (string)
      - submission_date_ms (int)
      - total_score (float)
      - subtask_scores (list[float])
    """
    url = f"{BASE}/api/submission-details/{sub_id}"
    payload = fetch_json_with_retry(scraper, url)

    if not payload:
        return None

    try:
        od = payload["data"]["other_details"]
    except Exception:
        return None

    problem_code = od.get("problemCode")
    submission_date_ms = od.get("submissionDate")

    # Extract subtask scores from testInfo HTML (if present)
    testinfo_html = od.get("testInfo", "") or ""
    subtask_scores = extract_subtask_scores(testinfo_html)

    if not subtask_scores:
        # No subtasks found → usually non-scoring / WA. Ignore.
        return None

    total_score = float(sum(subtask_scores))
    return {
        "problem_code": problem_code,
        "submission_date_ms": submission_date_ms,
        "total_score": total_score,
        "subtask_scores": subtask_scores,
    }


############################################################
#   MAIN
############################################################

def main():
    try:
        data = json.loads(sys.stdin.read() or "{}")

        cookie = data.get("cookie")
        username = data.get("username")
        contest = data.get("contest") or {}

        if not username or not contest:
            sys.stdout.write(json.dumps({"submissions": []}))
            sys.exit(0)

        started_at = contest.get("startedAt")
        ended_at = contest.get("endedAt")
        contest_inner = (contest.get("contest") or {})
        contest_problems = contest_inner.get("problems") or []
        virtual_contest_id = contest.get("userId")

        if not started_at:
            sys.stdout.write(json.dumps({"submissions": []}))
            sys.exit(0)

        start_ms = iso_to_epoch_ms(started_at)
        if ended_at is None:
            end_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        else:
            end_ms = iso_to_epoch_ms(ended_at)

        # Map CodeChef problem code → contest_problem_id
        problem_code_map = {}
        for cprob in contest_problems:
            cprob_id = cprob.get("id")
            prob = cprob.get("problem") or {}
            for pl in prob.get("problemLinks", []):
                if pl.get("platform") == "codechef":
                    url = pl.get("url") or ""
                    code = _extract_problem_code_from_url(url)
                    if code:
                        problem_code_map[code] = {"contest_problem_id": cprob_id}

        if not problem_code_map:
            sys.stdout.write(json.dumps({"submissions": []}))
            sys.exit(0)

        # Scraper with session + browser-like headers
        scraper = cloudscraper.create_scraper()

        if cookie:
            scraper.cookies.set("SESS93b6022d778ee317bf48f7dbffe03173", cookie)

        scraper.headers.update({
            "accept": "application/json, text/javascript, */*; q=0.01",
            "accept-language": "en-US,en;q=0.9",
            "cache-control": "no-cache",
            "dnt": "1",
            "pragma": "no-cache",
            "priority": "u=1, i",
            "sec-ch-ua": '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            "sec-ch-ua-arch": '"arm"',
            "sec-ch-ua-bitness": '"64"',
            "sec-ch-ua-full-version": '"142.0.7444.176"',
            "sec-ch-ua-full-version-list": '"Chromium";v="142.0.7444.176", "Google Chrome";v="142.0.7444.176", "Not_A Brand";v="99.0.0.0"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-model": '""',
            "sec-ch-ua-platform": '"macOS"',
            "sec-ch-ua-platform-version": '"15.3.1"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
            "x-requested-with": "XMLHttpRequest"
        })

        # Step 1: Discover all relevant submissions (by problem code) via /recent/user
        relevant_subs = []

        # First page: page=undefined
        params = {"page": "undefined", "user_handle": username}
        payload = fetch_json_with_retry(scraper, f"{BASE}/recent/user", params=params)
        if not payload:
            sys.stdout.write(json.dumps({"submissions": []}))
            sys.exit(0)

        try:
            max_page = int(payload.get("max_page", 1))
        except Exception:
            max_page = 1

        content = payload.get("content", "") or ""
        items = parse_recent_submissions(content)
        for it in items:
            if it["problem_code"] in problem_code_map:
                relevant_subs.append(it)

        # Subsequent pages: 1 .. max_page-1
        for page in range(1, max_page):
            params = {"page": str(page), "user_handle": username}
            payload = fetch_json_with_retry(scraper, f"{BASE}/recent/user", params=params)
            if not payload:
                continue

            content = payload.get("content", "") or ""
            items = parse_recent_submissions(content)
            for it in items:
                if it["problem_code"] in problem_code_map:
                    relevant_subs.append(it)

            time.sleep(0.5)

        # Step 2: For each relevant submission, fetch details and stop
        # when we hit a submission older than contest start (descending order).
        submissions_out = []

        for sub_info in relevant_subs:
            sub_id = sub_info["submission_id"]
            details = fetch_submission_details(scraper, sub_id)
            if not details:
                time.sleep(2.0)
                continue

            problem_code = details["problem_code"]
            submission_date_ms = details["submission_date_ms"]
            total_score = details["total_score"]
            subtask_scores = details["subtask_scores"]

            if not isinstance(submission_date_ms, int):
                time.sleep(2.0)
                continue

            # Too new (after contest end) → ignore but keep going
            if submission_date_ms > end_ms:
                time.sleep(2.0)
                continue

            # Too old (before contest start) → since sorted, we can stop here
            if submission_date_ms < start_ms:
                time.sleep(2.0)
                break

            mapping = problem_code_map.get(problem_code)
            if not mapping:
                time.sleep(2.0)
                continue

            contest_problem_id = mapping["contest_problem_id"]
            iso_time = epoch_ms_to_iso(submission_date_ms)

            submissions_out.append({
                "virtualContestId": virtual_contest_id,
                "contestProblemId": contest_problem_id,
                "time": iso_time,
                "score": total_score,
                "subtaskScores": subtask_scores,
            })

            time.sleep(2.0)

        submissions_out.sort(key=lambda x: x["time"])
        sys.stdout.write(json.dumps({"submissions": submissions_out}))
        sys.exit(0)

    except Exception as e:
        sys.stdout.write(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
import sys
import json
import re
import time
import cloudscraper
from bs4 import BeautifulSoup

BASE = "https://www.codechef.com"

def fetch_json_with_retry(scraper, url, params=None, max_attempts=7):
    """
    Fetch JSON from CodeChef with retry & exponential backoff.
    Works for BOTH: /recent/user and /submission-details/<id>.
    """
    backoff = 2.0
    for _ in range(max_attempts):
        r = scraper.get(url, params=params, timeout=20)

        if r.status_code == 200:
            try:
                return r.json()
            except:
                return None

        if r.status_code == 429:
            time.sleep(backoff)
            backoff *= 1.5
            continue

        return None

    return None

def _extract_problem_code_from_url(url: str) -> str | None:
    if not url:
        return None
    m = re.search(r"/problems/([A-Za-z0-9_]+)", url)
    return m.group(1) if m else None


def extract_subtask_scores(testinfo_html: str):
    if not testinfo_html:
        return []
    text = re.sub(r"<[^>]+>", "", testinfo_html)
    pattern = re.compile(r"Subtask\s*Score\s*:\s*([0-9]+(?:\.[0-9]+)?)%", re.I)
    return [float(m.group(1)) for m in pattern.finditer(text)]


def _parse_recent_submissions(content_html: str):
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
        except:
            continue

    return results

def _fetch_submission_subtasks(scraper, sub_id: str):
    url = f"{BASE}/api/submission-details/{sub_id}"
    payload = fetch_json_with_retry(scraper, url)
    if not payload:
        return None

    try:
        testinfo_html = payload["data"]["other_details"]["testInfo"]
    except:
        testinfo_html = ""

    scores = extract_subtask_scores(testinfo_html)
    return scores or None

def main():
    try:
        data = json.loads(sys.stdin.read() or "{}")
        username = data.get("username")
        problems = data.get("problems", [])
        cookie = data.get("cookie")

        if not username:
            sys.stdout.write(json.dumps({"scores": []}))
            sys.exit(0)

        problem_map = {}
        for p in problems:
            link = None
            for entry in p.get("problemLinks", []):
                if entry.get("platform") == "codechef":
                    link = entry.get("url")
                    break

            code = _extract_problem_code_from_url(link or "")
            if code:
                problem_map[code] = {"id": p.get("id"), "link": link}

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
                "referer": f"https://www.codechef.com/users/{username}",
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

        detailed_submissions = []

        params = {"page": "undefined", "user_handle": username}
        payload = fetch_json_with_retry(scraper, f"{BASE}/recent/user", params=params)

        if not payload:
            sys.stdout.write(json.dumps({"scores": []}))
            sys.exit(0)

        max_page = int(payload.get("max_page", 1))
        items = _parse_recent_submissions(payload.get("content", ""))

        relevant = [it for it in items if it["problem_code"] in problem_map]

        for sub_info in relevant:
            scores = _fetch_submission_subtasks(scraper, sub_info["submission_id"])
            if scores is not None:
                detailed_submissions.append({
                    "problem_code": sub_info["problem_code"],
                    "subtask_scores": scores,
                })
            time.sleep(2.0)

        for page in range(1, max_page):
            params = {"page": str(page), "user_handle": username}
            payload = fetch_json_with_retry(scraper, f"{BASE}/recent/user", params=params)

            if not payload:
                continue

            items = _parse_recent_submissions(payload.get("content", ""))
            relevant = [it for it in items if it["problem_code"] in problem_map]

            for sub_info in relevant:
                scores = _fetch_submission_subtasks(scraper, sub_info["submission_id"])
                if scores is not None:
                    detailed_submissions.append({
                        "problem_code": sub_info["problem_code"],
                        "subtask_scores": scores,
                    })
                time.sleep(2.0)

        problem_best = {}

        for sub in detailed_submissions:
            code = sub["problem_code"]
            if code not in problem_map:
                continue

            b = sub["subtask_scores"]
            if not b:
                continue

            if code not in problem_best:
                problem_best[code] = {
                    "total_score": sum(b),
                    "subtask_scores": b,
                }
            else:
                a = problem_best[code]["subtask_scores"]
                merged = [
                    max(a[i] if i < len(a) else 0.0,
                        b[i] if i < len(b) else 0.0)
                    for i in range(max(len(a), len(b)))
                ]
                problem_best[code]["total_score"] = sum(merged)
                problem_best[code]["subtask_scores"] = merged

        results = [
            {"problemId": problem_map[code]["id"], "score": round(best["total_score"], 2)}
            for code, best in problem_best.items()
        ]

        sys.stdout.write(json.dumps({"scores": results}))
        sys.exit(0)

    except Exception as e:
        sys.stdout.write(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()

import argparse
import json
import re
import yaml
from pathlib import Path
from urllib.parse import urlparse

DEFAULT_HOSTNAME_MAP = {
    "acmicpc.net": "baekjoon",
    "atcoder.jp": "atcoder",
    "cms.iarcs.org.in": "cms",
    "codebreaker.xyz": "codebreaker",
    "codechef.com": "codechef",
    "codedrills.io": "codedrills",
    "codeforces.com": "codeforces",
    "dmoj.ca": "dmoj",
    "icpc.codedrills.io": "codedrills",
    "oj.uz": "oj.uz",
    "qoj.ac": "qoj.ac",
    "szkopul.edu.pl": "szkopuł",
    "usaco.org": "usaco",
}

def _hostname(url: str) -> str | None:
    if not url:
        return None
    # ensure scheme so urlparse works
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.\-]*://", url):
        url = "http://" + url
    try:
        h = (urlparse(url).hostname or "").lower()
        return h[4:] if h.startswith("www.") else h
    except Exception:
        return None

def _infer_platform(url: str) -> str:
    h = _hostname(url)
    if not h:
        return "unknown"
    return DEFAULT_HOSTNAME_MAP.get(h, h)  # fallback to hostname itself

def _normalize_links(entry: dict) -> list[dict]:
    """
    Accepts any of:
      - entry["link"] = str
      - entry["links"] = [ "https://...", ... ]
      - entry["links"] = [ {platform,url}, ... ]  (will respect given platform)
      - entry["links"] = { platform: url, ... }   (rare, but supported)
    Returns: list of {platform,url}, de-duplicated.
    """
    out: list[dict] = []

    if "links" in entry and entry["links"] is not None:
        links = entry["links"]
        if isinstance(links, list):
            for item in links:
                if isinstance(item, str):
                    url = item
                    out.append({"platform": _infer_platform(url), "url": url})
                elif isinstance(item, dict):
                    url = item.get("url")
                    plat = item.get("platform") or _infer_platform(url or "")
                    out.append({"platform": str(plat), "url": str(url)})
                else:
                    raise ValueError(f"Unsupported links item: {item!r}")
        elif isinstance(links, dict):
            for plat, url in links.items():
                out.append({"platform": str(plat), "url": str(url)})
        else:
            raise ValueError(f"Unsupported 'links' type: {type(links).__name__}")

    # legacy single link
    if "link" in entry and entry["link"]:
        url = entry["link"]
        out.append({"platform": _infer_platform(url), "url": url})

    # de-dup
    seen = set()
    deduped = []
    for d in out:
        key = (d["platform"], d["url"])
        if key not in seen:
            seen.add(key)
            deduped.append(d)
    return deduped

def main():
    parser = argparse.ArgumentParser(description="Convert YAML directory structure into flat JSON")
    parser.add_argument("input_dir", help="Root directory (e.g. data/)")
    parser.add_argument("--output", default="data.json", help="Output JSON file")
    args = parser.parse_args()

    input_path = Path(args.input_dir)
    all_problems = []

    for source_dir in input_path.iterdir():
        if not source_dir.is_dir():
            continue

        for year_path in source_dir.iterdir():
            if year_path.is_file() and year_path.suffix == ".yaml":
                year = int(year_path.stem)
                extra = None
                yaml_files = [(year_path, year, extra)]
            elif year_path.is_dir():
                year = int(year_path.name)
                yaml_files = [(p, year, p.stem.replace("_", " ")) for p in year_path.glob("*.yaml")]
            else:
                continue

            for yaml_path, year, extra in yaml_files:
                with open(yaml_path, "r", encoding="utf-8") as f:
                    problems = yaml.safe_load(f) or []

                for problem in problems:
                    problem["source"] = source_dir.name.upper()
                    problem["year"] = year
                    if extra:
                        problem["extra"] = extra

                    # normalize links (adds unified 'links' array; keeps legacy 'link' as-is)
                    problem["links"] = _normalize_links(problem)

                    all_problems.append(problem)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(all_problems, f, indent=2, ensure_ascii=False)

    print(f"Wrote {len(all_problems)} problems to {args.output}")

if __name__ == "__main__":
    main()

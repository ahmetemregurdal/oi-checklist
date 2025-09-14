import argparse
import json
import yaml
from pathlib import Path

def load_yaml(path):
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or []

def save_yaml(path, data):
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, sort_keys=False)

def main():
    parser = argparse.ArgumentParser(description="Add or remove problems to/from YAML files from a JSON file")
    parser.add_argument("json_file", help="Input JSON file containing problems to add/remove")
    parser.add_argument("--remove", action="store_true", help="Remove instead of adding problems")
    args = parser.parse_args()

    with open(args.json_file, "r", encoding="utf-8") as f:
        problems = json.load(f)

    for problem in problems:
        source = problem["source"].lower()
        year = str(problem["year"])
        extra = problem.get("extra")

        stripped = {k: v for k, v in problem.items() if k not in {"source", "year", "extra"}}

        if extra:
            extra_filename = extra.replace(" ", "_")
            filepath = Path("data") / source / year / f"{extra_filename}.yaml"
        else:
            filepath = Path("data") / source / f"{year}.yaml"

        existing = load_yaml(filepath)

        if args.remove:
            existing = [p for p in existing if p != stripped]
        else:
            if stripped not in existing:
                existing.append(stripped)

        filepath.parent.mkdir(parents=True, exist_ok=True)
        save_yaml(filepath, existing)
        print(f"{'Removed from' if args.remove else 'Updated'}: {filepath}")

if __name__ == "__main__":
    main()
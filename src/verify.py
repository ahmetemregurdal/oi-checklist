#!/usr/bin/env python3
import importlib
import sys

REQUIRED_PACKAGES = ["bs4", "requests", "cloudscraper"]

missing = []
for pkg in REQUIRED_PACKAGES:
  try:
    importlib.import_module(pkg)
  except ImportError:
    missing.append(pkg)

if missing:
  sys.stderr.write(
    f"[error] missing python packages: {', '.join(missing)}\n"
    f"        please run: pip install {' '.join(missing)}\n"
  )
  sys.exit(1)

sys.stdout.write(f"[ok] python dependencies: {', '.join(REQUIRED_PACKAGES)}")
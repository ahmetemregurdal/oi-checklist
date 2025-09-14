

# Problem Data Structure Guide

This guide explains how competitive programming problems are stored in the `data/` directory using structured YAML files, and how to convert them to and from a flat JSON file (`data.json`).

---

## Folder and File Layout

Each problem is associated with a contest (`source`), a `year`, and optionally an `extra` subdivision (e.g., "Round A", "December", "Open").

Problems are organized as:

```
data/<source>/<year>.yaml                for problems without 'extra'
data/<source>/<year>/<extra>.yaml        for problems with 'extra'
```

- `<source>` is lowercase (e.g., `ioi`, `usacobronze`)
- `<year>` is a 4-digit year (e.g., `2025`)
- `<extra>` is the original casing but with spaces replaced by underscores

### Examples

- `data/ioi/2025.yaml`  
- `data/usacobronze/2025/Open.yaml`  
- `data/gks/2014/Round_A.yaml`

---

## YAML Format

Each YAML file contains a list of problems. These problems should include only the following fields:

```yaml
- name: Problem Name
  number: 1
  link: https://example.com/problem
```

**Do not include** `source`, `year`, or `extra` — these are inferred from the file's location.

---

## Scripts

### `yaml_to_json.py`

This script converts the entire `data/` directory into a flat `data.json` file.

**Usage:**

```bash
python yaml_to_json.py data/ --output data.json
```

- Automatically infers `source`, `year`, and `extra` from folder and file names
- Produces a flat JSON file with all fields filled in per problem

### `json_to_yaml.py`

This script takes a JSON file and updates the corresponding YAML files under `data/`. It supports both addition and removal of problems.

**Usage:**

```bash
python json_to_yaml.py problems_to_add.json
python json_to_yaml.py problems_to_remove.json --remove
```

- Infers target YAML file from each problem's `source`, `year`, and `extra`
- Adds or removes problem entries accordingly

---

## Conversion Format

Each entry in `data.json` will look like this:

```json
{
  "name": "Super 2048",
  "number": 1,
  "source": "GKS",
  "year": 2014,
  "extra": "Round A",
  "link": "https://www.acmicpc.net/problem/12209"
}
```

- `source` is capitalized from the folder name
- `extra` is converted from the filename (e.g., `Round_A.yaml` → `"Round A"`)

---

## Summary

| Case           | Path Example                       | Required Fields       |
|----------------|------------------------------------|------------------------|
| No `extra`     | `data/ioi/2025.yaml`              | `name`, `number`, `link` |
| With `extra`   | `data/gks/2014/Round_A.yaml`       | `name`, `number`, `link` |

Only the YAML files should be edited manually. `data.json` is a generated file.
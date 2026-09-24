#!/usr/bin/env python3
"""Fail if a container command/args contains "$$" in rendered manifests.

Kubernetes collapses "$$" to "$" in command and args (it is the escape for
$(VAR) references), which silently breaks shell scripts and SQL dollar quotes.
Usage: check_container_commands.py <rendered.yaml>...
"""
import sys
import yaml

def problems(docs):
    found = []
    for doc in docs:
        spec = (doc.get("spec") or {})
        template = (spec.get("template") or {}).get("spec") or spec.get("jobTemplate", {}).get("spec", {}).get("template", {}).get("spec")
        if not template:
            continue
        for container in template.get("containers", []) + template.get("initContainers", []):
            for field in ("command", "args"):
                if any("$$" in str(part) for part in container.get(field) or []):
                    found.append(f"{doc['kind']}/{doc['metadata']['name']} container {container['name']} {field} contains $$")
    return found

if __name__ == "__main__":
    issues = [issue for path in sys.argv[1:] for issue in problems([d for d in yaml.safe_load_all(open(path)) if d])]
    for issue in issues:
        print(f"::error::{issue}")
    sys.exit(1 if issues else 0)

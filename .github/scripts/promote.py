#!/usr/bin/env python3
"""Promote an eligible source snapshot in a disposable CI checkout."""
import os
from pathlib import Path
import re
import subprocess
import sys
import yaml

ENVIRONMENTS = {
    "staging": {
        "branch": "deploy/staging",
        "kustomization": "gitops/behavior-staging/kustomization.yaml",
    },
    "homelab": {
        "branch": "deploy/homelab",
        "kustomization": "gitops/behavior/kustomization.yaml",
    },
}

def git(*args, check=True):
    return subprocess.run(["git", *args], check=check, text=True, capture_output=True)

def report(message):
    print(message, flush=True)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
            summary.write(message + "\n")

def refresh(deploy_branch):
    git("fetch", "--no-tags", "origin",
        "+refs/heads/main:refs/remotes/origin/main",
        f"+refs/heads/{deploy_branch}:refs/remotes/origin/{deploy_branch}")

def promote(source, environment):
    if environment not in ENVIRONMENTS:
        raise ValueError(f"Unknown environment {environment!r}; expected one of {sorted(ENVIRONMENTS)}")
    deploy_branch = ENVIRONMENTS[environment]["branch"]
    kustomization_path = ENVIRONMENTS[environment]["kustomization"]
    if not re.fullmatch(r"[0-9a-f]{40}", source):
        raise ValueError("Expected the full source commit SHA")
    if git("status", "--porcelain").stdout.strip():
        raise RuntimeError("Promotion requires a clean, disposable checkout")
    git("config", "user.name", "github-actions[bot]")
    git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
    for attempt in range(3):
        refresh(deploy_branch)
        if git("rev-parse", "origin/main").stdout.strip() != source:
            report(f"Skipped: {source} was superseded by a newer main commit.")
            return
        git("checkout", "--detach", f"origin/{deploy_branch}")
        # Copy the exact tested source tree while retaining deployment history.
        git("read-tree", "--reset", "-u", source)
        overlay = Path(kustomization_path)
        content = yaml.safe_load(overlay.read_text())
        images = content["images"]
        for service in ("ingestion-api", "stream-processor", "analytics-api", "dashboard"):
            matches = [entry for entry in images
                       if entry.get("name") == f"ghcr.io/monoji77/behavior-{service}"]
            if len(matches) != 1:
                raise RuntimeError(f"Expected exactly one image entry for {service}")
            matches[0]["newTag"] = source
        overlay.write_text(yaml.safe_dump(content, sort_keys=False))
        git("add", kustomization_path)
        if git("diff", "--cached", "--quiet", check=False).returncode == 0:
            report(f"Already promoted: {source}")
            return
        git("commit", "-m", f"Promote behavior images to {source}")
        # Check again after preparing the commit; never push an observed stale build.
        refresh(deploy_branch)
        if git("rev-parse", "origin/main").stdout.strip() != source:
            report(f"Skipped: {source} was superseded while preparing promotion.")
            return
        result = git("push", "origin", f"HEAD:refs/heads/{deploy_branch}", check=False)
        if result.returncode == 0:
            report(f"Promoted {source} to {deploy_branch}.")
            return
        print(result.stderr, file=sys.stderr)
        # A competing deployment commit causes a normal non-fast-forward rejection.
        # Re-fetch and re-check source freshness before rebuilding on its new parent.
    raise RuntimeError("Promotion failed after three attempts; deployment was not force-pushed")

if __name__ == "__main__":
    promote(sys.argv[1], sys.argv[2])

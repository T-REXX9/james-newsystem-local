#!/usr/bin/env python3

"""Generate a client-facing activity report from git history.

Focuses on PR merge commits of the form: "Merge pull request #NN ...".

Usage:
  python3 scripts/generate_client_activity_report.py \
    --since "2025-12-28 00:00:00" \
    --branch origin/main
"""

from __future__ import annotations

import argparse
import re
import subprocess
from collections import Counter


def sh(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, text=True, stderr=subprocess.STDOUT).strip("\n")


def parse_pr_title(merge_sha: str) -> str:
    body = sh(["git", "show", "-s", "--format=%B", merge_sha])
    lines = [l.rstrip() for l in body.splitlines()]
    # Typical GitHub merge message:
    #   Merge pull request #N from ...
    #
    #   PR Title
    seen_blank = False
    for l in lines[1:]:
        if not seen_blank and l.strip() == "":
            seen_blank = True
            continue
        if seen_blank and l.strip():
            return l.strip()
    return lines[0].strip() if lines else "(no title)"


def get_parents(merge_sha: str) -> tuple[str, str] | None:
    parents = sh(["git", "show", "-s", "--format=%P", merge_sha]).split()
    if len(parents) >= 2:
        return parents[0], parents[1]
    return None


def numstat_between(a: str, b: str) -> list[tuple[int, int, str]]:
    out = sh(["git", "diff", "--numstat", a, b])
    rows: list[tuple[int, int, str]] = []
    for line in out.splitlines():
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        add_s, del_s, path = parts
        if add_s == "-" or del_s == "-":
            # binary or unknown
            continue
        try:
            adds = int(add_s)
            dels = int(del_s)
        except ValueError:
            continue
        rows.append((adds, dels, path))
    return rows


def commit_subjects_between(a: str, b: str, limit: int = 6) -> list[str]:
    """Return commit subjects that are reachable from b but not from a.

    For a typical GitHub merge commit with parents (main, feature), this yields
    the feature branch commits that got merged.
    """
    out = sh([
        "git",
        "log",
        f"--max-count={limit}",
        "--pretty=format:%h %s",
        f"{a}..{b}",
    ])
    return [l.strip() for l in out.splitlines() if l.strip()]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", required=True)
    ap.add_argument("--branch", default="origin/main")
    args = ap.parse_args()

    since = args.since
    branch = args.branch

    # Find merge commits that correspond to GitHub PR merges
    log = sh(
        [
            "git",
            "log",
            branch,
            f"--since={since}",
            "--merges",
            "--grep=Merge pull request",
            "--date=iso-strict",
            "--pretty=format:%H|%ad|%s",
        ]
    )
    entries = [l for l in log.splitlines() if l.strip()]

    items = []
    pr_re = re.compile(r"Merge pull request #(\d+)")
    for line in entries:
        sha, date, subj = line.split("|", 2)
        m = pr_re.search(subj)
        if not m:
            continue
        pr = int(m.group(1))
        title = parse_pr_title(sha)
        parents = get_parents(sha)
        if not parents:
            continue
        p1, p2 = parents
        stats = numstat_between(p1, p2)
        commits = commit_subjects_between(p1, p2, limit=6)

        total_add = sum(a for a, _, _ in stats)
        total_del = sum(d for _, d, _ in stats)
        files_changed = len(stats)

        top_dirs = Counter()
        for _, _, path in stats:
            top_dirs[path.split("/", 1)[0]] += 1

        top_files = sorted(stats, key=lambda r: (r[0] + r[1], r[0]), reverse=True)[:8]

        items.append(
            {
                "pr": pr,
                "merge_sha": sha,
                "merge_date": date,
                "title": title,
                "files_changed": files_changed,
                "additions": total_add,
                "deletions": total_del,
                "top_dirs": top_dirs.most_common(6),
                "top_files": top_files,
                "commits": commits,
            }
        )

    # Sort newest first
    items.sort(key=lambda it: it["merge_date"], reverse=True)

    grand_add = sum(it["additions"] for it in items)
    grand_del = sum(it["deletions"] for it in items)

    print(f"# Client Activity Report ({since} → now)")
    print()
    print(f"Source: `{branch}`")
    print()
    print("## Summary")
    print(f"- PR merges found from git: **{len(items)}**")
    print(f"- Total additions/deletions across those merges: **+{grand_add} / -{grand_del}**")
    print("- Note: If some PRs were merged via rebase/squash without a merge commit, they will not appear here and should be appended separately.")
    print()

    print("## Detailed changes (per PR)")
    for it in items:
        pr = it["pr"]
        print(f"### PR #{pr} — {it['title']}")
        print(f"- Link: https://github.com/T-REXX9/james-newsystem/pull/{pr}")
        print(f"- Merged (git): {it['merge_date']} — `{it['merge_sha'][:7]}`")
        print(f"- Files changed: {it['files_changed']}  |  +{it['additions']} / -{it['deletions']}")

        if it.get("commits"):
            print("- Included commits (top):")
            for c in it["commits"]:
                print(f"  - {c}")

        if it["top_dirs"]:
            dirs = ", ".join([f"{d} ({c})" for d, c in it["top_dirs"]])
            print(f"- Areas touched (top): {dirs}")

        print("- Top changed files (by churn):")
        for a, d, p in it["top_files"]:
            print(f"  - `{p}` (+{a}/-{d})")
        if it["files_changed"] > len(it["top_files"]):
            print(f"  - …and {it['files_changed'] - len(it['top_files'])} more file(s)")
        print()


if __name__ == "__main__":
    main()

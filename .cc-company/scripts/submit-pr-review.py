#!/usr/bin/env python3
"""
Submit a PR review with inline comments via GitHub API.

Usage:
  echo '<json>' | python3 .cc-company/scripts/submit-pr-review.py

Input JSON (stdin):
{
  "pr": 1,
  "event": "COMMENT" | "APPROVE" | "REQUEST_CHANGES",
  "body": "종합 리뷰 본문",
  "comments": [
    {
      "path": "src/foo.ts",
      "line": 42,
      "body": "p2: 코멘트 내용"
    },
    {
      "path": "src/bar.ts",
      "start_line": 10,
      "line": 15,
      "body": "p3: 멀티라인 코멘트"
    }
  ]
}

- line: 코멘트 대상의 끝 줄 번호 (필수)
- start_line: 멀티라인 코멘트의 시작 줄 번호 (선택)
- comments가 빈 배열이면 본문만 있는 리뷰 제출
"""

import json
import subprocess
import sys


def get_repo() -> str:
    r = subprocess.run(
        ["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        print(f"ERROR: Failed to get repo info: {r.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    return r.stdout.strip()


def get_latest_commit(pr: int) -> str:
    r = subprocess.run(
        ["gh", "pr", "view", str(pr), "--json", "commits", "-q", ".commits[-1].oid"],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        print(f"ERROR: Failed to get PR commits: {r.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    return r.stdout.strip()


def main():
    data = json.load(sys.stdin)

    pr = data["pr"]
    event = data["event"]
    body = data["body"]
    comments = data.get("comments", [])

    if event not in ("COMMENT", "APPROVE", "REQUEST_CHANGES"):
        print(f"ERROR: Invalid event type: {event}", file=sys.stderr)
        sys.exit(1)

    repo = get_repo()
    commit_id = get_latest_commit(pr)

    review_comments = []
    for c in comments:
        comment = {
            "path": c["path"],
            "line": c["line"],
            "body": c["body"],
        }
        if "start_line" in c and c["start_line"] != c["line"]:
            comment["start_line"] = c["start_line"]
        review_comments.append(comment)

    payload = {
        "commit_id": commit_id,
        "body": body,
        "event": event,
        "comments": review_comments,
    }

    r = subprocess.run(
        ["gh", "api", f"repos/{repo}/pulls/{pr}/reviews", "--input", "-"],
        input=json.dumps(payload),
        capture_output=True, text=True,
    )

    if r.returncode != 0:
        print(f"ERROR: Failed to submit review: {r.stderr.strip()}", file=sys.stderr)
        print(f"Payload: {json.dumps(payload, indent=2)}", file=sys.stderr)
        sys.exit(1)

    response = json.loads(r.stdout)
    print(f"Review submitted: {response.get('html_url', 'OK')}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
PR 생성 및 tasks/index.json 업데이트 스크립트.

Usage: python3 create-pr.py <task-dir> --title "..." --body "..."
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

from _utils import find_project_root, resolve_gh_env

ROOT = find_project_root()
TASKS_DIR = ROOT / "tasks"
TOP_INDEX_FILE = TASKS_DIR / "index.json"


def main():
    # 1. CLI 인자 파싱
    parser = argparse.ArgumentParser(description="Create PR and update index.json")
    parser.add_argument("task_dir", help="Task directory name (e.g., 8-pr-tracking)")
    parser.add_argument("--title", required=True, help="PR title")
    parser.add_argument("--body", required=True, help="PR body")
    args = parser.parse_args()

    task_dir = TASKS_DIR / args.task_dir
    task_index_file = task_dir / "index.json"

    # 2. task index.json 로드
    if not task_index_file.exists():
        print(f"ERROR: {task_index_file} not found")
        sys.exit(1)

    with open(task_index_file) as f:
        task_index = json.load(f)

    task_name = task_index.get("task", args.task_dir)
    gh_user = task_index.get("gh_user")  # optional

    # 3. 현재 브랜치 검증
    expected_branch = f"feat-{task_name}"
    result = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        capture_output=True, text=True, cwd=str(ROOT)
    )
    current_branch = result.stdout.strip()
    if current_branch != expected_branch:
        print(f"ERROR: Current branch is '{current_branch}', expected '{expected_branch}'")
        sys.exit(1)

    # 4. gh_user가 있으면 환경변수 resolve
    gh_env = resolve_gh_env(gh_user)
    run_env = {**os.environ, **gh_env} if gh_env else None

    # 5. gh pr create 실행
    cmd = ["gh", "pr", "create", "--title", args.title, "--body", args.body]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT), env=run_env)

    if result.returncode != 0:
        print(f"ERROR: gh pr create failed")
        print(result.stderr)
        sys.exit(1)

    # 6. PR URL 파싱
    pr_url = result.stdout.strip()
    # URL 형식: https://github.com/owner/repo/pull/123
    match = re.search(r"/pull/(\d+)$", pr_url)
    if not match:
        print(f"ERROR: Could not parse PR number from URL: {pr_url}")
        sys.exit(1)
    pr_number = int(match.group(1))

    # 7. repository URL 추출 (필요시)
    # pr_url에서 /pull/N 제거
    repo_url = re.sub(r"/pull/\d+$", "", pr_url)

    # 8. /tasks/index.json 업데이트
    with open(TOP_INDEX_FILE) as f:
        top_index = json.load(f)

    # repositoryUrl 추가 (없으면)
    if "repositoryUrl" not in top_index:
        top_index["repositoryUrl"] = repo_url

    # 해당 task에 pr_number, pr_url 추가
    for task in top_index.get("tasks", []):
        if task.get("dir") == args.task_dir:
            task["pr_number"] = pr_number
            task["pr_url"] = pr_url
            break

    with open(TOP_INDEX_FILE, "w") as f:
        json.dump(top_index, f, indent=2, ensure_ascii=False)

    # 9. 성공 메시지
    print(f"✓ PR created: {pr_url}")
    print(f"✓ Updated {TOP_INDEX_FILE}")


if __name__ == "__main__":
    main()

# Phase 2: create-pr-script

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/tasks/8-pr-tracking/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/scripts/_utils.py` — `resolve_gh_env` 함수가 추가됨
- `/scripts/run-phases.py` — 참고용 (git 헬퍼 함수, 스피너 등)

## 작업 내용

### `/scripts/create-pr.py` 생성

PR을 생성하고 `/tasks/index.json`을 업데이트하는 Python 스크립트.

#### 인터페이스

```bash
python3 scripts/create-pr.py <task-dir> --title "PR 제목" --body "PR 본문"

# 예시
python3 scripts/create-pr.py 8-pr-tracking --title "feat: PR tracking" --body "## Summary
- PR 정보를 index.json에 기록
"
```

#### 동작 흐름

```python
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
```

#### 핵심 규칙

1. `--title`과 `--body`는 필수 인자다.
2. 현재 브랜치가 `feat-{task_name}`이 아니면 에러.
3. `gh_user`가 task index.json에 있으면 해당 계정으로 PR 생성.
4. PR URL에서 pr_number 파싱 실패 시 에러.
5. `/tasks/index.json`에 `repositoryUrl`이 없으면 PR URL에서 추출하여 추가.

## Acceptance Criteria

```bash
# 스크립트 존재 확인
test -f scripts/create-pr.py

# Python 문법 오류 확인
python3 -m py_compile scripts/create-pr.py

# 실행 권한 확인 (shebang이 있으므로)
head -1 scripts/create-pr.py | grep -q "python3"

# --help 동작 확인
python3 scripts/create-pr.py --help 2>&1 | grep -q "task_dir"
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/8-pr-tracking/index.json`의 phase 2 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `gh pr create`가 실패하면 index.json을 업데이트하지 마라.
- PR URL 파싱 정규식이 GitHub URL 형식에 맞는지 확인하라.
- 기존 `/tasks/index.json`의 다른 task 데이터를 손상시키지 마라.
- JSON 저장 시 `ensure_ascii=False`로 한글이 깨지지 않게 하라.

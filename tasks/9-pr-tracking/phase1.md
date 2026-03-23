# Phase 1: gh-utils

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/tasks/8-pr-tracking/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 아래 파일들을 반드시 읽어라:

- `/scripts/_utils.py` — 현재 공용 유틸리티
- `/scripts/run-phases.py` — resolve_gh_env 함수가 있는 파일

## 작업 내용

### 1. `/scripts/_utils.py` 확장

`run-phases.py`의 `resolve_gh_env` 함수와 관련 코드를 `_utils.py`로 이동한다.

추가할 내용:

```python
import os
import subprocess
import time
from typing import Optional

# 기존 _gh_cache와 resolve_gh_env 함수를 run-phases.py에서 복사
_gh_cache: dict = {"gh_user": None, "token": None, "name": None, "email": None, "expires_at": 0}


def resolve_gh_env(gh_user: Optional[str]) -> dict[str, str]:
    """Resolve GitHub profile for gh_user and return environment variables.

    Args:
        gh_user: gh CLI에 등록된 GitHub 계정명. None이면 빈 dict 반환.

    Returns:
        GH_TOKEN, GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL, GIT_COMMITTER_NAME, GIT_COMMITTER_EMAIL을 포함한 dict.
        gh_user가 None이면 빈 dict.
    """
    # run-phases.py의 기존 구현을 그대로 가져온다
    ...
```

핵심 규칙:
- `run-phases.py`의 `_gh_cache` 전역 변수와 `resolve_gh_env` 함수를 그대로 가져온다.
- 함수 시그니처와 동작은 변경하지 않는다.
- 15분 캐시 로직을 유지한다.

### 2. `/scripts/run-phases.py` 수정

`_utils.py`에서 `resolve_gh_env`를 import하도록 변경한다.

```python
# 기존
from _utils import find_project_root

# 변경
from _utils import find_project_root, resolve_gh_env
```

그리고 `run-phases.py`에서 `_gh_cache` 전역 변수와 `resolve_gh_env` 함수 정의를 삭제한다.

## Acceptance Criteria

```bash
# _utils.py에 resolve_gh_env 함수가 존재하는지 확인
grep -q "def resolve_gh_env" scripts/_utils.py

# run-phases.py에서 import하는지 확인
grep -q "from _utils import.*resolve_gh_env" scripts/run-phases.py

# run-phases.py에 로컬 resolve_gh_env 정의가 없는지 확인 (없어야 함)
! grep -q "^def resolve_gh_env" scripts/run-phases.py

# Python 문법 오류 확인
python3 -m py_compile scripts/_utils.py
python3 -m py_compile scripts/run-phases.py
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/8-pr-tracking/index.json`의 phase 1 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `resolve_gh_env`의 동작을 변경하지 마라. 시그니처와 반환값을 그대로 유지하라.
- `run-phases.py`의 다른 부분은 건드리지 마라.
- `_gh_cache`는 모듈 레벨 전역 변수로 유지해야 캐시가 동작한다.

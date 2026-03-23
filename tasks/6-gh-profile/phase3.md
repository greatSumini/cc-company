# Phase 3: run-phases

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/spec.md`
- `/spec/architecture.md`
- `/spec/adr.md`
- `/tasks/6-gh-profile/spec-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/claude-runner/env-builder.ts` — Phase 1에서 구현한 TypeScript 버전 (동일 패턴을 Python으로 재현)
- `/scripts/run-phases.py` — 이번 phase에서 수정할 대상
- `/tasks/6-gh-profile/index.json` — gh_user 필드가 어떻게 사용되는지 확인

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

`scripts/run-phases.py`에 gh_user 기반 GitHub 프로필 resolve 및 환경변수 주입 기능을 추가한다.

### 1. resolve 함수 추가

파일 상단 (Utilities 섹션)에 다음 함수를 추가:

```python
def resolve_gh_env(gh_user: Optional[str]) -> dict[str, str]:
```

동작:
1. `gh_user`가 `None`이면 빈 dict 반환
2. 캐시 확인: 모듈 스코프 `_gh_cache` dict를 사용. 키: `gh_user`, `token`, `name`, `email`, `expires_at` (unix timestamp). `gh_user`가 일치하고 `time.time() < expires_at`이면 캐시된 값 사용.
3. 캐시 미스:
   - `subprocess.run(['gh', 'auth', 'token', '--user', gh_user], capture_output=True, text=True)`로 토큰 추출
   - 실패 시 에러 메시지 출력 후 `sys.exit(1)`: `"ERROR: gh auth token failed for user '{gh_user}'. Run 'gh auth login' first."`
   - `subprocess.run(['gh', 'api', '/user', '--jq', '.name'], env={**os.environ, 'GH_TOKEN': token}, capture_output=True, text=True)`로 name 추출
   - 동일 패턴으로 email 추출 (`.email`)
   - 캐시 저장: `_gh_cache.update(gh_user=gh_user, token=token, name=name, email=email, expires_at=time.time() + 900)`
4. 반환: `{ 'GH_TOKEN': token, 'GIT_AUTHOR_NAME': name, 'GIT_AUTHOR_EMAIL': email, 'GIT_COMMITTER_NAME': name, 'GIT_COMMITTER_EMAIL': email }`

캐시 변수 초기화 (모듈 스코프):
```python
_gh_cache: dict = {"gh_user": None, "token": None, "name": None, "email": None, "expires_at": 0}
```

### 2. `run_phase()` 수정

`subprocess.run`으로 claude를 실행하는 부분에 env를 주입:

기존:
```python
result = subprocess.run(
    cmd,
    cwd=str(ROOT),
    capture_output=True,
    text=True,
    timeout=600,
)
```

변경:
```python
result = subprocess.run(
    cmd,
    cwd=str(ROOT),
    capture_output=True,
    text=True,
    timeout=600,
    env={**os.environ, **gh_env} if gh_env else None,
)
```

`gh_env`는 `run_phase`의 파라미터로 전달받는다. 함수 시그니처 변경:

```python
def run_phase(task_dir: Path, phase: dict, preamble: str, gh_env: dict[str, str]) -> dict:
```

### 3. `git_run()` 수정

git commit의 author/committer도 gh_user 기반이어야 한다. `git_run`에 env를 주입할 수 있도록 수정:

기존:
```python
def git_run(*args) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args], cwd=str(ROOT), capture_output=True, text=True
    )
```

변경:
```python
def git_run(*args, env: Optional[dict] = None) -> subprocess.CompletedProcess:
    run_env = {**os.environ, **env} if env else None
    return subprocess.run(
        ["git", *args], cwd=str(ROOT), capture_output=True, text=True, env=run_env
    )
```

그리고 `git_commit_phase`, `git_commit_docs` 등 commit을 수행하는 함수들에서 `git_run` 호출 시 `env=gh_env`를 전달하도록 수정한다. 단, `git_ensure_branch` 등 commit이 아닌 순수 조회 함수에서는 env 전달 불필요.

### 4. `main()` 수정

task index.json에서 `gh_user`를 읽고, resolve하여 각 함수에 전달:

```python
gh_user = index.get("gh_user")  # Optional
gh_env = resolve_gh_env(gh_user)
```

- `run_phase()` 호출 시 `gh_env` 전달
- `git_commit_phase()` 호출 시 `gh_env` 전달 (또는 내부에서 `git_run(..., env=gh_env)` 사용)
- `git_commit_docs()` 호출 시 `gh_env` 전달
- 최종 commit 및 push에도 `gh_env` 전달

헤더 출력에 gh_user 정보 추가:
```python
if gh_user:
    print(f"  GitHub: {gh_user}")
```

### 5. `import os` 추가

파일 상단 import에 `os`를 추가하라 (환경변수 접근에 필요).

## Acceptance Criteria

```bash
npm run build  # 컴파일 에러 없음 (Python 변경이지만 기존 TS 빌드 깨지지 않는지 확인)
npm test       # 모든 테스트 통과
python3 -c "import ast; ast.parse(open('scripts/run-phases.py').read()); print('syntax ok')"  # Python 문법 에러 없음
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/6-gh-profile/index.json`의 phase 3 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- TypeScript 코드를 수정하지 마라. 이 phase는 Python 스크립트만 다룬다.
- `subprocess.run`에 `env`를 넘길 때 반드시 `{**os.environ, **gh_env}`를 사용하라. `os.environ`을 빼면 PATH 등 기본 환경변수가 사라진다.
- `gh_user`를 shell command에 문자열 연결하지 마라. 반드시 리스트 형태로 `subprocess.run`에 전달하라 (command injection 방지).
- `gh_env`가 빈 dict일 때는 `env=None`을 전달하라 (기존 동작 유지).
- 기존 테스트를 깨뜨리지 마라.
- `git_run`의 시그니처 변경이 기존 호출부를 깨뜨리지 않도록 `env`는 keyword-only 인자로 유지하라.

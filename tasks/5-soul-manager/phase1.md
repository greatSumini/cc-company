# Phase 1: 스크립트 이동 + 참조 업데이트

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/adr.md`
- `/spec/architecture.md`
- `/tasks/5-soul-manager/spec-diff.md` (이번 task의 문서 변경 기록)

그리고 아래 파일들을 반드시 읽어라:

- `/run-phases.py` (이동 대상, 전체 내용)
- `/gen-docs-diff.py` (이동 대상, 전체 내용)
- `/prompts/task-create.md` (참조 업데이트 대상)
- `/.claude/commands/plan-and-build.md` (참조 업데이트 대상)

## 작업 내용

### 1. `scripts/_utils.py` 생성

프로젝트 루트를 찾는 공용 유틸리티를 생성하라:

```python
# scripts/_utils.py
def find_project_root() -> Path:
    """package.json이 존재하는 폴더를 만날 때까지 위로 이동하여 프로젝트 루트를 반환."""
```

- `Path(__file__).resolve().parent`에서 시작하여 상위로 올라가며 `package.json` 존재 여부를 확인
- 파일시스템 루트(`/`)까지 올라가도 못 찾으면 에러 발생
- 반환값: `package.json`이 존재하는 디렉토리의 `Path` 객체

### 2. 스크립트 이동

아래 두 파일을 `scripts/` 폴더로 이동하라:

```bash
git mv run-phases.py scripts/run-phases.py
git mv gen-docs-diff.py scripts/gen-docs-diff.py
```

### 3. ROOT 로직 수정

두 스크립트 모두 `ROOT = Path(__file__).parent`를 사용 중이다. 이를 `_utils.py`의 `find_project_root()`로 교체하라.

**`scripts/run-phases.py`**:
- 기존: `ROOT = Path(__file__).parent` (L21)
- 변경: `from _utils import find_project_root` 후 `ROOT = find_project_root()`
- `TASKS_DIR`, `TOP_INDEX_FILE` 등 ROOT에 의존하는 변수들은 그대로 유지

**`scripts/gen-docs-diff.py`**:
- 기존: `ROOT = Path(__file__).parent` (L16)
- 변경: 동일하게 `find_project_root()` 사용

### 4. run-phases.py 내부의 gen-docs-diff.py 호출 경로 수정

`run-phases.py`에서 `gen-docs-diff.py`를 subprocess로 호출하는 부분을 찾아라. 현재:

```python
subprocess.run(
    ["python3", "gen-docs-diff.py", str(task_dir), baseline],
    cwd=str(ROOT),
)
```

`gen-docs-diff.py`도 같은 `scripts/` 폴더에 있으므로 경로를 수정하라:

```python
subprocess.run(
    ["python3", str(ROOT / "scripts" / "gen-docs-diff.py"), str(task_dir), baseline],
    cwd=str(ROOT),
)
```

### 5. 참조 업데이트

**`/prompts/task-create.md`**:
- `run-phases.py` → `scripts/run-phases.py` (모든 곳)
- `gen-docs-diff.py` → `scripts/gen-docs-diff.py` (모든 곳)
- 섹션 제목 `### 5. \`/run-phases.py\`` → `### 5. \`/scripts/run-phases.py\``
- 실행 예시: `python3 run-phases.py` → `python3 scripts/run-phases.py`

**`/.claude/commands/plan-and-build.md`**:
- `run-phases.py` → `scripts/run-phases.py` (모든 곳)

### 6. `__pycache__/` 삭제

프로젝트 루트의 `__pycache__/` 디렉토리를 삭제하라:

```bash
rm -rf __pycache__/
```

`.gitignore`에 `__pycache__/`가 없다면 추가하라.

### 7. `scripts/README.md` 생성

아래 내용으로 생성하라:

| 스크립트 | 역할 | 관련 파일 |
|---|---|---|
| `run-phases.py` | task의 phase를 순차 실행하는 runner | `tasks/*/index.json`, `tasks/*/phase*.md`, `prompts/task-create.md` |
| `gen-docs-diff.py` | Phase 0 완료 후 docs/ 변경 diff를 markdown으로 생성 | `tasks/*/spec-diff.md` |
| `_utils.py` | 스크립트 공용 유틸리티 (프로젝트 루트 탐색 등) | - |

의존성과 실행 방법도 포함하라.

## Acceptance Criteria

```bash
# 이동된 파일 존재 확인
test -f scripts/run-phases.py && test -f scripts/gen-docs-diff.py && test -f scripts/_utils.py

# 원래 위치에 파일이 없는지 확인
! test -f run-phases.py && ! test -f gen-docs-diff.py

# 옛 경로 참조가 남아있지 않은지 확인 (scripts/ 내부 제외)
! grep -r --include='*.md' 'python3 run-phases\.py' prompts/ .claude/
! grep -r --include='*.md' 'python3 gen-docs-diff\.py' prompts/ .claude/

# __pycache__ 삭제 확인
! test -d __pycache__

# README 존재
test -f scripts/README.md
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/5-soul-manager/index.json`의 phase 1 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `run-phases.py`의 로직을 변경하지 마라. ROOT 탐색 방식과 gen-docs-diff.py 호출 경로만 수정.
- `gen-docs-diff.py`의 로직을 변경하지 마라. ROOT 탐색 방식만 수정.
- `.cc-company/scripts/submit-pr-review.py`는 이동 대상이 아니다. 건드리지 마라.
- `prompts/task-create.md`에서 경로 업데이트 시, 섹션 제목/본문/코드블록 안의 경로를 모두 빠짐없이 변경하라. `### run-phases.py 자동 동작` 같은 섹션 제목도 포함.
- 기존 테스트를 깨뜨리지 마라.

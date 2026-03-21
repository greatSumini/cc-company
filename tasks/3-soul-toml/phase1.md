# Phase 1: Soul 데이터 마이그레이션 + 커맨드 업데이트

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/architecture.md`
- `/docs/spec.md`
- `/docs/adr.md`
- `/tasks/3-soul-toml/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/claude.md` (Phase 0에서 업데이트된 soul 지침 — 새 경로/포맷 확인)

현재 soul 파일들의 데이터를 확인하라:

- `/soul/master.md`
- `/soul/project.md`
- `/soul/soul.md`

그리고 review-soul 커맨드를 확인하라:

- `/.claude/commands/review-soul.md`

## 작업 내용

### 1. 디렉토리 구조 생성

아래 디렉토리를 생성한다:

```
soul/
├── master/
│   ├── insights.toml
│   └── gotchas.toml
├── project/
│   ├── insights.toml
│   └── gotchas.toml
└── ai/
    ├── insights.toml
    └── gotchas.toml
```

### 2. 데이터 마이그레이션

각 기존 `.md` 파일의 Insights와 Gotchas 섹션을 파싱하여 TOML로 변환한다.

**TOML 스키마** (모든 `insights.toml`과 `gotchas.toml`이 동일한 스키마를 따른다):

```toml
[[entries]]
created_at = "2026-03-18"
last_used_at = "2026-03-21"
content = "엔트리 내용"
```

**마이그레이션 매핑**:

| 기존 파일 | 신규 파일 |
|---|---|
| `soul/master.md` → Insights 섹션 | `soul/master/insights.toml` |
| `soul/master.md` → Gotchas 섹션 | `soul/master/gotchas.toml` |
| `soul/project.md` → Insights 섹션 | `soul/project/insights.toml` |
| `soul/project.md` → Gotchas 섹션 | `soul/project/gotchas.toml` |
| `soul/soul.md` → Insights 섹션 | `soul/ai/insights.toml` |
| `soul/soul.md` → Gotchas 섹션 | `soul/ai/gotchas.toml` |

**파싱 규칙**: 기존 마크다운의 각 항목은 다음 형태:
```
- [2026-03-18] 내용 텍스트 (마지막 사용: 2026-03-21)
```
- `[날짜]` → `created_at`
- `(마지막 사용: 날짜)` → `last_used_at`
- 나머지 텍스트 → `content`

**Gotchas 섹션이 비어있는 경우**: 해당 `gotchas.toml`은 빈 파일(내용 없음)로 생성한다. `[[entries]]`를 넣지 않는다.

### 3. 기존 파일 삭제

마이그레이션이 완료되면 기존 파일을 삭제한다:

- `soul/master.md`
- `soul/project.md`
- `soul/soul.md`

### 4. review-soul 커맨드 업데이트

`/.claude/commands/review-soul.md`를 새 구조에 맞게 업데이트한다.

핵심 변경:
- `/soul/` 하위 경로 참조를 새 디렉토리 구조(`soul/{category}/insights.toml`, `soul/{category}/gotchas.toml`)로 변경
- "마지막 사용 날짜" 업데이트 지침을 TOML의 `last_used_at` 필드 업데이트로 변경
- 신규 추가 시 `[[entries]]` 블록을 추가하는 형태로 지침 변경
- 기존 커맨드의 3단계 흐름(신규 추가 → 기존 내용 확인 → 날짜 업데이트)은 유지

### 5. TOML 스키마 검증

마이그레이션 완료 후, 아래 Python 스크립트를 `/validate-soul-toml.py`로 생성하여 실행한다:

```python
#!/usr/bin/env python3
"""Validate all soul TOML files follow the expected schema."""
import sys
import tomllib
from pathlib import Path

SOUL_DIR = Path(__file__).parent / "soul"
EXPECTED_DIRS = ["master", "project", "ai"]
EXPECTED_FILES = ["insights.toml", "gotchas.toml"]
REQUIRED_KEYS = {"created_at", "last_used_at", "content"}

errors = []

for d in EXPECTED_DIRS:
    dir_path = SOUL_DIR / d
    if not dir_path.is_dir():
        errors.append(f"Missing directory: {dir_path}")
        continue
    for f in EXPECTED_FILES:
        file_path = dir_path / f
        if not file_path.exists():
            errors.append(f"Missing file: {file_path}")
            continue
        text = file_path.read_text()
        if not text.strip():
            continue  # Empty file is valid (no entries)
        try:
            data = tomllib.loads(text)
        except Exception as e:
            errors.append(f"Invalid TOML in {file_path}: {e}")
            continue
        if "entries" not in data:
            errors.append(f"Missing 'entries' key in {file_path}")
            continue
        for i, entry in enumerate(data["entries"]):
            missing = REQUIRED_KEYS - set(entry.keys())
            if missing:
                errors.append(f"{file_path} entry[{i}]: missing keys {missing}")
            extra = set(entry.keys()) - REQUIRED_KEYS
            if extra:
                errors.append(f"{file_path} entry[{i}]: unexpected keys {extra}")

if errors:
    print("VALIDATION FAILED:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
else:
    print("All soul TOML files are valid.")
    sys.exit(0)
```

검증 통과 후 이 스크립트 파일을 삭제한다.

## Acceptance Criteria

```bash
# 1. TOML 스키마 검증
python3 validate-soul-toml.py

# 2. 기존 .md 파일이 삭제되었는지 확인
! test -f soul/master.md
! test -f soul/project.md
! test -f soul/soul.md

# 3. 새 디렉토리 구조가 존재하는지 확인
test -d soul/master
test -d soul/project
test -d soul/ai

# 4. review-soul 커맨드가 새 경로를 참조하는지 확인
grep -q 'insights.toml' .claude/commands/review-soul.md
grep -q 'gotchas.toml' .claude/commands/review-soul.md

# 5. 검증 스크립트가 삭제되었는지 확인
! test -f validate-soul-toml.py

# 6. 기존 빌드/테스트가 깨지지 않았는지 확인
npm run build
npm test
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/3-soul-toml/index.json`의 phase 1 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 데이터 손실 금지: 기존 soul 파일의 모든 엔트리가 빠짐없이 마이그레이션되어야 한다. 마이그레이션 전후 엔트리 수를 대조하라.
- `soul/soul.md`는 `soul/ai/`로 마이그레이션한다. `soul/soul/`이 아니다. 반드시 `ai` 디렉토리명을 사용하라.
- TOML에서 content 값에 따옴표나 특수문자가 포함될 수 있다. 멀티라인 문자열이 필요하면 `"""..."""`를 사용하라.
- `validate-soul-toml.py`는 AC 검증용이다. 검증 통과 후 반드시 삭제하라. 커밋에 포함시키지 마라.
- `claude.md`는 이 phase에서 수정하지 마라. Phase 0에서 이미 완료됨.
- 기존 테스트를 깨뜨리지 마라.

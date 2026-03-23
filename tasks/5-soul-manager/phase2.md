# Phase 2: Soul TOML 마이그레이션 + soul-manager.py

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/adr.md` (특히 ADR-013: Soul entry ID scheme)
- `/tasks/5-soul-manager/spec-diff.md` (이번 task의 문서 변경 기록)

그리고 아래 파일들을 반드시 읽어라:

- `/soul/ai/insights.toml`
- `/soul/ai/gotchas.toml`
- `/soul/master/insights.toml`
- `/soul/master/gotchas.toml`
- `/soul/project/insights.toml`
- `/soul/project/gotchas.toml`
- `/scripts/_utils.py` (Phase 1에서 생성됨)
- `/scripts/README.md` (Phase 1에서 생성됨)

## 작업 내용

### 1. Soul TOML 마이그레이션 — id 필드 추가

6개 soul TOML 파일의 모든 `[[entries]]` 항목에 `id` 필드를 추가하라. 각 파일 내에서 1부터 순서대로 부여한다.

변경 전:
```toml
[[entries]]
created_at = "2026-03-19"
last_used_at = "2026-03-21"
content = "내용"
```

변경 후:
```toml
[[entries]]
id = 1
created_at = "2026-03-19"
last_used_at = "2026-03-21"
content = "내용"
```

- `id`는 각 `[[entries]]` 블록의 첫 번째 필드로 배치
- 파일별로 독립적으로 1부터 시작
- 빈 파일(entries가 없는 파일)은 그대로 두라

### 2. `scripts/soul-manager.py` 생성

`tomlkit` 라이브러리를 사용하여 soul TOML 파일을 조작하는 CLI 스크립트를 생성하라.

#### 서브커맨드

**`touch`** — 지정 항목의 `last_used_at`을 오늘 날짜로 갱신

```bash
python3 scripts/soul-manager.py touch soul/ai/insights.toml:1 soul/master/gotchas.toml:2
```

- 인자: `파일경로:id` 형식, 1개 이상
- 동작: 해당 파일의 해당 id를 가진 entry의 `last_used_at`을 오늘 날짜(`YYYY-MM-DD`)로 변경
- 존재하지 않는 파일이나 id는 에러 메시지 출력 후 해당 항목 스킵 (나머지는 계속 처리)

**`stale`** — `last_used_at`이 N일 이상 지난 항목 목록 출력

```bash
python3 scripts/soul-manager.py stale --days 14
python3 scripts/soul-manager.py stale --days 14 --format human
```

- `--days` (필수): 기준 일수
- `--format` (선택): `json`(기본) 또는 `human`
- 동작: 모든 soul TOML 파일(`soul/` 하위 `**/*.toml`)을 스캔하여 기준 초과 항목 출력
- JSON 출력 형식:
```json
[
  {
    "file": "soul/project/insights.toml",
    "id": 3,
    "content": "내용 미리보기...",
    "last_used_at": "2026-03-01",
    "days_since": 21
  }
]
```
- human 출력 형식: 파일별로 그룹핑하여 id, content 앞부분(50자), last_used_at, 경과일수를 테이블 형태로 출력

**`remove`** — 지정 항목 제거

```bash
python3 scripts/soul-manager.py remove soul/ai/insights.toml:1 soul/project/gotchas.toml:3
```

- 인자: `파일경로:id` 형식, 1개 이상
- 동작: 해당 entry를 파일에서 제거. 나머지 entry의 id는 변경하지 않음
- 존재하지 않는 id는 에러 메시지 출력 후 스킵

**`grace`** — 지정 항목의 `last_used_at`을 7일 전으로 갱신

```bash
python3 scripts/soul-manager.py grace soul/ai/insights.toml:2 soul/master/insights.toml:1
```

- 인자: `파일경로:id` 형식, 1개 이상
- 동작: 해당 entry의 `last_used_at`을 `오늘 - 7일`로 변경
- stale 판정(14일)까지 7일의 유예 기간을 부여하는 목적

#### 공통 규칙

- 프로젝트 루트 탐색: `_utils.py`의 `find_project_root()` 사용
- 파일 경로는 프로젝트 루트 기준 상대 경로로 해석
- `argparse`로 CLI 파싱
- 모든 파일 읽기/쓰기에 `tomlkit` 사용 (포맷 보존)
- 처리 결과를 stdout에 출력 (성공/실패 항목별 1줄씩)

### 3. `scripts/requirements.txt` 생성

```
tomlkit
```

### 4. `scripts/README.md` 업데이트

Phase 1에서 생성된 README에 아래 항목을 추가하라:

| 스크립트 | 역할 | 관련 파일 |
|---|---|---|
| `soul-manager.py` | soul TOML 항목의 last_used_at 갱신, stale 항목 조회, 항목 제거/유예 | `soul/**/*.toml`, `.claude/commands/review-soul.md` |

의존성 섹션에 `pip install -r scripts/requirements.txt` 안내도 추가하라.

## Acceptance Criteria

```bash
# tomlkit 설치 확인 (없으면 설치)
pip install tomlkit 2>/dev/null

# 모든 soul TOML 파일에 id 필드가 있는지 확인
python3 -c "
import tomllib
from pathlib import Path
root = Path('.')
for f in sorted(root.glob('soul/**/*.toml')):
    data = tomllib.loads(f.read_text())
    entries = data.get('entries', [])
    for e in entries:
        assert 'id' in e, f'{f}: entry missing id field'
    ids = [e['id'] for e in entries]
    assert len(ids) == len(set(ids)), f'{f}: duplicate ids'
print('Migration OK')
"

# soul-manager.py smoke test: stale 실행
python3 scripts/soul-manager.py stale --days 0

# soul-manager.py smoke test: touch 실행 (첫 번째 파일의 id=1)
python3 scripts/soul-manager.py touch soul/ai/insights.toml:1

# requirements.txt 존재
test -f scripts/requirements.txt
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/5-soul-manager/index.json`의 phase 2 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 마이그레이션 시 기존 entry의 `created_at`, `last_used_at`, `content` 값을 절대 변경하지 마라. `id` 필드만 추가.
- `soul/project/gotchas.toml`은 현재 빈 파일이다. entries가 없으므로 건드리지 마라.
- tomlkit으로 파일을 쓸 때 기존 포맷(줄바꿈, 따옴표 스타일)이 최대한 보존되는지 확인하라.
- `remove` 실행 후 남은 entry의 id를 재부여하지 마라. id는 영구 식별자다.
- 기존 테스트를 깨뜨리지 마라.

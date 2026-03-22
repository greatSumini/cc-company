# Phase 3: review-soul 프롬프트 재작성

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/adr.md` (특히 ADR-013)
- `/tasks/5-soul-manager/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 아래 파일들을 반드시 읽어라:

- `/.claude/commands/review-soul.md` (재작성 대상)
- `/scripts/soul-manager.py` (Phase 2에서 생성됨 — 서브커맨드 인터페이스 확인)
- `/soul/ai/insights.toml`, `/soul/ai/gotchas.toml`
- `/soul/master/insights.toml`, `/soul/master/gotchas.toml`
- `/soul/project/insights.toml`, `/soul/project/gotchas.toml`
- `/CLAUDE.md` (soul 문서 형식 가이드 섹션)

## 작업 내용

### 1. `/.claude/commands/review-soul.md` 재작성

기존 내용을 완전히 교체하라. 새 프롬프트는 아래 6단계 워크플로우를 AI 에이전트에게 지시하는 형식이어야 한다:

**단계 1**: 모든 soul 문서 읽기
- `/soul/` 하위의 모든 `.toml` 파일을 읽는다.

**단계 2**: 유용한 항목 식별
- 현재까지의 대화를 되돌아보며, 각 soul 문서 항목 중:
  - 이번 대화에서 실제로 참조된 항목
  - 참조되지는 않았지만, 참조했다면 유용했을 항목
- 해당 항목들을 파일 경로, id, content와 함께 목록으로 제시한다.

**단계 3**: 사용자 검증
- 단계 2에서 식별한 항목들이 정말 유용하게 참조할 만한지 사용자에게 확인받는다.
- 사용자가 제외한 항목은 목록에서 뺀다.

**단계 4**: 검증된 항목의 last_used_at 갱신
- 사용자가 확인한 항목들에 대해 `scripts/soul-manager.py touch` 명령을 실행한다.
- 예시: `python3 scripts/soul-manager.py touch soul/ai/insights.toml:1 soul/master/gotchas.toml:2`

**단계 5**: stale 항목 목록 추출 + 사용자 확인
- `python3 scripts/soul-manager.py stale --days 14 --format human`을 실행한다.
- 결과가 있으면 사용자에게 보여주고, 전부 제거할지 확인받는다.
- 사용자가 일부를 남기겠다고 하면, 남길 항목과 제거할 항목을 구분한다.

**단계 6**: 제거 및 유예 처리
- 제거 대상: `python3 scripts/soul-manager.py remove 파일:id [파일:id ...]`
- 유예 대상 (사용자가 남기기로 한 것): `python3 scripts/soul-manager.py grace 파일:id [파일:id ...]`

#### 프롬프트 작성 시 핵심 규칙

- 단계별로 사용자 피드백을 받은 뒤 다음 단계로 넘어가라는 지시를 명확히 포함
- soul-manager.py 호출은 반드시 Bash 도구로 실행하라는 지시
- TOML 엔트리 형식을 명시하여 AI가 파일 구조를 이해하도록:
  ```toml
  [[entries]]
  id = 1
  created_at = "2026-03-18"
  last_used_at = "2026-03-21"
  content = "엔트리 내용"
  ```
- 신규 항목 추가 로직도 포함: 대화에서 새로 발견된 인사이트/gotcha가 있다면, 단계 1 직후에 사용자에게 제안하고 피드백 받은 뒤 직접 TOML 파일에 추가 (id는 해당 파일의 max(id) + 1)

### 2. `/CLAUDE.md`의 soul 문서 형식 가이드 업데이트

`CLAUDE.md`에 있는 soul 엔트리 형식 예시에 `id` 필드를 추가하라:

변경 전:
```toml
[[entries]]
created_at = "2026-03-18"
last_used_at = "2026-03-21"
content = "주요 인사이트 또는 Gotcha 내용"
```

변경 후:
```toml
[[entries]]
id = 1
created_at = "2026-03-18"
last_used_at = "2026-03-21"
content = "주요 인사이트 또는 Gotcha 내용"
```

## Acceptance Criteria

```bash
# review-soul.md가 soul-manager.py를 참조하는지 확인
grep -q "soul-manager.py" .claude/commands/review-soul.md

# 6단계 워크플로우의 핵심 키워드 존재 확인
grep -q "touch" .claude/commands/review-soul.md
grep -q "stale" .claude/commands/review-soul.md
grep -q "remove" .claude/commands/review-soul.md
grep -q "grace" .claude/commands/review-soul.md

# CLAUDE.md에 id 필드가 포함된 형식 예시가 있는지 확인
grep -q "^id = " CLAUDE.md
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/5-soul-manager/index.json`의 phase 3 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- review-soul.md의 기존 내용을 참고하되, 완전히 새로 작성하라. 기존 3단계 구조를 유지하지 마라.
- 프롬프트가 너무 장황하지 않게 작성하라. AI가 따라야 할 단계와 규칙만 간결하게.
- CLAUDE.md에서 soul 관련 형식 가이드 외의 내용은 수정하지 마라.
- 기존 테스트를 깨뜨리지 마라.

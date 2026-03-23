# Phase 0: 문서 업데이트 (claude.md)

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/architecture.md`
- `/spec/spec.md`
- `/spec/adr.md`

그리고 현재 soul 파일들의 구조를 확인하라:

- `/soul/master.md`
- `/soul/project.md`
- `/soul/soul.md`
- `/claude.md` (soul 관련 지침이 포함되어 있음)

## 작업 내용

`/claude.md` 파일에서 soul 관련 지침을 아래 변경 사항에 맞게 업데이트한다.

### 변경 1: 파일 경로 업데이트

기존:
```
- `/soul/project.md`: 이 프로젝트의 타겟, 문제, 목표 등
- `/soul/master.md`: 사용자의 성향, 핵심 가치, 업무 스타일 등
- `/soul/soul.md`: 사용자가 AI에게 원하는 것, 기대하는 역할, 주요 지침 등
```

변경 후:
```
- `/soul/project/`: 이 프로젝트의 타겟, 문제, 목표 등 (`insights.toml`, `gotchas.toml`)
- `/soul/master/`: 사용자의 성향, 핵심 가치, 업무 스타일 등 (`insights.toml`, `gotchas.toml`)
- `/soul/ai/`: 사용자가 AI에게 원하는 것, 기대하는 역할, 주요 지침 등 (`insights.toml`, `gotchas.toml`)
```

### 변경 2: 포맷 예시 업데이트

기존 마크다운 형식 예시를 TOML 형식으로 교체한다.

기존:
````
```markdown
### Insights

- [날짜] 주요 인사이트 내용 (마지막 사용: 날짜)

### Gotchas

- [날짜] 주요 Gotcha 내용 (마지막 사용: 날짜)
```
````

변경 후:
````
insights.toml / gotchas.toml 각각에 아래 형식의 TOML을 사용합니다:

```toml
[[entries]]
created_at = "2026-03-18"
last_used_at = "2026-03-21"
content = "주요 인사이트 또는 Gotcha 내용"
```
````

### 변경 3: 설명 문구 조정

"다음 형식을 반드시 따르세요" 이하의 문단을 새 구조에 맞게 자연스럽게 다듬어라. 핵심 의미(Insight의 정의, Gotcha의 정의, 간결/명확 원칙, 날짜 포함)는 그대로 유지해야 한다.

## Acceptance Criteria

```bash
# claude.md에 기존 마크다운 형식 예시가 남아있지 않아야 함
! grep -q '### Insights' claude.md
! grep -q '### Gotchas' claude.md
! grep -q 'soul/soul.md' claude.md

# 새 경로가 반영되어 있어야 함
grep -q 'soul/project/' claude.md
grep -q 'soul/master/' claude.md
grep -q 'soul/ai/' claude.md

# TOML 형식 예시가 포함되어 있어야 함
grep -q '\[\[entries\]\]' claude.md
grep -q 'created_at' claude.md
grep -q 'last_used_at' claude.md
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/3-soul-toml/index.json`의 phase 0 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `claude.md`의 "Who You Are" 섹션 이하는 절대 수정하지 마라. soul 관련 지침 부분만 수정한다.
- 새로운 내용을 추가하지 마라. 기존 지침을 새 구조/포맷에 맞게 업데이트만 해라.
- soul 파일 자체(`.md` 파일들)는 이 phase에서 건드리지 마라. Phase 1에서 마이그레이션한다.

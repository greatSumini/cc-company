# Phase 3: 테스트 및 스크립트

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/testing.md`
- `/tasks/11-rename/spec-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- Phase 2에서 수정된 소스코드 (src/)

## 작업 내용

테스트 파일(tests/)과 스크립트(scripts/)의 `cc-company` 문자열을 변경한다.

### 변경 규칙

| 패턴 | 변경 후 |
|------|--------|
| `cc-company` | `agentinc` |
| `.cc-company` | `.agentinc` |
| `cc-company-test-` (임시 디렉토리 prefix) | `agentinc-test-` |

### 수정 대상 파일

#### tests/ 디렉토리
- `tests/store/fs-store.test.ts`
  - 임시 디렉토리명: `cc-company-test-` → `agentinc-test-`
  - 경로 참조: `.cc-company/subagents/` 등
- `tests/store/fs-ticket-store.test.ts`
  - 경로: `.cc-company/tickets`
- `tests/store/agent-status-store.test.ts`
  - 경로: `.cc-company/status`

#### scripts/ 디렉토리
- `scripts/run-phases.py`
  - 기본값: `project_name = index.get("project", "cc-company")` → `"agentinc"`
  - 주석
- `scripts/_utils.py`
  - 주석: "Shared utilities for cc-company scripts"
- `scripts/release.py`
  - 주석: "cc-company release script"
- `scripts/README.md`
  - 프로젝트명 언급

### 작업 방법

1. `grep -rn "cc-company\|\.cc-company" tests/ scripts/` 로 모든 위치 확인
2. 각 파일에서 변경 규칙에 따라 치환

## Acceptance Criteria

```bash
# 모든 테스트 통과
npm test

# 테스트/스크립트에 cc-company 문자열이 없어야 함
grep -r "cc-company\|\.cc-company" tests/ scripts/ && echo "FAIL" || echo "PASS"
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모든 테스트가 통과하고 grep 결과가 "PASS"면 `/tasks/11-rename/index.json`의 phase 3 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하라.

## 주의사항

- 테스트의 assertion 로직은 변경하지 마라. 경로/이름 문자열만 변경.
- scripts/run-phases.py의 로직은 변경하지 마라. 문자열만 변경.
- 기존 테스트가 모두 통과해야 한다.

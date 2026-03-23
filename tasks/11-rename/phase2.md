# Phase 2: 소스코드 변경

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/spec.md`
- `/spec/architecture.md`
- `/tasks/11-rename/spec-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- Phase 0: 문서 파일들
- Phase 1: package.json, .gitignore 등

## 작업 내용

소스코드(src/)의 모든 `cc-company`, `.cc-company` 문자열을 변경한다.

### 변경 규칙

| 패턴 | 변경 후 |
|------|--------|
| `cc-company` (CLI 명령어, 에러 메시지) | `agentinc` |
| `.cc-company` (디렉토리 경로) | `.agentinc` |
| `ccCompanyPath` (변수명) | `agentincPath` |

### 수정 대상 파일

#### CLI 정의
- `src/index.ts:16` — `.name('cc-company')` → `.name('agentinc')`

#### 경로 하드코딩
- `src/commands/context.ts:19,25` — `.cc-company` 경로
- `src/commands/init.ts:12,18` — 옵션 설명, 에러 메시지
- `src/commands/webhook.ts:14,43,65,84,109` — 경로
- `src/store/agent-status-store.ts:20` — 경로
- `src/store/fs-ticket-store.ts:30` — 경로
- `src/services/orchestrator.service.ts:50,211` — 경로, 변수명
- `src/agent-worker.ts:19,20` — 경로, 변수명

#### 에러/로그 메시지
- `src/commands/init.ts:74` — "cc-company가 초기화되었습니다"
- `src/commands/context.ts:25` — "cc-company가 초기화되지 않았습니다"
- `src/commands/ticket.ts:59,114,183,235` — "Run `cc-company start` first"
- `src/commands/webhook.ts:36,50` — 사용자 메시지
- `src/services/run.service.ts:20` — 에러 메시지

#### 주석 (CLI 예시)
- `src/commands/agent.ts` — 6곳
- `src/commands/subagent.ts` — 3곳
- `src/commands/skill.ts` — 7곳
- `src/commands/hook.ts` — 3곳
- `src/commands/ticket.ts` — 4곳
- `src/commands/run.ts` — 1곳
- `src/webhook-receiver/sse-receiver.ts` — 1곳

### 작업 방법

1. `grep -rn "cc-company\|\.cc-company\|ccCompany" src/` 로 모든 위치 확인
2. 각 파일에서 변경 규칙에 따라 치환
3. 변수명 `ccCompanyPath`는 `agentincPath`로 변경

## Acceptance Criteria

```bash
# 빌드 성공
npm run build

# 테스트 통과 (일부 테스트는 아직 경로가 안 맞아 실패할 수 있음)
npm test || true

# 소스코드에 cc-company 문자열이 없어야 함
grep -r "cc-company\|\.cc-company\|ccCompany" src/ && echo "FAIL" || echo "PASS"
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 빌드 성공하고 grep 결과가 "PASS"면 `/tasks/11-rename/index.json`의 phase 2 status를 `"completed"`로 변경하라.
테스트 실패는 Phase 3에서 수정하므로 이 phase에서는 무시해도 된다.
수정 3회 이상 시도해도 빌드/grep이 실패하면 status를 `"error"`로 변경하라.

## 주의사항

- **테스트 파일(tests/)은 이 phase에서 수정하지 마라.** Phase 3에서 처리한다.
- 변수명 변경 시 일관성 유지: `ccCompanyPath` → `agentincPath`
- 주석의 CLI 예시도 빠뜨리지 말고 변경하라.

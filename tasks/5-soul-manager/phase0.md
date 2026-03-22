# Phase 0: ADR 추가

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/adr.md`

## 작업 내용

`/docs/adr.md` 파일 맨 아래에 다음 ADR을 추가하라:

### ADR-013: Soul entry 식별 방식 — 파일별 auto-increment 정수 ID

- **상태**: 확정 (2026-03-22)
- **맥락**: soul TOML 파일(`/soul/` 하위)의 `[[entries]]` 항목을 스크립트로 조작할 때, 개별 항목을 안정적으로 참조할 방법이 필요. 선택지: (1) 배열 인덱스 기반, (2) 파일별 auto-increment 정수 ID, (3) UUID/해시.
- **결정**: 파일별 auto-increment 정수 ID (`id` 필드)
- **근거**:
  - 인덱스 기반은 삭제 시 뒤 항목의 인덱스가 밀려 배치 처리에서 불안정
  - 정수 ID는 삭제 후에도 기존 항목의 ID가 변하지 않아 안정적 참조 가능
  - UUID/해시는 이 규모에서 과잉. 파일 내 유니크면 충분
  - 새 항목 추가 시 `max(id) + 1`로 부여. AI가 파일을 읽고 직접 할당

기존 ADR들의 형식(상태/맥락/결정/근거)을 정확히 따르되, `---` 구분선으로 이전 ADR과 분리하라.

## Acceptance Criteria

```bash
grep -q "ADR-013" docs/adr.md
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 통과하면 `/tasks/5-soul-manager/index.json`의 phase 0 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 기존 ADR(001~012)의 내용을 수정하지 마라.
- ADR 번호가 012 다음인 013인지 확인하라. 만약 012가 아닌 다른 번호가 마지막이라면 그 다음 번호를 사용하라.

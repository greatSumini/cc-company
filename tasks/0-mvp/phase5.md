# Phase 5: Logger

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:
- `/spec/spec.md` — 실행 로그 스키마, .cc-company/runs/ 구조
- `/spec/architecture.md` — logger 모듈의 역할
- `/spec/adr.md` — ADR-006 (실행 로그 저장 범위), ADR-008 (동시 실행)

그리고 이전 phase의 작업물을 반드시 확인하라:
- `src/types/index.ts` — RunLog 타입
- `src/services/run.service.ts` — logger 사용 부분 (optional 처리 확인)
- `src/store/fs-store.ts` — saveRunLog 메서드가 이미 있는지 확인

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라. 특히 run.service에서 logger를 어떻게 호출하고 있는지 확인하고, 그 인터페이스에 맞춰라.

## 작업 내용

### src/logger/run-logger.ts

```typescript
export class RunLogger {
  constructor(private runsDir: string) {}

  save(log: RunLog): void
  list(filter?: RunLogFilter): RunLog[]
}
```

#### save

- RunLog를 JSON으로 직렬화하여 `{runsDir}/{timestamp}-{uuid}.json`에 저장
- timestamp 형식: `YYYYMMDD-HHmmss` (파일명 정렬 용이)
- uuid: `crypto.randomUUID()` 사용
- runsDir이 없으면 자동 생성 (`fs.mkdirSync recursive`)

#### list

- runsDir의 모든 JSON 파일을 읽어서 RunLog[] 반환
- 최신순 정렬 (파일명의 timestamp 기준)
- filter가 있으면 agent 이름으로 필터링

### run.service 연동

Phase 4에서 logger를 optional로 처리했을 것이다. 이제 RunLogger를 실제로 연결하라.
run.service의 생성자에 RunLogger를 전달하고, run 완료 후 save를 호출하도록 수정하라.

## Acceptance Criteria

```bash
npm run build    # 컴파일 에러 없음
npm test         # 기존 테스트 모두 통과 (logger 자체는 테스트 없음)
```

## AC 검증 방법

`npm run build && npm test`를 실행하라. 기존 테스트가 깨지지 않으면 성공이다.
성공하면 `/tasks/index.json`의 phase 5 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- logger는 테스트하지 않는다. JSON.stringify + fs.writeFile이 전부다.
- 기존 테스트를 깨뜨리지 마라. run.service 수정 시 기존 테스트 호환성을 확인하라.
- crypto.randomUUID()는 Node.js 19+에서 글로벌로 사용 가능. 또는 `import { randomUUID } from 'node:crypto'` 사용.

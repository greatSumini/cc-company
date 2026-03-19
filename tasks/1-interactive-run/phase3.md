# Phase 3: 통합 검증 (integration-verify)

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/adr.md` — ADR-011
- `/tasks/1-interactive-run/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/types/index.ts` — Phase 1에서 수정됨
- `/src/claude-runner/flag-builder.ts` — Phase 1에서 수정됨
- `/src/commands/run.ts` — Phase 2에서 수정됨
- `/src/services/run.service.ts` — Phase 2에서 수정됨
- `/src/logger/run-logger.ts` — Phase 2에서 수정됨
- `/tests/claude-runner/flag-builder.test.ts` — Phase 1에서 수정됨
- `/tests/services/run.service.test.ts` — Phase 2에서 수정됨

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

### 1. 빌드 + 전체 테스트

```bash
npm run build
npm test
```

빌드 에러나 테스트 실패가 있으면 원인을 분석하고 수정하라.

### 2. dry-run 시나리오 검증

`CC_DRY_RUN=1` 환경변수를 설정한 상태에서 아래 4개 시나리오를 실행하고, 출력에서 flag가 올바르게 구성되었는지 검증하라.

먼저 빌드된 CLI를 직접 실행할 수 있도록 준비:

```bash
npm run build
```

#### 시나리오 A: interactive mode, prompt 없음

```bash
CC_DRY_RUN=1 node dist/index.js run developer
```

**기대 출력**: `[DRY-RUN] claude --append-system-prompt-file .cc-company/agents/developer/prompt.md --agents '...'`
- prompt positional arg가 없어야 함
- `-p` flag가 없어야 함

#### 시나리오 B: interactive mode, prompt 있음

```bash
CC_DRY_RUN=1 node dist/index.js run developer "Fix the bug"
```

**기대 출력**: `[DRY-RUN] claude --append-system-prompt-file ... --agents '...' Fix the bug`
- prompt가 마지막 positional arg로 포함
- `-p` flag가 없어야 함

#### 시나리오 C: print mode

```bash
CC_DRY_RUN=1 node dist/index.js run developer -p "Fix the bug"
```

**기대 출력**: `[DRY-RUN] claude --append-system-prompt-file ... --agents '...' -p Fix the bug`
- `-p` flag가 포함
- prompt가 포함

#### 시나리오 D: print mode, prompt 없음 → 에러

```bash
CC_DRY_RUN=1 node dist/index.js run developer -p
```

**기대**: 에러 메시지 출력 (`Error: prompt is required in print mode (-p)`) 후 exit code 1.

### 3. 검증 결과 기록

4개 시나리오의 실제 출력을 확인하고:
- 모두 기대대로 동작하면 통과.
- 하나라도 틀리면 원인을 분석하여 해당 코드를 수정하라.

수정이 필요한 경우, 수정 대상은 이전 phase에서 작성된 코드 범위 내로 한정:
- `src/commands/run.ts`
- `src/services/run.service.ts`
- `src/logger/run-logger.ts`
- `src/claude-runner/flag-builder.ts`
- `src/types/index.ts`

수정 후 반드시 `npm run build && npm test`를 다시 실행하여 regression이 없는지 확인하라.

## Acceptance Criteria

```bash
npm run build && npm test    # 빌드 + 테스트 통과

# dry-run 시나리오 A: interactive, no prompt
CC_DRY_RUN=1 node dist/index.js run developer 2>&1 | grep -v "prompt" | grep -q "DRY-RUN"

# dry-run 시나리오 B: interactive, with prompt
CC_DRY_RUN=1 node dist/index.js run developer "Fix the bug" 2>&1 | grep -q "Fix the bug"

# dry-run 시나리오 C: print mode
CC_DRY_RUN=1 node dist/index.js run developer -p "Fix the bug" 2>&1 | grep -q "\-p"

# dry-run 시나리오 D: print mode, no prompt → error
CC_DRY_RUN=1 node dist/index.js run developer -p 2>&1 | grep -qi "error\|required"
```

## AC 검증 방법

위 AC 커맨드를 모두 실행하라. 모두 통과하면 `/tasks/1-interactive-run/index.json`의 phase 3 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 이 phase는 통합 검증이 주 목적이다. 새로운 기능을 추가하지 마라.
- dry-run 시나리오에서 `.cc-company/` 디렉토리가 존재해야 한다. 없으면 `node dist/index.js init`으로 먼저 초기화하라.
- 시나리오 A에서 `[DRY-RUN]` 출력의 마지막 인자가 prompt 문자열이 아닌지 확인하라. `--agents '{...}'` JSON이 마지막이거나 다른 flag가 마지막이어야 한다.
- 기존 테스트를 삭제하지 마라.

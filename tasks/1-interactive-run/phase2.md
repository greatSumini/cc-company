# Phase 2: run command + RunService + RunLogger (run-command-service-logger)

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/docs/adr.md` — 특히 ADR-003 (패스스루 전략), ADR-011 (이번 task)
- `/tasks/1-interactive-run/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물과 기존 코드를 반드시 확인하라:

- `/src/types/index.ts` — Phase 1에서 수정됨. `FlagBuilderInput.prompt`가 optional, `RunLog`에 `mode` 추가, `RunLogger` 시그니처 변경 확인.
- `/src/claude-runner/flag-builder.ts` — Phase 1에서 수정됨. prompt undefined 시 positional arg 생략 확인.
- `/src/commands/run.ts` — 현재 run command 구현 (수정 대상)
- `/src/services/run.service.ts` — 현재 RunService 구현 (수정 대상)
- `/src/logger/run-logger.ts` — 현재 RunLogger 구현 (수정 대상)
- `/src/claude-runner/spawner.ts` — spawnClaude 인터페이스 확인
- `/tests/services/run.service.test.ts` — 현재 RunService 테스트 (수정 대상)

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

### 1. `src/commands/run.ts` — run command 수정

#### 커맨드 시그니처 변경

현재:
```typescript
.argument('<agent>', 'Agent name')
.argument('<prompt>', 'Prompt to send to the agent')
```

변경 후:
```typescript
.argument('<agent>', 'Agent name')
.argument('[prompt]', 'Prompt to send to the agent (required in print mode)')
.option('-p, --print', 'Run in print (headless) mode')
```

#### 인자 파싱 로직 전면 교체

현재 코드는 `process.argv`에서 positional 2개를 건너뛰고 나머지를 passthrough로 수집한다. 이 로직을 아래와 같이 변경:

1. commander가 파싱한 `agent` (필수)와 `prompt` (optional)를 사용한다.
2. `-p` / `--print` option은 commander가 파싱한다.
3. passthrough flags 추출: `process.argv`에서 `run` 이후의 인자들 중, agent와 prompt(있다면)을 제외하고 `-p`/`--print`도 제외한 나머지를 passthrough로 수집한다.

**핵심 파싱 규칙**:
- `-`로 시작하지 않는 첫 번째 인자 = agent name
- `-`로 시작하지 않는 두 번째 인자 = prompt (없으면 undefined)
- `-p` / `--print` = cc-company가 인식. passthrough에는 포함시키되 (`-p`로), commander option으로도 감지.

**주의**: `-p`는 cc-company가 인식하면서 동시에 Claude Code CLI에도 전달해야 한다. 따라서 passthrough flags에 `-p`를 포함시켜야 한다. commander의 `.option('-p, --print')`로 파싱하면 commander가 알아서 인식하지만, passthrough에는 자동 포함되지 않으므로, print mode가 감지되면 passthroughFlags에 `-p`를 수동으로 추가하라.

#### Validation

```typescript
// print mode에서 prompt 필수 검증
if (printMode && !prompt) {
  console.error('Error: prompt is required in print mode (-p)')
  process.exit(1)
}
```

#### mode 결정

```typescript
const mode: 'interactive' | 'print' = printMode ? 'print' : 'interactive'
```

#### service 호출 변경

```typescript
const result = ctx.runService.run(agent, prompt ?? null, mode, passthroughFlags)
```

### 2. `src/services/run.service.ts` — RunService 수정

#### `run()` 메서드 시그니처 변경

현재:
```typescript
run(agentName: string, prompt: string, passthroughFlags: string[]): SpawnResult
```

변경 후:
```typescript
run(agentName: string, prompt: string | null, mode: 'interactive' | 'print', passthroughFlags: string[]): SpawnResult
```

#### startedAt / finishedAt 분리

현재 `RunLogger.log()` 내부에서 `new Date()`로 두 값을 동일하게 찍는다. 이를 RunService에서 관리하도록 변경:

```typescript
run(agentName: string, prompt: string | null, mode: 'interactive' | 'print', passthroughFlags: string[]): SpawnResult {
  // ... 기존 로직 (agent 로드, resolve, flag 빌드) ...

  const startedAt = new Date()
  const result = spawnClaude(flags)
  const finishedAt = new Date()

  if (this.logger) {
    this.logger.log(agentName, prompt, mode, flags, result, startedAt, finishedAt)
  }

  return result
}
```

#### prompt를 buildFlags에 전달할 때

```typescript
const flags = buildFlags({
  agent,
  promptFilePath,
  subagents,
  settingsFilePath,
  mcpConfigFilePath,
  pluginDirPath,
  prompt: prompt ?? undefined,  // null → undefined 변환 (FlagBuilderInput은 string | undefined)
  passthroughFlags,
})
```

### 3. `src/logger/run-logger.ts` — RunLogger 수정

#### `log()` 메서드 시그니처 변경

현재:
```typescript
log(agent: string, prompt: string, flags: string[], result: {...}): void
```

변경 후:
```typescript
log(
  agent: string,
  prompt: string | null,
  mode: 'interactive' | 'print',
  flags: string[],
  result: { exitCode: number; stdout: string; stderr: string },
  startedAt: Date,
  finishedAt: Date
): void
```

#### RunLog 생성 로직 변경

```typescript
const log: RunLog = {
  id: randomUUID(),
  agent,
  prompt,           // string | null 그대로
  mode,             // 새 필드
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  exitCode: result.exitCode,
  flags,
  stdout: result.stdout,
  stderr: result.stderr,
}
```

기존에 `log()` 내부에서 `new Date()`로 찍던 로직을 제거하고, 외부에서 받은 `startedAt`, `finishedAt`을 사용한다.

#### `RunLogger` 인터페이스도 동기화

`src/types/index.ts`의 `RunLogger` 인터페이스가 Phase 1에서 이미 변경되었을 것이다. 하지만 `startedAt`, `finishedAt` 파라미터는 Phase 1에서 추가하지 않았으므로, 여기서 인터페이스도 함께 업데이트하라:

```typescript
interface RunLogger {
  log(
    agent: string,
    prompt: string | null,
    mode: 'interactive' | 'print',
    flags: string[],
    result: { exitCode: number; stdout: string; stderr: string },
    startedAt: Date,
    finishedAt: Date
  ): void
}
```

### 4. 테스트 수정

#### `tests/services/run.service.test.ts`

기존 테스트에서 `runService.run(agent, prompt, flags)` 호출을 `runService.run(agent, prompt, 'print', flags)` 형태로 mode 인자를 추가하라. 기존 테스트는 모두 prompt가 있는 print mode에 해당한다.

새 테스트 추가:

```typescript
it('prompt 없이 interactive mode로 실행', () => {
  store.createAgent({ name: 'developer', description: '개발자' })

  const result = runService.run('developer', null, 'interactive', [])

  expect(result.exitCode).toBe(0)
})

it('interactive mode + prompt로 실행', () => {
  store.createAgent({ name: 'developer', description: '개발자' })

  const result = runService.run('developer', '버그 고쳐줘', 'interactive', [])

  expect(result.exitCode).toBe(0)
})

it('logger에 mode가 전달되는지 확인', () => {
  store.createAgent({ name: 'developer', description: '개발자' })

  const mockLogger: RunLogger = {
    log: vi.fn(),
  }

  const runServiceWithLogger = new RunService(store, tmpDir, mockLogger)
  runServiceWithLogger.run('developer', null, 'interactive', [])

  expect(mockLogger.log).toHaveBeenCalledWith(
    'developer',
    null,
    'interactive',
    expect.any(Array),
    expect.objectContaining({ exitCode: 0 }),
    expect.any(Date),
    expect.any(Date)
  )
})
```

기존 logger 테스트도 새 시그니처에 맞게 수정:

```typescript
// 기존: expect(mockLogger.log).toHaveBeenCalledWith('developer', '버그 고쳐줘', expect.arrayContaining([...]), ...)
// 변경: mode + startedAt/finishedAt 파라미터 추가
expect(mockLogger.log).toHaveBeenCalledWith(
  'developer',
  '버그 고쳐줘',
  'print',
  expect.arrayContaining(['--append-system-prompt-file']),
  expect.objectContaining({ exitCode: 0 }),
  expect.any(Date),
  expect.any(Date)
)
```

## Acceptance Criteria

```bash
npm run build    # 컴파일 에러 없음
npm test         # 모든 테스트 통과 (기존 수정 + 새 테스트)
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/1-interactive-run/index.json`의 phase 2 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `flag-builder.ts`는 Phase 1에서 이미 수정 완료되었다. 이 phase에서 다시 건드리지 마라.
- commander의 `.option('-p, --print')` 등록 시, `-p`가 commander에 의해 소비되어 passthrough에서 사라지지 않도록 주의하라. commander가 인식한 `-p`를 별도로 passthroughFlags에 추가해야 한다.
- `spawner.ts`는 수정하지 마라. `stdio: 'inherit'`은 interactive TUI에 이미 적합하다.
- 기존 테스트를 삭제하지 마라. 시그니처 변경에 맞게 수정만 하라.
- `run.ts`의 인자 파서 교체 시, `process.argv` 기반 수동 파싱의 복잡도를 최소화하라. `-`로 시작하지 않는 인자의 순서만 추적하면 된다.

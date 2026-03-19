# Phase 1: 타입 정의 + flag-builder (types-and-flag-builder)

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/docs/adr.md` — 특히 ADR-011 (이번 task에서 추가됨)
- `/tasks/1-interactive-run/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물과 기존 코드를 반드시 확인하라:

- `/src/types/index.ts` — 현재 타입 정의
- `/src/claude-runner/flag-builder.ts` — 현재 flag 빌드 로직
- `/tests/claude-runner/flag-builder.test.ts` — 현재 flag-builder 테스트

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

### 1. `src/types/index.ts` 타입 변경

#### `FlagBuilderInput` 인터페이스:

```typescript
interface FlagBuilderInput {
  // ... 기존 필드 유지
  prompt?: string          // 변경: string → string | undefined (optional)
  // ... 기존 필드 유지
}
```

`prompt` 필드를 optional로 변경한다. 기존에는 `prompt: string`으로 필수였다.

#### `RunLog` 인터페이스:

```typescript
interface RunLog {
  id: string
  agent: string
  prompt: string | null    // 변경: string → string | null
  mode: 'interactive' | 'print'  // 추가
  startedAt: string
  finishedAt: string
  exitCode: number
  flags: string[]
  stdout: string
  stderr: string
}
```

- `prompt`: `string` → `string | null`. interactive mode에서 prompt 없이 시작한 경우 `null`.
- `mode`: 새 필드. `'interactive'` 또는 `'print'`.

#### `RunLogger` 인터페이스:

```typescript
interface RunLogger {
  log(
    agent: string,
    prompt: string | null,
    mode: 'interactive' | 'print',
    flags: string[],
    result: { exitCode: number; stdout: string; stderr: string }
  ): void
}
```

- `prompt` 파라미터: `string` → `string | null`
- `mode` 파라미터 추가 (두 번째 파라미터 `prompt` 다음에 위치)

### 2. `src/claude-runner/flag-builder.ts` 수정

`buildFlags()` 함수에서 prompt가 undefined이면 마지막 positional arg를 생략한다.

현재 코드 (49행 부근):
```typescript
// prompt (마지막)
flags.push(input.prompt)
```

변경 후:
```typescript
// prompt (마지막) — interactive mode에서는 prompt 없이 실행
if (input.prompt) {
  flags.push(input.prompt)
}
```

이것이 이 파일의 유일한 변경이다. 다른 로직은 건드리지 마라.

### 3. `tests/claude-runner/flag-builder.test.ts` 테스트 수정 및 추가

#### 기존 테스트 수정

`FlagBuilderInput`의 `prompt`가 optional이 되었으므로 기존 테스트의 타입 호환성을 확인하라. 기존 테스트에서 `prompt: 'some string'`으로 넘기는 부분은 그대로 유효하다 (string은 string | undefined의 부분 타입). **기존 테스트는 수정하지 마라.**

#### 새 테스트 추가

`[프롬프트]` describe 블록 안에 아래 테스트를 추가:

```typescript
it('prompt가 undefined이면 플래그 배열에 prompt가 포함되지 않음', () => {
  const input: FlagBuilderInput = {
    agent: baseAgent,
    promptFilePath: '/path/to/prompt.md',
    prompt: undefined,
    passthroughFlags: [],
  }

  const flags = buildFlags(input)

  expect(flags).toEqual([
    '--append-system-prompt-file',
    '/path/to/prompt.md',
  ])
})

it('prompt가 undefined이고 passthrough flags가 있으면 flags만 포함', () => {
  const input: FlagBuilderInput = {
    agent: baseAgent,
    promptFilePath: '/path/to/prompt.md',
    prompt: undefined,
    passthroughFlags: ['--model', 'opus'],
  }

  const flags = buildFlags(input)

  expect(flags).toEqual([
    '--append-system-prompt-file',
    '/path/to/prompt.md',
    '--model',
    'opus',
  ])
})
```

`[엣지 케이스]` describe 블록 안에도 추가:

```typescript
it('prompt undefined + subagents + settings → prompt 없이 정상 빌드', () => {
  const subagents: SubagentConfig[] = [
    { name: 'git-expert', description: 'Git 전문가', prompt: 'You are a git expert.' },
  ]

  const input: FlagBuilderInput = {
    agent: { ...baseAgent, subagents: ['git-expert'] },
    promptFilePath: '/path/to/prompt.md',
    subagents,
    settingsFilePath: '/path/to/settings.json',
    prompt: undefined,
    passthroughFlags: [],
  }

  const flags = buildFlags(input)

  expect(flags).toContain('--append-system-prompt-file')
  expect(flags).toContain('--agents')
  expect(flags).toContain('--settings')
  // prompt가 마지막에 없어야 함
  expect(flags[flags.length - 1]).toBe('/path/to/settings.json')
})
```

## Acceptance Criteria

```bash
npm run build    # 컴파일 에러 없음
npm test         # 모든 테스트 통과 (기존 + 새로 추가된 테스트)
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/1-interactive-run/index.json`의 phase 1 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `src/commands/run.ts`, `src/services/run.service.ts`, `src/logger/run-logger.ts`는 이 phase에서 수정하지 마라. Phase 2에서 다룬다.
- 타입 변경으로 인해 `run.service.ts`와 `run-logger.ts`에서 컴파일 에러가 발생할 수 있다. 이 phase에서는 **타입 정의와 flag-builder만 수정**하므로, 컴파일 에러를 해결하기 위해 해당 파일들의 함수 시그니처를 최소한으로만 맞춰라. 구체적으로:
  - `run.service.ts`의 `this.logger.log()` 호출부에서 `mode` 인자가 빠져 컴파일 에러가 날 수 있다. 이 경우 `this.logger.log(agentName, prompt, 'print', flags, result)` 형태로 임시 맞춤하라. Phase 2에서 올바른 mode 로직으로 교체한다.
  - `run-logger.ts`의 `log()` 메서드 시그니처도 새 인터페이스에 맞게 `mode` 파라미터를 추가하라. 단, 내부 로직은 Phase 2에서 수정한다.
- 기존 테스트를 삭제하거나 변경하지 마라. 새 테스트만 추가하라.
- `[패스스루]` describe 블록의 '패스스루에 -p 포함 시 정상 전달' 테스트는 그대로 유지하라. -p가 passthrough로 전달되는 것 자체는 여전히 유효한 동작이다 (cc-company가 인식하면서 동시에 전달).

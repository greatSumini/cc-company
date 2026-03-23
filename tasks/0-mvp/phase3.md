# Phase 3: Claude Runner

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:
- `/spec/spec.md` — Claude Code 플래그 매핑 테이블
- `/spec/architecture.md` — claude-runner 모듈의 역할, 데이터 흐름
- `/spec/adr.md` — ADR-001 (child_process spawn), ADR-003 (플래그 패스스루)
- `/spec/testing.md` — 테스트 전략
- `/spec/test-cases.md` — flag-builder 테스트 케이스

그리고 이전 phase의 작업물을 반드시 확인하라:
- `src/types/index.ts` — AgentConfig, SubagentConfig 등
- `src/store/store.ts` — IStore 인터페이스 (runner가 store를 직접 사용하지는 않지만, 데이터 흐름을 이해하기 위해)

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

### 1. src/claude-runner/flag-builder.ts

AgentConfig + resolve된 리소스들 + 패스스루 플래그 → claude CLI 플래그 배열을 생성한다.

#### 입력

```typescript
interface FlagBuilderInput {
  agent: AgentConfig
  promptFilePath: string          // agent의 prompt.md 절대 경로
  subagents?: SubagentConfig[]    // resolve된 subagent 설정들
  settingsFilePath?: string       // settings.json 절대 경로 (존재할 때만)
  mcpConfigFilePath?: string      // mcp.json 절대 경로 (존재할 때만)
  pluginDirPath?: string          // plugins 디렉토리 절대 경로 (존재할 때만)
  prompt: string                  // 사용자가 입력한 프롬프트
  passthroughFlags: string[]      // claude CLI에 그대로 넘길 플래그
}
```

이 입력 타입은 `src/types/index.ts`에 추가하라.

#### 출력

`string[]` — claude CLI에 전달할 인자 배열.

#### 변환 규칙

| 입력 | 출력 플래그 |
|---|---|
| promptFilePath | `--append-system-prompt-file <path>` |
| subagents | `--agents '<JSON>'` |
| settingsFilePath | `--settings <path>` |
| mcpConfigFilePath | `--mcp-config <path>` |
| pluginDirPath | `--plugin-dir <path>` |
| passthroughFlags | 그대로 추가 |
| prompt | 배열 마지막에 추가 |

- subagents JSON 형식: `{"name":{"description":"...","prompt":"..."}}`
- optional 필드가 undefined이면 해당 플래그 생략
- 빈 배열(`[]`)인 경우도 플래그 생략

#### 함수 시그니처

```typescript
export function buildFlags(input: FlagBuilderInput): string[]
```

순수 함수다. 외부 의존성(fs, child_process) 없어야 한다.

### 2. src/claude-runner/spawner.ts

claude CLI를 child_process.spawn으로 실행한다.

```typescript
export interface SpawnResult {
  exitCode: number
  stdout: string
  stderr: string
}

export function spawnClaude(flags: string[]): SpawnResult
```

구현 시 고려사항:
- `child_process.spawnSync`를 사용한다. CLI 도구에서 async spawn은 불필요하다.
- stdout/stderr를 사용자 터미널에 실시간 파이프하면서, 동시에 버퍼에 수집한다.
- 실시간 파이프: `stdio: ['inherit', 'pipe', 'pipe']` + stdout/stderr 이벤트로 process.stdout/stderr에 write.
- spawnSync 사용 시 실시간 출력이 안 되므로, `child_process.spawn` (async)를 쓰되 동기적으로 대기하는 패턴을 사용하라. 또는 `spawnSync`의 `stdio: 'inherit'`를 쓰고 stdout/stderr 수집은 포기하는 방법도 있다.
- **dry-run 모드**: 환경변수 `CC_DRY_RUN=1`이면 실제 spawn 없이 최종 명령어를 stdout에 출력하고 exitCode 0을 반환한다.

### 3. 테스트 작성

`tests/claude-runner/flag-builder.test.ts`

`/spec/test-cases.md`의 flag-builder 섹션에 정의된 케이스를 구현하라:

```
[기본]
✓ prompt.md만 있는 agent → --append-system-prompt-file만 생성
✓ 모든 설정이 있는 agent → 전체 플래그 생성
✓ 설정이 하나도 없는 agent → 빈 플래그 배열 + prompt만

[개별 플래그 매핑]
✓ subagents 1개 → --agents JSON에 1개 포함
✓ subagents 여러개 → --agents JSON에 전부 포함
✓ mcp.json 존재 → --mcp-config 경로 포함
✓ settings.json 존재 → --settings 경로 포함
✓ plugins 디렉토리 존재 → --plugin-dir 경로 포함

[패스스루]
✓ 패스스루 플래그가 그대로 뒤에 붙는지
✓ 패스스루에 -p 포함 시 정상 전달
✓ 패스스루 없을 때 빈 배열

[프롬프트]
✓ prompt 문자열이 플래그 배열 마지막에 위치하는지
✓ prompt에 특수문자/공백 포함 시 이스케이프 정상 처리

[엣지 케이스]
✓ subagents 배열이 빈 배열 → --agents 플래그 생략
✓ optional 필드 전부 undefined → 에러 없이 최소 플래그만 생성
```

spawner는 테스트하지 않는다.

## Acceptance Criteria

```bash
npm run build    # 컴파일 에러 없음
npm test         # flag-builder 테스트 + 기존 store 테스트 모두 통과
```

## AC 검증 방법

`npm run build && npm test`를 실행하라. 모두 성공하면 `/tasks/index.json`의 phase 3 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- flag-builder는 **순수 함수**다. fs나 child_process를 import하면 안 된다.
- spawner의 실시간 출력 + 수집 동시 처리가 까다로울 수 있다. spawnSync의 한계를 인지하고, 현실적인 구현을 선택하라.
- prompt 문자열에 대한 이스케이프는 child_process.spawn이 알아서 처리하므로 (shell: false가 기본), 별도 이스케이프 로직은 불필요하다.

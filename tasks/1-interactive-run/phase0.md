# Phase 0: 문서 업데이트 (docs-update)

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/spec.md`
- `/spec/architecture.md`
- `/spec/adr.md`

그리고 현재 구현된 코드도 확인하라:

- `/src/commands/run.ts` — 현재 run command 구현
- `/src/claude-runner/flag-builder.ts` — 현재 flag 빌드 로직
- `/src/services/run.service.ts` — 현재 RunService 구현
- `/src/types/index.ts` — 현재 타입 정의

## 작업 내용

이번 task(`interactive-run`)에서 구현할 변경사항을 문서에 반영한다. 변경 요지는 다음과 같다:

### 변경 배경

현재 `cc-company run` 커맨드는 `<agent>`, `<prompt>` 두 개의 필수 positional 인자를 받는다. 하지만 prompt 없이 `cc-company run developer`만 입력하면 Claude Code의 interactive TUI가 뜨도록 하고 싶다. 또한 `-p` flag를 cc-company의 first-class option으로 등록하여 print mode와 interactive mode를 명확히 구분한다.

### 1. `docs/spec.md` 수정

#### "Agent 실행" 섹션을 아래와 같이 변경:

```bash
cc-company run <agent-name>                                    # interactive TUI
cc-company run <agent-name> <prompt>                           # interactive + 초기 prompt
cc-company run <agent-name> -p <prompt>                        # print mode (headless)
cc-company run <agent-name> -p <prompt> --output-format json   # print mode + JSON 출력
```

#### 설명 부분을 아래와 같이 변경:

- 포지셔널 인자: `<agent-name>` 필수, `[prompt]` 선택
- `-p` (print mode): cc-company가 인식하는 first-class option. Claude Code CLI에도 동시에 전달된다. `-p` 사용 시 `<prompt>`는 필수.
- `-p` 없이 실행하면 Claude Code의 interactive TUI가 터미널에 표시된다.
- `-p`, `<prompt>` 외의 나머지 플래그는 전부 Claude Code CLI에 패스스루.
- stdout/stderr는 그대로 사용자에게 파이프 (`stdio: 'inherit'`).

#### 실행 로그 스키마 섹션에 `mode` 필드 추가, `prompt`를 nullable로:

```json
{
  "id": "uuid",
  "agent": "developer",
  "prompt": "버그 고쳐줘",
  "mode": "interactive",
  "startedAt": "2026-03-19T10:00:00Z",
  "finishedAt": "2026-03-19T10:05:00Z",
  "exitCode": 0,
  "flags": ["--model", "opus"],
  "stdout": "",
  "stderr": ""
}
```

- `mode`: `"interactive"` 또는 `"print"`. `-p` flag 유무로 결정.
- `prompt`: interactive mode에서 prompt 없이 시작한 경우 `null`.

### 2. `docs/architecture.md` 수정

#### "데이터 흐름" 섹션의 예시를 2가지로 확장:

**interactive mode 예시** 추가:
```
cc-company run developer
```
→ prompt 없이 TUI 진입. flag-builder가 prompt positional arg를 생략.

**기존 예시** 유지하되 설명 보강:
- 1단계(commands/run.ts): 포지셔널 추출 시 prompt가 optional임을 명시
- `-p`를 cc-company가 인식하여 mode를 결정하고, passthrough에도 포함시킴

#### Claude Code 플래그 매핑 관련 (`flag-builder.ts` 설명):

> AgentConfig + SubagentConfig[] → claude CLI 플래그 배열

이 부분에서 prompt가 undefined이면 마지막 positional arg가 생략됨을 명시.

### 3. `docs/adr.md`에 ADR-011 추가

파일 맨 끝에 아래 ADR을 추가:

```markdown
## ADR-011: run command의 prompt optional화 및 -p first-class option 등록

**상태**: 확정 (2026-03-19)

**맥락**: 현재 run command는 `<agent>` `<prompt>` 두 개의 필수 인자를 받으며, `-p`는 passthrough flag로 처리된다. 사용자가 prompt 없이 interactive TUI를 시작하고 싶은 니즈가 있고, cc-company가 `-p` 여부를 인식해야 mode별 로직(로깅 전략, prompt 필수 여부 validation 등)을 분기할 수 있다.

**결정**:
1. `<prompt>`를 optional (`[prompt]`)로 변경. `-`로 시작하지 않는 첫 번째 인자를 prompt로 취급.
2. `-p`를 cc-company의 first-class option으로 등록. commander `.option('-p, --print')`로 파싱하되, 동시에 Claude Code CLI에도 전달.
3. `-p` 없이 실행하면 interactive TUI 모드, `-p`로 실행하면 print (headless) 모드.
4. `-p` 사용 시 prompt는 필수. 없으면 에러.
5. RunLog에 `mode` 필드 추가, `prompt`는 nullable.
6. `startedAt`은 spawn 직전, `finishedAt`은 spawn 완료 후 기록 (interactive 세션의 실제 소요 시간 반영).

**근거**:
- ADR-003에서 "패스스루 전략"을 확정했지만, `-p`는 cc-company 자체의 동작 분기에 필요한 유일한 flag. 패스스루 원칙을 깨는 것이 아니라, "인식 + 전달"의 하이브리드 접근.
- interactive mode는 Claude Code의 핵심 UX. 이를 지원하지 않으면 cc-company의 가치가 print mode에만 한정됨.
- prompt optional화로 `cc-company run developer`라는 최소 입력으로 agent를 실행할 수 있어 DX 향상.
```

### 4. `tasks/1-interactive-run/spec-diff.md` 생성

위 세 문서의 변경 내용을 요약한 `spec-diff.md`를 생성하라. 형식:

```markdown
# docs-diff: interactive-run

## 변경된 문서 목록

### `docs/spec.md`
- 변경 요약: ...
- 핵심 변경점:
  - ...

### `docs/architecture.md`
- 변경 요약: ...
- 핵심 변경점:
  - ...

### `docs/adr.md`
- 변경 요약: ...
- 핵심 변경점:
  - ...
```

실제 변경한 내용을 기반으로 구체적인 diff를 기술하라. 이후 구현 phase들이 이 파일을 참조하여 시스템 변경점을 파악한다.

## Acceptance Criteria

```bash
# 문서 파일들이 정상적으로 존재하고, 마크다운 문법 오류 없음
cat docs/spec.md docs/architecture.md docs/adr.md tasks/1-interactive-run/spec-diff.md > /dev/null
echo $?  # 0이어야 함
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/1-interactive-run/index.json`의 phase 0 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 코드를 수정하지 마라. 이 phase는 문서만 수정한다.
- 기존 문서의 다른 섹션을 삭제하거나 변경하지 마라. 추가/수정 대상 섹션만 건드려라.
- ADR-011의 번호와 형식을 기존 ADR들과 동일하게 맞춰라.
- `spec-diff.md`는 `/tasks/1-interactive-run/` 디렉토리에 생성하라.

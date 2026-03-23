# spec-diff: interactive-run

## 변경된 문서 목록

### `docs/spec.md`
- 변경 요약: Agent 실행 섹션의 CLI 사용법을 interactive/print mode 구분으로 재정의하고, 실행 로그 스키마에 `mode` 필드 추가
- 핵심 변경점:
  - `<prompt>`를 optional로 변경 (`[prompt]`)
  - `-p` flag를 cc-company의 first-class option으로 명시
  - 실행 예시 4가지로 확장: interactive TUI, interactive + prompt, print mode, print mode + JSON
  - 실행 로그 스키마에 `mode` 필드 추가 (`"interactive"` | `"print"`)
  - `prompt` 필드의 nullable 여부 명시 (interactive mode에서 prompt 없이 시작 시 `null`)

### `docs/architecture.md`
- 변경 요약: 데이터 흐름 섹션을 interactive mode와 print mode 두 가지 예시로 확장
- 핵심 변경점:
  - Interactive Mode 예시 추가: `cc-company run developer` (prompt 없이 TUI 진입)
  - 1단계(commands/run.ts): prompt가 optional임을 명시, mode 결정 로직 추가
  - 3단계(flag-builder.ts): prompt가 undefined이면 마지막 positional arg 생략됨을 명시
  - 4단계(spawner.ts): `stdio: 'inherit'`로 interactive TUI 표시 설명 추가
  - 5단계(run-logger.ts): `prompt: null`, `mode: "interactive"` 필드 명시
  - Print Mode 예시 유지하되 mode 결정 로직 설명 보강

### `docs/adr.md`
- 변경 요약: ADR-011 추가 — run command의 prompt optional화 및 -p first-class option 등록
- 핵심 변경점:
  - 배경: 사용자가 prompt 없이 interactive TUI를 시작하고 싶은 니즈, cc-company가 `-p` 여부를 인식해야 mode별 로직 분기 가능
  - 결정 6가지:
    1. `<prompt>`를 optional로 변경
    2. `-p`를 cc-company의 first-class option으로 등록 (인식 + 전달)
    3. `-p` 없이 실행하면 interactive TUI, `-p`로 실행하면 print mode
    4. `-p` 사용 시 prompt 필수
    5. RunLog에 `mode` 필드 추가, `prompt`는 nullable
    6. `startedAt`은 spawn 직전, `finishedAt`은 spawn 완료 후 기록
  - 근거: ADR-003의 패스스루 원칙을 유지하면서 "인식 + 전달" 하이브리드 접근, interactive mode가 Claude Code의 핵심 UX

# Phase 6: Commands

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:
- `/spec/spec.md` — CLI 명령어 전체 스펙
- `/spec/architecture.md` — commands 레이어의 역할 (얇은 핸들러, 로직 없음)
- `/spec/adr.md` — ADR-003 (플래그 패스스루), ADR-010 (init 멱등성)

그리고 이전 phase의 작업물을 반드시 확인하라:
- `src/index.ts` — 현재 CLI 엔트리포인트 구조
- `src/services/agent.service.ts` — AgentService 메서드 시그니처
- `src/services/resource.service.ts` — ResourceService 메서드 시그니처
- `src/services/run.service.ts` — RunService 메서드 시그니처
- `src/store/fs-store.ts` — FsStore 생성자
- `src/logger/run-logger.ts` — RunLogger 생성자

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라. Commands는 service 메서드를 호출만 하는 얇은 레이어다. 여기에 비즈니스 로직을 넣지 마라.

## 작업 내용

### 공통 사항

모든 command에서 공유하는 초기화 로직:
- `.cc-company/` 경로 결정: `process.cwd() + '/.cc-company'`
- FsStore 인스턴스 생성
- Service 인스턴스 생성
- init 이외의 명령어는 `.cc-company/`가 존재하지 않으면 에러: "cc-company가 초기화되지 않았습니다. `cc-company init`을 먼저 실행하세요."

이 초기화 로직을 command마다 중복하지 말고, 헬퍼 함수로 추출하라.

### 1. src/commands/init.ts

```bash
cc-company init
cc-company init --force
```

- `.cc-company/`가 이미 존재하면 에러. `--force`면 기존 디렉토리 삭제 후 재생성.
- 디렉토리 구조 생성: config.json, agents/, subagents/, skills/, hooks/, runs/
- config.json에 `{ "version": "0.1.0" }` 기록
- Phase 7에서 만들 템플릿을 복사하는 로직이 여기에 들어간다. 지금은 **빈 구조만 생성**하고, 기본 agent 생성은 Phase 7에서 추가한다.

출력: "cc-company가 초기화되었습니다."

### 2. src/commands/run.ts

```bash
cc-company run <agent-name> <prompt> [claude flags...]
```

commander 설정:
- `.argument('<agent>', 'agent name')`
- `.argument('<prompt>', 'prompt')`
- `.allowUnknownOption()` — 나머지 플래그 패스스루
- `.allowExcessArguments()` — 혹시 모를 추가 인자 허용

패스스루 플래그 추출: `command.args`에서 포지셔널 2개를 제외한 나머지.
commander의 `.parseOptions()`를 활용하거나, `process.argv`에서 직접 파싱하라.

RunService.run()을 호출하고, exitCode를 process.exitCode에 설정.

### 3. src/commands/agent.ts

```bash
cc-company agent create <name>
cc-company agent list
cc-company agent remove <name>
cc-company agent <name> show
cc-company agent <name> add <resource-type> <resource-name>
cc-company agent <name> remove <resource-type> <resource-name>
```

commander의 subcommand로 구현. 출력은 간결한 텍스트. JSON 출력 옵션은 나중에.

agent list 출력 예시:
```
developer  소프트웨어 개발 전담 에이전트
designer   UI/UX 디자인 전담 에이전트
hr         인사/조직 관리 전담 에이전트
```

agent show 출력 예시:
```
Name: developer
Description: 소프트웨어 개발 전담 에이전트

Subagents: git-expert, code-reviewer
Skills: deploy
Hooks: pre-commit
```

### 4. src/commands/subagent.ts

```bash
cc-company subagent add <name>
cc-company subagent list
cc-company subagent remove <name>
```

ResourceService를 호출. 출력 형식은 agent list와 유사.

### 5. src/commands/skill.ts, src/commands/hook.ts

subagent.ts와 동일한 패턴. 리소스 타입만 다르다.

### 6. src/index.ts 수정

모든 command를 commander에 등록한다. program.parse() 전에 모든 subcommand가 등록되어야 한다.

## Acceptance Criteria

```bash
npm run build                          # 컴파일 에러 없음
npm test                               # 기존 테스트 모두 통과
npx cc-company init                    # .cc-company/ 생성
npx cc-company agent list              # 빈 목록 (아직 기본 agent 없음)
npx cc-company agent create developer  # agent 생성
npx cc-company agent developer show    # agent 상세 조회
npx cc-company agent list              # developer 표시
npx cc-company agent remove developer  # agent 삭제
```

## AC 검증 방법

위 명령어를 순서대로 실행하라. `npm run build && npm test`도 통과해야 한다.
모두 성공하면 `/tasks/index.json`의 phase 6 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- Commands는 **얇은 레이어**다. arg 파싱 → service 호출 → 결과 출력. 이게 전부.
- console.log로 출력한다. 별도 로깅 프레임워크 불필요.
- 에러 발생 시 process.exit(1)로 종료. 에러 메시지는 console.error로 출력.
- run command의 패스스루 처리가 까다로울 수 있다. commander가 알 수 없는 플래그를 어떻게 처리하는지 확인하고, 정확하게 claude에 전달되는지 검증하라.

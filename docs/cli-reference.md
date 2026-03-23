# CLI Reference

cc-company의 모든 명령어.

## Project

| Command | Description |
|---|---|
| `cc-company init` | 프로젝트 초기화 (`.cc-company/` 생성) |
| `cc-company init --force` | 기존 설정 덮어쓰기 |

## Agent Execution

| Command | Description |
|---|---|
| `cc-company run <agent>` | Interactive TUI 모드 |
| `cc-company run <agent> <prompt>` | Interactive + 초기 프롬프트 |
| `cc-company run <agent> -p <prompt>` | Print mode (headless) |
| `cc-company run <agent> -p <prompt> --output-format json` | JSON 출력 |

`-p`, `<prompt>` 외의 플래그는 Claude Code CLI에 패스스루.

## Agent Management

| Command | Description |
|---|---|
| `cc-company agent create <name>` | 새 agent 생성 |
| `cc-company agent list` | agent 목록 |
| `cc-company agent remove <name>` | agent 삭제 |
| `cc-company agent <name> show` | agent 상세 조회 |

## Resource Assignment

| Command | Description |
|---|---|
| `cc-company agent <name> add subagent <res>` | subagent 할당 |
| `cc-company agent <name> add skill <res>` | skill 할당 |
| `cc-company agent <name> add hook <res>` | hook 할당 |
| `cc-company agent <name> remove subagent <res>` | subagent 해제 |
| `cc-company agent <name> remove skill <res>` | skill 해제 |
| `cc-company agent <name> remove hook <res>` | hook 해제 |

## Shared Resources

| Command | Description |
|---|---|
| `cc-company subagent list` | 공용 subagent 목록 |
| `cc-company skill list` | 공용 skill 목록 |
| `cc-company hook list` | 공용 hook 목록 |

## Daemon Mode

| Command | Description |
|---|---|
| `cc-company start` | Ticket Server + agent workers 시작 |

## Ticket Management

| Command | Description |
|---|---|
| `cc-company ticket create --assignee <agent> --title <t> --prompt <p>` | ticket 생성 |
| `cc-company ticket list [--status <s>] [--assignee <a>]` | ticket 목록 |
| `cc-company ticket show <id>` | ticket 상세 |
| `cc-company ticket cancel <id>` | ticket 취소 |

Options:
- `--cc <agents>` — 참조 agent (쉼표 구분)
- `--priority <p>` — `low`, `normal`, `high`, `urgent`

## Webhook

| Command | Description |
|---|---|
| `cc-company webhook setup <smee-url>` | smee.io URL 설정 + 활성화 |
| `cc-company webhook status` | 현재 설정 표시 |
| `cc-company webhook disable` | webhook 비활성화 |
| `cc-company webhook set-secret <secret>` | GitHub webhook secret 설정 |
| `cc-company webhook set-approve-condition <any\|all>` | PR approve 조건 |

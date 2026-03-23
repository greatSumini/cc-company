# CLI Reference

agent-inc의 모든 명령어.

## Project

| Command | Description |
|---|---|
| `agent-inc init` | 프로젝트 초기화 (`.agentinc/` 생성) |
| `agent-inc init --force` | 기존 설정 덮어쓰기 |

## Agent Execution

| Command | Description |
|---|---|
| `agent-inc run <agent>` | Interactive TUI 모드 |
| `agent-inc run <agent> <prompt>` | Interactive + 초기 프롬프트 |
| `agent-inc run <agent> -p <prompt>` | Print mode (headless) |
| `agent-inc run <agent> -p <prompt> --output-format json` | JSON 출력 |

`-p`, `<prompt>` 외의 플래그는 Claude Code CLI에 패스스루.

## Agent Management

| Command | Description |
|---|---|
| `agent-inc agent create <name>` | 새 agent 생성 |
| `agent-inc agent list` | agent 목록 |
| `agent-inc agent remove <name>` | agent 삭제 |
| `agent-inc agent <name> show` | agent 상세 조회 |

## Resource Assignment

| Command | Description |
|---|---|
| `agent-inc agent <name> add subagent <res>` | subagent 할당 |
| `agent-inc agent <name> add skill <res>` | skill 할당 |
| `agent-inc agent <name> add hook <res>` | hook 할당 |
| `agent-inc agent <name> remove subagent <res>` | subagent 해제 |
| `agent-inc agent <name> remove skill <res>` | skill 해제 |
| `agent-inc agent <name> remove hook <res>` | hook 해제 |

## Shared Resources

| Command | Description |
|---|---|
| `agent-inc subagent list` | 공용 subagent 목록 |
| `agent-inc skill list` | 공용 skill 목록 |
| `agent-inc hook list` | 공용 hook 목록 |

## Daemon Mode

| Command | Description |
|---|---|
| `agent-inc start` | Ticket Server + agent workers 시작 |

## Ticket Management

| Command | Description |
|---|---|
| `agent-inc ticket create --assignee <agent> --title <t> --prompt <p>` | ticket 생성 |
| `agent-inc ticket list [--status <s>] [--assignee <a>]` | ticket 목록 |
| `agent-inc ticket show <id>` | ticket 상세 |
| `agent-inc ticket cancel <id>` | ticket 취소 |

Options:
- `--cc <agents>` — 참조 agent (쉼표 구분)
- `--priority <p>` — `low`, `normal`, `high`, `urgent`

## Webhook

| Command | Description |
|---|---|
| `agent-inc webhook setup <smee-url>` | smee.io URL 설정 + 활성화 |
| `agent-inc webhook status` | 현재 설정 표시 |
| `agent-inc webhook disable` | webhook 비활성화 |
| `agent-inc webhook set-secret <secret>` | GitHub webhook secret 설정 |
| `agent-inc webhook set-approve-condition <any\|all>` | PR approve 조건 |

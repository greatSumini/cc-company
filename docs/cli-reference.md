# CLI Reference

agentinc의 모든 명령어.

## Project

| Command | Description |
|---|---|
| `agentinc init` | 프로젝트 초기화 (`.agentinc/` 생성) |
| `agentinc init --force` | 기존 설정 덮어쓰기 |

## Agent Execution

| Command | Description |
|---|---|
| `agentinc run <agent>` | Interactive TUI 모드 |
| `agentinc run <agent> <prompt>` | Interactive + 초기 프롬프트 |
| `agentinc run <agent> -p <prompt>` | Print mode (headless) |
| `agentinc run <agent> -p <prompt> --output-format json` | JSON 출력 |

`-p`, `<prompt>` 외의 플래그는 Claude Code CLI에 패스스루.

## Agent Management

| Command | Description |
|---|---|
| `agentinc agent create <name>` | 새 agent 생성 |
| `agentinc agent list` | agent 목록 |
| `agentinc agent remove <name>` | agent 삭제 |
| `agentinc agent <name> show` | agent 상세 조회 |

## Resource Assignment

| Command | Description |
|---|---|
| `agentinc agent <name> add subagent <res>` | subagent 할당 |
| `agentinc agent <name> add skill <res>` | skill 할당 |
| `agentinc agent <name> add hook <res>` | hook 할당 |
| `agentinc agent <name> remove subagent <res>` | subagent 해제 |
| `agentinc agent <name> remove skill <res>` | skill 해제 |
| `agentinc agent <name> remove hook <res>` | hook 해제 |

## Shared Resources

| Command | Description |
|---|---|
| `agentinc subagent list` | 공용 subagent 목록 |
| `agentinc skill list` | 공용 skill 목록 |
| `agentinc hook list` | 공용 hook 목록 |

## Daemon Mode

| Command | Description |
|---|---|
| `agentinc start` | Ticket Server + agent workers 시작 |

## Ticket Management

| Command | Description |
|---|---|
| `agentinc ticket create --assignee <agent> --title <t> --prompt <p>` | ticket 생성 |
| `agentinc ticket list [--status <s>] [--assignee <a>]` | ticket 목록 |
| `agentinc ticket show <id>` | ticket 상세 |
| `agentinc ticket cancel <id>` | ticket 취소 |

Options:
- `--cc <agents>` — 참조 agent (쉼표 구분)
- `--priority <p>` — `low`, `normal`, `high`, `urgent`

## Webhook

| Command | Description |
|---|---|
| `agentinc webhook setup <smee-url>` | smee.io URL 설정 + 활성화 |
| `agentinc webhook status` | 현재 설정 표시 |
| `agentinc webhook disable` | webhook 비활성화 |
| `agentinc webhook set-secret <secret>` | GitHub webhook secret 설정 |
| `agentinc webhook set-approve-condition <any\|all>` | PR approve 조건 |

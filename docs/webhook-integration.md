# GitHub Webhook Integration

PR 이벤트를 자동으로 ticket으로 변환하여 agent가 처리.

## Supported Events

| Event | Action | Result |
|---|---|---|
| `pull_request_review_comment` | created | Review comment ticket 생성 |
| `pull_request_review` | submitted (approved) | Merge ticket 생성 |

## How It Works

```
GitHub PR event
      ↓
  smee.io (로컬) 또는 직접 (원격)
      ↓
  /webhooks/github
      ↓
  PrEventService
      ↓
  PR author의 gh_user로 agent 매칭
      ↓
  Ticket 자동 생성
      ↓
  Agent worker가 처리
```

## Setup

### 1. smee.io 채널 생성 (로컬 개발용)

1. https://smee.io 접속
2. "Start a new channel" 클릭
3. URL 복사 (예: `https://smee.io/abcd1234`)

### 2. agent-inc 설정

```bash
agent-inc webhook setup https://smee.io/abcd1234
agent-inc webhook set-secret your-webhook-secret
```

### 3. GitHub Webhook 등록

Repository Settings → Webhooks → Add webhook:

- **Payload URL**: smee.io URL (로컬) 또는 서버 URL (원격)
- **Content type**: `application/json`
- **Secret**: 위에서 설정한 secret
- **Events**:
  - Pull request reviews
  - Pull request review comments

### 4. Agent에 gh_user 설정

`.agentinc/agents/developer/agent.json`:

```json
{
  "name": "developer",
  "gh_user": "your-github-username"
}
```

PR author가 `gh_user`와 일치하면 해당 agent에 ticket 할당.

### 5. 서버 시작

```bash
agent-inc start
```

## Approve Condition

PR merge ticket 생성 조건:

```bash
# 최소 1개 approve면 merge ticket 생성 (기본값)
agent-inc webhook set-approve-condition any

# 모든 requested reviewer가 approve해야 merge ticket 생성
agent-inc webhook set-approve-condition all
```

## Configuration

`.agentinc/config.json`:

```json
{
  "webhook": {
    "enabled": true,
    "smeeUrl": "https://smee.io/xxx",
    "secret": "your-secret",
    "approveCondition": "any"
  }
}
```

| Option | Description |
|---|---|
| `enabled` | webhook 활성화 여부 |
| `smeeUrl` | smee.io URL (로컬 개발용) |
| `secret` | GitHub webhook secret |
| `approveCondition` | `any` (기본) 또는 `all` |

# Phase 0: docs-update

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/adr.md` — Architecture Decision Records
- `/spec/ddr.md` — Design Decision Records (이번 task의 디자인 결정 기록)
- `/spec/architecture.md` — 전체 아키텍처

## 작업 내용

### 1. `/spec/web.md` 생성

GUI Dashboard의 아키텍처와 디자인 시스템을 문서화한다.

```markdown
# Web Dashboard (GUI)

## 아키텍처

### 기술 스택
- Vite + React 18 + TypeScript
- React Query v5 (서버 상태)
- Zustand (클라이언트 상태)
- Tailwind CSS (스타일링)
- Lucide React (아이콘)

### 패키지 구조
```
packages/web/src/
├── components/
│   ├── layout/      # Layout, Sidebar
│   ├── kanban/      # KanbanBoard, KanbanColumn, AgentFilter
│   ├── ticket/      # TicketCard, TicketDetailPanel
│   └── ui/          # Badge, Button (기본 컴포넌트)
├── pages/           # HomePage, AgentsPage, SubagentsPage, SkillsPage, WebhooksPage
├── hooks/           # useSSE, useTickets, useAgents
├── stores/          # connection-store, ui-store, agent-store
└── lib/             # api-client, query-client, utils
```

### 실시간 업데이트
- SSE (Server-Sent Events)로 서버 → 클라이언트 단방향 통신
- 이벤트: `ticket:created`, `ticket:updated`, `agent:status`

## 디자인 시스템

상세 디자인 결정은 `/spec/ddr.md` 참조.

### 핵심 원칙
- **Notion/Tally 스타일**: 모노톤 베이스, 절제된 색상
- **YAGNI**: 실제 필요가 느껴질 때만 기능 추가
- **아이콘**: Lucide React (emoji 사용 금지)

### 색상 규칙
- Status 색상: 배경 `*-100`, 강조/텍스트 `*-400`
- 기본 팔레트: gray 베이스 모노톤

### 인터랙션
- Hover: `hover:bg-gray-50`
- 선택: `bg-blue-50` + `border-l-2 border-blue-400`

### Shadow 정책
- 일반 카드: shadow 없음, border만 사용
- 모달/드롭다운: shadow 허용
```

### 2. `/spec/ddr.md` 확인

DDR-001 ~ DDR-009가 이미 작성되어 있는지 확인하고, 누락된 내용이 있으면 보완한다.

## Acceptance Criteria

```bash
# spec/web.md 파일 존재 확인
test -f spec/web.md && echo "OK" || echo "FAIL"

# spec/ddr.md 파일 존재 확인
test -f spec/ddr.md && echo "OK" || echo "FAIL"
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/13-design-refresh/index.json`의 phase 0 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 이 phase는 문서 작성만 수행한다. 코드 수정 금지.
- spec/web.md의 내용은 위 템플릿을 기반으로 하되, 현재 코드베이스를 확인하여 정확한 정보를 기록하라.
- ddr.md는 이미 작성되어 있으므로 내용을 확인만 하고, 수정이 필요한 경우에만 수정하라.

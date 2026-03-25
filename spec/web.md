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
├── pages/           # HomePage, SubagentsPage, SkillsPage, WebhooksPage
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

# Phase 4: kanban-style

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/ddr.md` — Design Decision Records (DDR-004 색상, DDR-005 인터랙션, DDR-006 Shadow)
- `/tasks/13-design-refresh/spec-diff.md` — 이번 task의 문서 변경 기록

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/packages/web/src/components/ui/badge.tsx` — 리팩토링된 Badge (새 variant 시스템)
- `/packages/web/src/components/layout/Sidebar.tsx` — Lucide 아이콘 적용된 사이드바

현재 Kanban 컴포넌트 파일들:

- `/packages/web/src/components/kanban/KanbanColumn.tsx`
- `/packages/web/src/components/kanban/AgentFilter.tsx`
- `/packages/web/src/components/ticket/TicketCard.tsx`

## 작업 내용

### 1. KanbanColumn.tsx 스타일 적용

**변경 사항:**
- 현재 스타일은 이미 심플하므로 큰 변경 없음
- 컬럼 헤더 카운트 배지 스타일만 정리

**변경 전:**
```tsx
<span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
  {count}
</span>
```

**변경 후:**
```tsx
<span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
  {count}
</span>
```

(gray-400 → gray-500 으로 가독성 향상)

### 2. TicketCard.tsx 스타일 적용

**변경 사항:**
- Shadow 제거, border만 사용 (DDR-006)
- Hover 효과: `hover:bg-gray-50` (DDR-005)
- 선택 상태: `bg-blue-50` + `border-l-2 border-blue-400`
- Emoji 제거 (DDR-003)
- Priority/Type variant를 새 Badge variant로 매핑

**새 카드 스타일:**
```tsx
import { MessageSquare, ExternalLink, Check, X, Ban } from 'lucide-react'

// Priority → Badge variant 매핑
const priorityVariant: Record<string, string> = {
  urgent: 'critical',
  high: 'high',
  normal: 'medium',
  low: 'low',
}

// Type → Badge variant 매핑
const typeVariant: Record<string, string> = {
  task: 'task',
  cc_review: 'cc_review',
}

// Done 상태 아이콘 (Lucide)
const DoneIcon: Record<string, React.FC<{ className?: string }>> = {
  completed: Check,
  failed: X,
  cancelled: Ban,
}
```

**카드 컨테이너 스타일:**
```tsx
// 선택 상태를 위해 selectedTicketId와 비교
const isSelected = useUIStore((s) => s.selectedTicketId === ticket.id)

<div
  onClick={() => setSelectedTicketId(ticket.id)}
  className={cn(
    'bg-white border border-gray-200 rounded-lg',
    'transition-colors cursor-pointer',
    'p-3 flex flex-col gap-2',
    isSelected
      ? 'bg-blue-50 border-l-2 border-l-blue-400'
      : 'hover:bg-gray-50'
  )}
>
```

**Emoji 대체:**
- `✅` → `<Check className="w-4 h-4 text-green-400" />`
- `❌` → `<X className="w-4 h-4 text-red-400" />`
- `🚫` → `<Ban className="w-4 h-4 text-gray-400" />`
- `💬` → `<MessageSquare className="w-3.5 h-3.5" />`
- `🔗` → `<ExternalLink className="w-3.5 h-3.5" />`

### 3. AgentFilter.tsx 스타일 적용

**변경 사항:**
- 선택된 버튼: `bg-gray-900 text-white` → `bg-blue-50 text-gray-900 border border-blue-400`
- 비선택 버튼: `bg-gray-100` → `bg-white border border-gray-200`
- Hover: `hover:bg-gray-200` → `hover:bg-gray-50`

**새 버튼 스타일:**
```tsx
<button
  onClick={() => setAgentFilter(null)}
  className={cn(
    'px-3 py-1.5 rounded-md text-sm transition-colors border',
    agentFilter === null
      ? 'bg-blue-50 text-gray-900 border-blue-400'
      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
  )}
>
  All
</button>
```

## Acceptance Criteria

```bash
# 빌드 성공 확인
pnpm --filter @agentinc/web build

# 전체 테스트 통과
pnpm test
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/13-design-refresh/index.json`의 phase 4 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- TicketCard에서 `shadow-soft`, `shadow-soft-md`, `hover:shadow-soft-md` 클래스를 모두 제거하라. 이 클래스들은 Phase 1에서 tailwind.config.js에서 삭제되었다.
- Badge variant 변경 시 Phase 2에서 정의한 새 variant 이름을 사용하라.
- Lucide 아이콘은 named import: `import { Check, X, Ban, MessageSquare, ExternalLink } from 'lucide-react'`
- 선택 상태(isSelected)를 위해 useUIStore에서 selectedTicketId를 가져와 비교하라.
- 기존 테스트를 깨뜨리지 마라.

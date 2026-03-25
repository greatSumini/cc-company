# Phase 3: layout

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/ddr.md` — Design Decision Records (DDR-002 사이드바, DDR-003 아이콘, DDR-005 인터랙션)
- `/tasks/13-design-refresh/spec-diff.md` — 이번 task의 문서 변경 기록

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/packages/web/src/components/ui/badge.tsx` — 리팩토링된 Badge
- `/packages/web/src/components/ui/button.tsx` — 리팩토링된 Button

현재 레이아웃 파일들:

- `/packages/web/src/components/layout/Layout.tsx`
- `/packages/web/src/components/layout/Sidebar.tsx`

## 작업 내용

### 1. Sidebar.tsx 전면 재작성

**변경 사항:**
- 에이전트 목록 섹션 완전 제거
- 네비게이션 메뉴만 유지
- Lucide 아이콘 적용 (emoji 제거)
- DDR-005 인터랙션 스타일 적용

**새 navItems 구조:**
```typescript
import { Home, Users, Package, Zap, Webhook } from 'lucide-react'

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/agents', label: 'Agents', icon: Users },
  { path: '/subagents', label: 'Subagents', icon: Package },
  { path: '/skills', label: 'Skills', icon: Zap },
  { path: '/webhooks', label: 'Webhooks', icon: Webhook },
]
```

**새 Sidebar 구조:**
```tsx
import { Link, useLocation } from 'react-router-dom'
import { Home, Users, Package, Zap, Webhook } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/agents', label: 'Agents', icon: Users },
  { path: '/subagents', label: 'Subagents', icon: Package },
  { path: '/skills', label: 'Skills', icon: Zap },
  { path: '/webhooks', label: 'Webhooks', icon: Webhook },
]

export function Sidebar() {
  const location = useLocation()

  return (
    <aside className="w-56 bg-white border-r border-gray-200 min-h-[calc(100vh-3.5rem)]">
      <nav className="p-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-blue-50 text-gray-900 border-l-2 border-blue-400 -ml-[2px] pl-[14px]'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
```

**핵심 규칙:**
- 에이전트 관련 코드 완전 제거 (useAgentStore, useQuery for agents, statuses 표시)
- 활성 메뉴: `bg-blue-50` + `border-l-2 border-blue-400`
- 비활성 메뉴 hover: `hover:bg-gray-50`
- 아이콘 크기: `w-4 h-4`

### 2. Layout.tsx 정리

**변경 사항:**
- 기존 구조 유지 (Header + Sidebar + Main)
- 불필요한 스타일 정리 없음 (현재 상태 양호)

Layout.tsx는 현재 상태를 유지한다. Header의 연결 상태 표시도 그대로 유지.

## Acceptance Criteria

```bash
# 빌드 성공 확인
pnpm --filter @agentinc/web build

# 전체 테스트 통과
pnpm test
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/13-design-refresh/index.json`의 phase 3 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- Sidebar에서 에이전트 목록을 제거하지만, `useAgentStore`와 `useAgents` hook은 다른 곳(TicketCard, AgentFilter)에서 사용하므로 삭제하지 마라.
- Sidebar에서만 에이전트 관련 import와 코드를 제거하라.
- `/agents` 라우트는 아직 App.tsx에 추가하지 마라 (Phase 5에서 진행).
- Lucide 아이콘 import 시 named import 사용: `import { Home, Users, ... } from 'lucide-react'`
- 기존 테스트를 깨뜨리지 마라.

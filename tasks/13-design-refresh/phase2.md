# Phase 2: ui-components

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/ddr.md` — Design Decision Records (DDR-004 색상 시스템, DDR-005 인터랙션 스타일)
- `/tasks/13-design-refresh/spec-diff.md` — 이번 task의 문서 변경 기록

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/packages/web/tailwind.config.js` — 커스텀 색상/shadow 제거된 상태
- `/packages/web/src/index.css` — .card, .card-hover 제거된 상태

현재 컴포넌트 파일들:

- `/packages/web/src/components/ui/badge.tsx`
- `/packages/web/src/components/ui/button.tsx`

## 작업 내용

### 1. Badge 컴포넌트 리팩토링

**파일:** `/packages/web/src/components/ui/badge.tsx`

**변경 사항:**
- variant를 status/priority/type 기반으로 변경
- DDR-004 색상 규칙 적용: 배경 `*-100`, 텍스트 `*-400`

**새 인터페이스:**
```typescript
interface BadgeProps {
  variant:
    // Ticket Status
    | 'blocked' | 'ready' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
    // Priority
    | 'critical' | 'high' | 'medium' | 'low'
    // Type
    | 'task' | 'cc_review'
    // Agent Status
    | 'idle' | 'working' | 'offline'
    // Generic
    | 'default'
  children: React.ReactNode
  className?: string
}
```

**색상 매핑 (DDR-004 준수):**
```typescript
const variantStyles: Record<string, string> = {
  // Ticket Status
  blocked: 'bg-red-100 text-red-400',
  ready: 'bg-blue-100 text-blue-400',
  in_progress: 'bg-yellow-100 text-yellow-400',
  completed: 'bg-green-100 text-green-400',
  failed: 'bg-red-100 text-red-400',
  cancelled: 'bg-gray-100 text-gray-400',

  // Priority
  critical: 'bg-red-100 text-red-400',
  high: 'bg-orange-100 text-orange-400',
  medium: 'bg-blue-100 text-blue-400',
  low: 'bg-gray-100 text-gray-400',

  // Type
  task: 'bg-purple-100 text-purple-400',
  cc_review: 'bg-green-100 text-green-400',

  // Agent Status
  idle: 'bg-gray-100 text-gray-400',
  working: 'bg-green-100 text-green-400',
  offline: 'bg-red-100 text-red-400',

  // Default
  default: 'bg-gray-100 text-gray-400',
}
```

### 2. Button 컴포넌트 리팩토링

**파일:** `/packages/web/src/components/ui/button.tsx`

**변경 사항:**
- DDR-005 인터랙션 스타일 적용
- focus ring 간소화: `focus-visible:ring-2 focus-visible:ring-gray-400` → `focus-visible:ring-1 focus-visible:ring-gray-300`
- ghost variant hover: `hover:bg-gray-100` → `hover:bg-gray-50`

**새 스타일:**
```typescript
// 기본 클래스
'inline-flex items-center justify-center rounded-md font-medium transition-colors',
'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-300',
'disabled:pointer-events-none disabled:opacity-50',

// Variants
{
  'bg-gray-900 text-white hover:bg-gray-800': variant === 'primary',
  'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50': variant === 'secondary',
  'hover:bg-gray-50': variant === 'ghost',  // gray-100 → gray-50
}
```

## Acceptance Criteria

```bash
# 빌드 성공 확인
pnpm --filter @agentinc/web build

# 전체 테스트 통과
pnpm test
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/13-design-refresh/index.json`의 phase 2 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- Badge의 기존 variant (`blue`, `green`, `yellow`, `red`, `purple`, `gray`)를 사용하는 곳이 있으면 새 variant로 마이그레이션하라.
- TicketCard에서 priorityVariant, typeVariant 매핑이 있다. Badge variant 변경에 맞춰 해당 매핑도 업데이트하라.
  - `urgent` → `critical`
  - `high` → `high`
  - `normal` → `medium`
  - `low` → `low`
- 기존 테스트를 깨뜨리지 마라.

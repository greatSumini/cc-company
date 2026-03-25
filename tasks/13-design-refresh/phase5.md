# Phase 5: agents-page

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/ddr.md` — Design Decision Records (DDR-002 사이드바 구성, DDR-009 YAGNI)
- `/tasks/13-design-refresh/spec-diff.md` — 이번 task의 문서 변경 기록

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/packages/web/src/components/layout/Sidebar.tsx` — `/agents` 네비게이션 포함
- `/packages/web/src/App.tsx` — 라우트 구조

기존 페이지 파일 참고:

- `/packages/web/src/pages/SubagentsPage.tsx`

## 작업 내용

### 1. AgentsPage.tsx 생성

**파일:** `/packages/web/src/pages/AgentsPage.tsx`

**내용:**
```tsx
export function AgentsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Agents</h1>
      <p className="text-sm text-gray-500">
        준비 중입니다.
      </p>
    </div>
  )
}
```

DDR-009 (YAGNI)에 따라 placeholder로 구현. 실제 필요가 느껴질 때 기능 추가.

### 2. App.tsx 라우트 추가

**파일:** `/packages/web/src/App.tsx`

**변경 사항:**
- AgentsPage import 추가
- `/agents` 라우트 추가

**변경 전:**
```tsx
import { HomePage } from '@/pages/HomePage'
import { SubagentsPage } from '@/pages/SubagentsPage'
import { SkillsPage } from '@/pages/SkillsPage'
import { WebhooksPage } from '@/pages/WebhooksPage'
// ...
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/subagents" element={<SubagentsPage />} />
  <Route path="/skills" element={<SkillsPage />} />
  <Route path="/webhooks" element={<WebhooksPage />} />
</Routes>
```

**변경 후:**
```tsx
import { HomePage } from '@/pages/HomePage'
import { AgentsPage } from '@/pages/AgentsPage'
import { SubagentsPage } from '@/pages/SubagentsPage'
import { SkillsPage } from '@/pages/SkillsPage'
import { WebhooksPage } from '@/pages/WebhooksPage'
// ...
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/agents" element={<AgentsPage />} />
  <Route path="/subagents" element={<SubagentsPage />} />
  <Route path="/skills" element={<SkillsPage />} />
  <Route path="/webhooks" element={<WebhooksPage />} />
</Routes>
```

## Acceptance Criteria

```bash
# 빌드 성공 확인
pnpm --filter @agentinc/web build

# 전체 테스트 통과
pnpm test
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/13-design-refresh/index.json`의 phase 5 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- AgentsPage는 placeholder만 구현하라. 에이전트 목록 조회, CRUD 기능 등은 구현하지 마라 (DDR-009 YAGNI).
- 라우트 순서: Home → Agents → Subagents → Skills → Webhooks (Sidebar 메뉴 순서와 일치)
- 기존 테스트를 깨뜨리지 마라.

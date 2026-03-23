# Phase 4: Web 패키지 초기 설정

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/architecture.md` — GUI 대시보드 섹션
- `/spec/adr.md` — ADR-023 (GUI 프레임워크), ADR-025 (상태 관리)
- `/tasks/12-gui-dashboard/spec-diff.md` — 이번 task의 문서 변경 기록

그리고 이전 phase의 작업물을 반드시 확인하라:

- `packages/core/src/types/` — 도메인 타입 정의 (Ticket, Agent 등)
- `packages/server/src/routes/` — API 엔드포인트 확인

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

### 1. Web 패키지 초기화

#### 1.1 Vite + React + TypeScript 프로젝트 생성

```bash
cd packages
pnpm create vite web --template react-ts
cd web
```

#### 1.2 `packages/web/package.json` 수정

```json
{
  "name": "@agentinc/web",
  "version": "0.2.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@agentinc/core": "workspace:*",
    "@tanstack/react-query": "^5.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.20.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.7.0",
    "vite": "^5.4.0"
  }
}
```

### 2. Tailwind CSS 설정

#### 2.1 `packages/web/tailwind.config.js` 생성

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 모노톤 기본 팔레트 (gray 사용)
        // 파스텔톤 강조색 (뱃지용)
        'badge-blue': {
          bg: '#dbeafe',      // blue-100
          text: '#2563eb',    // blue-600
        },
        'badge-green': {
          bg: '#dcfce7',      // green-100
          text: '#16a34a',    // green-600
        },
        'badge-yellow': {
          bg: '#fef9c3',      // yellow-100
          text: '#ca8a04',    // yellow-600
        },
        'badge-red': {
          bg: '#fee2e2',      // red-100
          text: '#dc2626',    // red-600
        },
        'badge-purple': {
          bg: '#f3e8ff',      // purple-100
          text: '#9333ea',    // purple-600
        },
        'badge-gray': {
          bg: '#f3f4f6',      // gray-100
          text: '#4b5563',    // gray-600
        },
      },
      boxShadow: {
        'soft': '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'soft-md': '0 2px 6px 0 rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
      },
    },
  },
  plugins: [],
}
```

#### 2.2 `packages/web/postcss.config.js` 생성

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

#### 2.3 `packages/web/src/index.css` 수정

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* 기본 스타일 */
body {
  @apply bg-gray-50 text-gray-900 antialiased;
}

/* 옅은 shadow 유틸리티 */
.card {
  @apply bg-white rounded-lg shadow-soft border border-gray-100;
}

.card-hover {
  @apply hover:shadow-soft-md transition-shadow duration-200;
}
```

### 3. shadcn/ui 설정

#### 3.1 shadcn/ui 초기화

shadcn/ui는 복사 기반이므로 필요한 컴포넌트만 수동으로 추가한다. 일단 기본 구조만 설정:

#### 3.2 `packages/web/src/lib/utils.ts` 생성

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

`clsx`와 `tailwind-merge` 의존성 추가:
```bash
pnpm --filter @agentinc/web add clsx tailwind-merge
```

#### 3.3 기본 UI 컴포넌트 생성

**`packages/web/src/components/ui/badge.tsx`**:

```tsx
import { cn } from '@/lib/utils'

interface BadgeProps {
  variant: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray'
  children: React.ReactNode
  className?: string
}

const variantStyles = {
  blue: 'bg-badge-blue-bg text-badge-blue-text',
  green: 'bg-badge-green-bg text-badge-green-text',
  yellow: 'bg-badge-yellow-bg text-badge-yellow-text',
  red: 'bg-badge-red-bg text-badge-red-text',
  purple: 'bg-badge-purple-bg text-badge-purple-text',
  gray: 'bg-badge-gray-bg text-badge-gray-text',
}

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
      variantStyles[variant],
      className
    )}>
      {children}
    </span>
  )
}
```

**`packages/web/src/components/ui/button.tsx`**:

```tsx
import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400',
          'disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-gray-900 text-white hover:bg-gray-800': variant === 'primary',
            'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50': variant === 'secondary',
            'hover:bg-gray-100': variant === 'ghost',
          },
          {
            'h-8 px-3 text-sm': size === 'sm',
            'h-10 px-4 text-sm': size === 'md',
            'h-12 px-6 text-base': size === 'lg',
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
```

### 4. Vite 설정

#### 4.1 `packages/web/vite.config.ts` 수정

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3848,
    proxy: {
      '/api': {
        target: 'http://localhost:3847',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/events': {
        target: 'http://localhost:3847',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
```

#### 4.2 `packages/web/tsconfig.json` 수정

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 5. React Query + Zustand 설정

#### 5.1 `packages/web/src/lib/query-client.ts` 생성

```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1분
      retry: 1,
    },
  },
})
```

#### 5.2 `packages/web/src/stores/agent-store.ts` 생성

```typescript
import { create } from 'zustand'

interface AgentState {
  statuses: Record<string, 'idle' | 'working'>
  updateStatus: (agent: string, state: 'idle' | 'working') => void
  setStatuses: (statuses: Record<string, 'idle' | 'working'>) => void
}

export const useAgentStore = create<AgentState>((set) => ({
  statuses: {},
  updateStatus: (agent, state) =>
    set((s) => ({
      statuses: { ...s.statuses, [agent]: state },
    })),
  setStatuses: (statuses) => set({ statuses }),
}))
```

#### 5.3 `packages/web/src/stores/ui-store.ts` 생성

```typescript
import { create } from 'zustand'

interface UIState {
  selectedTicketId: string | null
  agentFilter: string | null
  setSelectedTicketId: (id: string | null) => void
  setAgentFilter: (agent: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  selectedTicketId: null,
  agentFilter: null,
  setSelectedTicketId: (id) => set({ selectedTicketId: id }),
  setAgentFilter: (agent) => set({ agentFilter: agent }),
}))
```

### 6. API 클라이언트 설정

#### 6.1 `packages/web/src/lib/api-client.ts` 생성

```typescript
const API_BASE = '/api'

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`)
  }

  return response.json()
}

export const api = {
  tickets: {
    list: (params?: { status?: string; assignee?: string }) => {
      const searchParams = new URLSearchParams()
      if (params?.status) searchParams.set('status', params.status)
      if (params?.assignee) searchParams.set('assignee', params.assignee)
      const query = searchParams.toString()
      return fetchAPI<unknown[]>(`/tickets${query ? `?${query}` : ''}`)
    },
    get: (id: string) => fetchAPI<unknown>(`/tickets/${id}`),
  },
  agents: {
    list: () => fetchAPI<unknown[]>('/agents'),
    status: () => fetchAPI<unknown[]>('/agents/status'),
  },
}
```

### 7. 레이아웃 컴포넌트

#### 7.1 `packages/web/src/components/layout/Layout.tsx` 생성

```tsx
import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6">
        <h1 className="text-lg font-semibold text-gray-900">Agent Inc</h1>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

#### 7.2 `packages/web/src/components/layout/Sidebar.tsx` 생성

```tsx
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAgentStore } from '@/stores/agent-store'
import { cn } from '@/lib/utils'

const navItems = [
  { path: '/subagents', label: 'Subagents', icon: '📦' },
  { path: '/skills', label: 'Skills', icon: '⚡' },
  { path: '/webhooks', label: 'Webhooks', icon: '🔗' },
]

export function Sidebar() {
  const location = useLocation()
  const statuses = useAgentStore((s) => s.statuses)

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: api.agents.list,
  })

  return (
    <aside className="w-56 bg-white border-r border-gray-200 min-h-[calc(100vh-3.5rem)]">
      {/* Agents Section */}
      <div className="p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Agents
        </h2>
        <ul className="space-y-1">
          {(agents as { name: string }[]).map((agent) => (
            <li key={agent.name}>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-700">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    statuses[agent.name] === 'working' ? 'bg-green-500' : 'bg-gray-300'
                  )}
                />
                {agent.name}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-gray-200" />

      {/* Navigation Section */}
      <div className="p-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors',
                  location.pathname === item.path
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
```

### 8. 빈 페이지 컴포넌트

#### 8.1 `packages/web/src/pages/SubagentsPage.tsx` 생성

```tsx
export function SubagentsPage() {
  return (
    <div className="flex items-center justify-center h-64 text-gray-500">
      Subagents 관리 페이지 (준비 중)
    </div>
  )
}
```

#### 8.2 `packages/web/src/pages/SkillsPage.tsx` 생성

```tsx
export function SkillsPage() {
  return (
    <div className="flex items-center justify-center h-64 text-gray-500">
      Skills 관리 페이지 (준비 중)
    </div>
  )
}
```

#### 8.3 `packages/web/src/pages/WebhooksPage.tsx` 생성

```tsx
export function WebhooksPage() {
  return (
    <div className="flex items-center justify-center h-64 text-gray-500">
      Webhooks 관리 페이지 (준비 중)
    </div>
  )
}
```

#### 8.4 `packages/web/src/pages/HomePage.tsx` 생성 (placeholder)

```tsx
export function HomePage() {
  return (
    <div className="text-gray-500">
      Kanban Board (Phase 5에서 구현)
    </div>
  )
}
```

### 9. App 및 라우팅 설정

#### 9.1 `packages/web/src/App.tsx` 수정

```tsx
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { queryClient } from '@/lib/query-client'
import { Layout } from '@/components/layout/Layout'
import { HomePage } from '@/pages/HomePage'
import { SubagentsPage } from '@/pages/SubagentsPage'
import { SkillsPage } from '@/pages/SkillsPage'
import { WebhooksPage } from '@/pages/WebhooksPage'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/subagents" element={<SubagentsPage />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="/webhooks" element={<WebhooksPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
```

#### 9.2 `packages/web/src/main.tsx` 확인/수정

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

## Acceptance Criteria

```bash
# 1. 의존성 설치
pnpm install

# 2. web 패키지 빌드
pnpm --filter @agentinc/web build

# 3. web 패키지 개발 서버 시작 (수동 확인용)
pnpm --filter @agentinc/web dev
# → 브라우저에서 http://localhost:3848 접속하여 레이아웃 확인
# → Sidebar에 Agents, Subagents, Skills, Webhooks 메뉴 확인
# → 빈 페이지들 라우팅 확인
```

빌드가 에러 없이 완료되고, 개발 서버에서 기본 레이아웃이 표시되어야 한다.

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/12-gui-dashboard/index.json`의 phase 4 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 `"error_message"` 필드로 기록하라.

## 주의사항

- **디자인 원칙 준수**:
  - 모노톤 (gray scale) 기본
  - 옅은 shadow (`shadow-soft`, `shadow-soft-md`)
  - 뱃지만 파스텔톤 배경 + 400~600 색상 텍스트
- Vite 생성 시 기본 파일들(App.css 등)은 삭제하거나 정리하라.
- `@/` 경로 alias가 정상 동작하는지 확인하라.
- React Query DevTools는 설치하지 마라 (불필요).
- 루트 `tsconfig.json`의 references에 web 패키지를 추가하지 마라 (Vite는 별도 빌드 시스템 사용).

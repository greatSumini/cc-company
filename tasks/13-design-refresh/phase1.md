# Phase 1: deps-tailwind

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/ddr.md` — Design Decision Records (DDR-004 색상 시스템, DDR-006 Shadow 정책)
- `/tasks/13-design-refresh/spec-diff.md` — 이번 task의 문서 변경 기록

그리고 현재 설정 파일들을 확인하라:

- `/packages/web/tailwind.config.js`
- `/packages/web/src/index.css`
- `/packages/web/package.json`

## 작업 내용

### 1. lucide-react 패키지 설치

```bash
cd /packages/web
pnpm add lucide-react
```

### 2. tailwind.config.js 정리

**변경 전 (현재 상태):**
```javascript
theme: {
  extend: {
    colors: {
      'badge-blue': { bg: '#dbeafe', text: '#2563eb' },
      'badge-green': { bg: '#dcfce7', text: '#16a34a' },
      // ... 커스텀 badge 색상들
    },
    boxShadow: {
      'soft': '...',
      'soft-md': '...',
    },
  },
},
```

**변경 후:**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 커스텀 색상 제거 — Tailwind 기본 팔레트 사용 (예: bg-red-100, text-red-400)
      // 커스텀 shadow 제거 — DDR-006에 따라 shadow 최소 사용
    },
  },
  plugins: [],
}
```

- `colors` 섹션의 커스텀 badge 색상 전체 삭제
- `boxShadow` 섹션의 `soft`, `soft-md` 삭제
- Tailwind 기본 팔레트 사용 (예: `bg-red-100`, `text-red-400`)

### 3. index.css 정리

**변경 전 (현재 상태):**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-50 text-gray-900 antialiased;
}

.card {
  @apply bg-white rounded-lg shadow-soft border border-gray-100;
}

.card-hover {
  @apply hover:shadow-soft-md transition-shadow duration-200;
}
```

**변경 후:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-50 text-gray-900 antialiased;
}
```

- `.card`, `.card-hover` 클래스 삭제 (DDR-006: shadow 제거, 컴포넌트에서 직접 Tailwind 유틸리티 사용)

## Acceptance Criteria

```bash
# 빌드 성공 확인
pnpm --filter @agentinc/web build
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/13-design-refresh/index.json`의 phase 1 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 빌드 에러가 발생할 수 있다 (커스텀 색상/shadow 클래스를 사용하는 컴포넌트들). 이 phase에서는 설정 파일만 정리하고, 컴포넌트 수정은 다음 phase에서 진행한다.
- 빌드 에러가 발생하면 해당 컴포넌트에서 사용 중인 커스텀 클래스를 Tailwind 기본 클래스로 임시 대체하여 빌드가 통과하도록 하라.
  - `bg-badge-blue-bg` → `bg-blue-100`
  - `text-badge-blue-text` → `text-blue-400`
  - `shadow-soft` → 제거 또는 `shadow-sm`
  - `shadow-soft-md` → 제거 또는 `shadow`
- 기존 테스트를 깨뜨리지 마라.

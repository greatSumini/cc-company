# Phase 0: 문서 업데이트

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/spec/architecture.md` — 현재 아키텍처
- `/spec/adr.md` — 기존 ADR 목록
- `/spec/spec.md` — CLI 명세

## 작업 내용

### 1. `/spec/architecture.md` 업데이트

기존 단일 패키지 구조에서 monorepo 구조로 전환됨을 반영한다. 아래 내용을 추가하라:

#### 1.1 Monorepo 구조 섹션 추가

```markdown
## Monorepo 구조

pnpm workspace 기반 monorepo로 구성된다.

\`\`\`
packages/
├── core/           # 공유 로직 + 타입
│   ├── src/
│   │   ├── types/           # 도메인 타입 (Agent, Ticket, etc)
│   │   ├── store/           # IStore, ITicketStore + 구현체
│   │   ├── services/        # 비즈니스 로직
│   │   └── utils/           # frontmatter 파싱 등
│   └── package.json
│
├── cli/            # CLI 전용
│   ├── src/
│   │   ├── commands/        # commander 핸들러
│   │   ├── claude-runner/   # spawn 로직
│   │   ├── gh-client/       # gh CLI 래퍼
│   │   └── logger/          # 실행 로그
│   └── package.json
│
├── server/         # HTTP API 서버
│   ├── src/
│   │   ├── routes/          # /tickets, /agents, /events
│   │   ├── middleware/      # auth, webhook-signature
│   │   ├── events/          # SSE EventBus
│   │   └── webhook-receiver/
│   └── package.json
│
└── web/            # GUI 대시보드
    ├── src/
    │   ├── components/      # React 컴포넌트
    │   ├── pages/           # 페이지
    │   ├── hooks/           # useSSE, useTickets 등
    │   └── stores/          # Zustand 스토어
    └── package.json
\`\`\`

### 패키지 의존성

\`\`\`
@agentinc/core ← @agentinc/cli
             ← @agentinc/server
             ← @agentinc/web (타입만)
\`\`\`
```

#### 1.2 GUI 아키텍처 섹션 추가

```markdown
## GUI 대시보드

### 기술 스택

- **프레임워크**: Vite + React + TypeScript
- **스타일링**: Tailwind CSS + shadcn/ui
- **상태 관리**: React Query (서버 상태) + Zustand (클라이언트 상태)
- **실시간**: SSE (Server-Sent Events)

### 실행 모드

**개발 모드**:
- `agentinc start` — API 서버 (포트 3847)
- `pnpm --filter @agentinc/web dev` — Vite dev server (포트 3848, HMR)
- Vite proxy로 API 요청을 3847로 전달

**프로덕션 모드**:
- `agentinc start` — API 서버 + 정적 파일 서빙
- 빌드된 web 패키지가 server/public/에 배치됨

### SSE 실시간 업데이트

\`\`\`
GET /events
Content-Type: text/event-stream

이벤트:
- ticket:created — 새 티켓 생성
- ticket:updated — 티켓 상태/내용 변경
- agent:status — Agent idle/working 상태 변경
\`\`\`
```

### 2. `/spec/adr.md` 업데이트

기존 ADR 목록 끝에 새 ADR 4개를 추가하라:

```markdown
## ADR-022: Monorepo 전환 (pnpm workspace)

**상태**: Accepted
**날짜**: 2026-03-24

### 컨텍스트
GUI 대시보드 추가로 프론트엔드 코드가 필요해졌다. 단일 패키지에 React를 추가하면 CLI 빌드에 불필요한 의존성이 포함되고, 빌드 복잡도가 급증한다.

### 결정
pnpm workspace 기반 monorepo로 전환한다.
- `packages/core`: 공유 타입 + 비즈니스 로직
- `packages/cli`: CLI 전용 코드
- `packages/server`: HTTP API 서버
- `packages/web`: GUI 대시보드

### 근거
- CLI와 GUI의 의존성 완전 분리
- core 패키지로 타입/로직 공유
- 독립적인 빌드/테스트 가능
- 향후 확장 유연성 (API 서버 분리 등)

---

## ADR-023: GUI 프레임워크 (Vite + React)

**상태**: Accepted
**날짜**: 2026-03-24

### 컨텍스트
GUI 대시보드 구현을 위한 프레임워크 선택이 필요하다.

### 결정
Vite + React + TypeScript를 사용한다.

### 근거
- Next.js는 SSR이 필요 없는 대시보드에 과함
- Vite의 빠른 HMR과 간단한 설정
- React Query + Zustand로 상태 관리
- Tailwind CSS + shadcn/ui로 빠른 UI 구축

---

## ADR-024: 실시간 업데이트 (SSE)

**상태**: Accepted
**날짜**: 2026-03-24

### 컨텍스트
Kanban 보드에서 티켓 상태 변경을 실시간으로 반영해야 한다. Polling, SSE, WebSocket 중 선택 필요.

### 결정
SSE (Server-Sent Events)를 사용한다.

### 근거
- 티켓 상태 변경은 서버→클라이언트 단방향이면 충분
- HTTP 기반이라 기존 Express에 쉽게 추가
- 원격 호스팅 시에도 nginx/cloudflare 뒤에서 동작
- Polling보다 즉각적, WebSocket보다 단순

### 이벤트 설계
- `ticket:created` — 새 티켓
- `ticket:updated` — 상태/내용 변경
- `agent:status` — Agent 상태 변경

---

## ADR-025: 상태 관리 (React Query + Zustand)

**상태**: Accepted
**날짜**: 2026-03-24

### 컨텍스트
GUI에서 서버 데이터와 클라이언트 상태를 관리해야 한다.

### 결정
- **서버 상태**: React Query (tickets, agents 목록)
- **클라이언트 상태**: Zustand (UI 상태, agent 실시간 상태)

### 근거
- React Query가 캐싱, 재요청, 에러 핸들링 자동 처리
- SSE 이벤트로 React Query 캐시 직접 업데이트 가능
- Zustand는 가볍고 boilerplate 최소
- 두 라이브러리 조합이 복잡도 대비 효율 최적
```

## Acceptance Criteria

```bash
# 문서 문법 오류 없음 확인 (마크다운 린트가 있다면)
# git diff로 변경 내용 확인
git diff --stat spec/
```

변경된 파일:
- `spec/architecture.md` — monorepo 구조, GUI 아키텍처 섹션 추가
- `spec/adr.md` — ADR-022 ~ ADR-025 추가

## AC 검증 방법

위 AC 커맨드를 실행하라. 문서가 정상적으로 수정되었으면 `/tasks/12-gui-dashboard/index.json`의 phase 0 status를 `"completed"`로 변경하라.

## 주의사항

- 기존 문서 내용을 삭제하지 마라. 새 섹션을 추가만 하라.
- ADR 번호가 기존 번호와 충돌하지 않는지 확인하라 (현재 ADR-021까지 존재할 것으로 예상).
- 마크다운 코드 블록 내부의 백틱은 이스케이프 처리에 주의하라.

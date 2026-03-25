# Design Decision Records

## DDR-001: 레이아웃 구조 — 2-Column (Slack 스타일)

**상태**: 확정 (2026-03-25)

**맥락**: GUI Dashboard 레이아웃을 Slack 스타일로 전환. 3-column(workspace + channels + main) vs 2-column(sidebar + main) 선택 필요.

**결정**: 2-Column 레이아웃 유지

**근거**:
- Workspace 개념이 없으므로 thin sidebar 불필요
- Sidebar에 네비게이션 + 에이전트 관리 페이지 링크로 충분
- 복잡도 최소화

---

## DDR-002: 사이드바 콘텐츠 구성 — Mixed Navigation

**상태**: 확정 (2026-03-25)

**맥락**: 사이드바에 에이전트 목록을 직접 표시할 것인가, 페이지 네비게이션만 표시할 것인가.

**결정**: 상단에 페이지 네비게이션만 표시. 에이전트 목록은 별도 Agents 페이지에서 관리.

**근거**:
- 에이전트 필터링은 Kanban 보드의 필터 버튼으로 수행
- 사이드바에 에이전트 섹션 없이 깔끔한 네비게이션 유지
- 에이전트 목록 관리는 전용 페이지에서 CRUD

**네비게이션 구성**:
- Home (Kanban 대시보드)
- Agents (에이전트 목록 관리)
- Subagents
- Skills
- Webhooks

---

## DDR-003: 아이콘 시스템 — Lucide React

**상태**: 확정 (2026-03-25)

**맥락**: 기존 emoji(📦, ⚡, 🔗) 사용에서 아이콘 라이브러리로 전환.

**결정**: Lucide React 사용. Emoji 절대 금지.

**근거**:
- Notion/Tally 스타일의 깔끔한 모노톤 디자인
- 일관된 아이콘 스타일 (stroke width, size)
- 넓은 아이콘 선택지
- Notion이 사용하는 스타일과 유사

---

## DDR-004: 색상 시스템 — Status 100/400 규칙

**상태**: 확정 (2026-03-25)

**맥락**: 상태별 색상 표현 방식을 통일해야 함. 절제된 색상 사용이 핵심.

**결정**: 배경색은 100, 강조/텍스트는 400 사용

### Ticket 상태 색상

| Status | Background | Accent/Text | 용도 |
|--------|------------|-------------|------|
| blocked | `red-100` | `red-400` | 대기 중 (cc 확인 필요) |
| ready | `blue-100` | `blue-400` | 작업 가능 |
| in_progress | `yellow-100` | `yellow-400` | 작업 중 |
| completed | `green-100` | `green-400` | 완료 |
| failed | `red-100` | `red-400` | 실패 |
| cancelled | `gray-100` | `gray-400` | 취소됨 |

### Agent 상태 색상

| Status | Background | Accent/Text | 용도 |
|--------|------------|-------------|------|
| idle | `gray-100` | `gray-400` | 대기 중 |
| working | `green-100` | `green-400` | 작업 중 |
| offline | `red-100` | `red-400` | 오프라인 |

### 우선순위 색상

| Priority | Background | Accent/Text | 용도 |
|----------|------------|-------------|------|
| critical | `red-100` | `red-400` | 긴급 |
| high | `orange-100` | `orange-400` | 높음 |
| medium | `blue-100` | `blue-400` | 보통 |
| low | `gray-100` | `gray-400` | 낮음 |

**근거**:
- 100 레벨은 충분히 연해서 배경으로 적합
- 400 레벨은 가독성 확보하면서 과하지 않은 강조
- Tailwind 기본 팔레트 활용으로 일관성 유지

---

## DDR-005: 인터랙션 스타일 — Notion/Tally 패턴

**상태**: 확정 (2026-03-25)

**맥락**: hover, 선택 상태 등 인터랙션 시각 피드백 방식 정의.

**결정**: Notion 스타일 인터랙션 패턴 적용

### Hover 효과
- 배경색: `hover:bg-gray-50`
- 전환: `transition-colors duration-150`
- Border: 변경 없음

### 선택 상태 (Active/Selected)
- 배경색: `bg-blue-50`
- 왼쪽 accent bar: `border-l-2 border-blue-400`
- 텍스트: 기본 색상 유지 (과한 강조 지양)

### Focus 상태
- Ring 대신 subtle outline: `focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-300`

**근거**:
- Notion의 절제된 시각 피드백 철학
- 왼쪽 accent bar는 현재 위치를 명확히 표시하면서 과하지 않음
- 색상 변화는 최소화하고 배경만 변경

---

## DDR-006: Shadow 정책 — 최소 사용

**상태**: 확정 (2026-03-25)

**맥락**: Notion/Tally 스타일은 shadow를 거의 사용하지 않음.

**결정**: Shadow 최소화. Border 기반 구분.

### Shadow 사용 케이스

| 요소 | Shadow | Border |
|------|--------|--------|
| 일반 카드 | 없음 | `border border-gray-200` |
| 모달/다이얼로그 | `shadow-lg` | 없음 |
| 드롭다운/팝오버 | `shadow-md` | `border border-gray-200` |
| Hover 카드 | 없음 | 유지 |

**근거**:
- Notion은 대부분 flat design, border로 구분
- Shadow는 레이어 구분이 필수인 경우만 (modal, dropdown)
- 절제된 시각적 깊이감

---

## DDR-007: 타이포그래피 — 시스템 폰트 스택

**상태**: 확정 (2026-03-25)

**맥락**: 폰트 선택. 웹폰트 로딩 vs 시스템 폰트.

**결정**: Tailwind 기본 시스템 폰트 스택 사용

**근거**:
- 추가 네트워크 요청 없음
- 각 OS에서 최적화된 폰트 렌더링
- Notion도 시스템 폰트 사용

### 폰트 크기 체계

| 용도 | Class | Size |
|------|-------|------|
| 페이지 제목 | `text-xl font-semibold` | 20px |
| 섹션 제목 | `text-lg font-medium` | 18px |
| 본문 | `text-sm` | 14px |
| 보조 텍스트 | `text-xs text-gray-500` | 12px |
| 라벨 | `text-xs font-medium uppercase tracking-wider` | 12px |

---

## DDR-008: 컬러 팔레트 — 모노톤 베이스

**상태**: 확정 (2026-03-25)

**맥락**: 전체 UI 색상 톤 정의.

**결정**: Gray 베이스 모노톤 + Status 색상만 예외

### 기본 팔레트

| 용도 | Color |
|------|-------|
| 배경 (페이지) | `white` 또는 `gray-50` |
| 배경 (사이드바) | `white` |
| 텍스트 (기본) | `gray-900` |
| 텍스트 (보조) | `gray-500` |
| Border | `gray-200` |
| Divider | `gray-100` |
| Hover 배경 | `gray-50` |
| 선택 배경 | `blue-50` |

### 사용 금지
- 순수 black (`#000`) — `gray-900` 사용
- 화려한 gradient
- 복수 accent 색상 동시 사용

**근거**:
- Notion/Tally의 미니멀 디자인 철학
- 색상은 정보 전달 목적으로만 사용
- 시각적 노이즈 최소화

---

## DDR-009: 기능 구현 원칙 — YAGNI

**상태**: 확정 (2026-03-25)

**맥락**: UI 기능 추가 시 "있으면 좋을 것 같은" 기능들이 범위를 확장시킴.

**결정**: YAGNI (You Aren't Gonna Need It) 원칙 엄격 적용

### 규칙
1. **실제 필요가 느껴질 때만 구현** — 예측적 구현 금지
2. **최소 기능으로 시작** — 사용하면서 불편함이 체감될 때 확장
3. **placeholder 허용** — 메뉴는 있지만 내용 미구현 상태 OK

### 예시: 배제 대상
- 사이드바 collapse/expand 기능
- 다크 모드
- 키보드 단축키
- 드래그 앤 드롭 정렬
- 애니메이션 효과
- 반응형 모바일 레이아웃

### 예시: 허용 대상
- 핵심 네비게이션
- 기본 상태 표시
- 필수 CRUD (필요한 페이지만)

**근거**:
- 구현 비용 최소화
- 유지보수 부담 감소
- 실제 사용 패턴 기반 우선순위 결정
- "좋아 보이는" 기능이 실제로 쓰이지 않는 경우가 대부분

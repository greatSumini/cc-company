### Insights

- [2026-03-18] cc-company는 Claude Code를 "회사처럼" 운영하게 해주는 오픈소스. 핵심 추상화는 `agent`(직무 단위), subagent/skills/hooks를 agent별로 묶는 구조.
- [2026-03-18] 핵심 가치제안: "CEO처럼 목표만 제시하면 AI agent가 알아서 실행". 대시보드로 진행상황 확인 + 피드백.
- [2026-03-18] 목표: YC Batch 지원 전 시장 검증. 2주 내 런칭 필수.
- [2026-03-18] 기본 agent 유형: 개발자, 디자이너, HR.

- [2026-03-19] 핵심 가설 A: "Claude Code 유저는 직무별 agent 분리를 원한다" → CLI MVP로 검증
- [2026-03-19] 검증 기준: 설치 유저 중 30%+가 agent 2개 이상 사용
- [2026-03-19] subagent/skills는 agent와 lifecycle이 다름 → 공용 풀 + 참조 구조로 결정
- [2026-03-19] 아키텍처/ADR 상세 내용은 /docs/architecture.md, /docs/adr.md 참조

### Gotchas


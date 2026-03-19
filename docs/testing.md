# cc-company Testing Strategy

## 원칙

- **순수 로직에 집중**: mock으로 접착제 코드를 테스트하지 않는다. 구현을 두 번 쓰는 것이지 동작을 검증하는 게 아니다.
- **커버리지 숫자 목표 없음**: 숫자를 채우기 위한 mock 테스트 양산은 시간 낭비. 깨지면 치명적인 분기만 커버.
- **구현과 테스트를 함께 작성**: 모듈 구현 직후 해당 테스트를 작성한다. 일괄 작성 금지.

## 도구

- **vitest** — TypeScript 네이티브, 설정 최소, 속도 빠름

## 테스트 범위

| 모듈 | 테스트 유형 | 수준 | 이유 |
|---|---|---|---|
| flag-builder | 유닛 | 철저히 | 변환 로직이 틀리면 claude가 엉뚱하게 실행됨 |
| frontmatter (utils) | 유닛 | 철저히 | 파싱이 틀리면 prompt가 통째로 날아감 |
| store (fs-store) | 통합 | 핵심 경로 | 파일 I/O는 실제로 돌려봐야 의미 있음 |
| services | 유닛 | 핵심 분기만 | 리소스 없을 때 에러, assign 자동 생성 등 |
| commands | 없음 | - | commander 파싱은 프레임워크 책임 |
| spawner | 없음 | - | child_process mock은 가치 없음. dry-run으로 수동 검증 |
| logger | 없음 | - | JSON 직렬화를 테스트할 이유 없음 |
| E2E | 없음 | - | claude CLI spawn은 API 비용, 인증 문제로 ROI 없음 |

## 테스트하지 않는 것들

| 모듈 | 대체 수단 |
|---|---|
| commands/ | service 테스트에서 간접 커버. commander는 프레임워크 신뢰 |
| spawner | dry-run 모드로 최종 명령어 출력 → 수동 검증 |
| logger | JSON.stringify + fs.writeFile. 깨질 게 없다 |
| E2E (claude 실제 실행) | dry-run + flag-builder 테스트로 대체 |

## 구현-테스트 작성 순서

테스트는 해당 모듈 구현 직후 바로 작성한다. 구현 계획에 테스트 작성 시점이 명시된다.

```
Phase 1: types → store 구현 → store 테스트
Phase 2: flag-builder 구현 → flag-builder 테스트
Phase 3: services 구현 → services 테스트
Phase 4: claude-runner, logger, commands (테스트 없음)
```

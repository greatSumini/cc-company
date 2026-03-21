# Phase 5: 템플릿 + 최종 검증

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/tasks/4-skill-directory/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/store/fs-store.ts` (createSkill이 디렉토리 생성)
- `/src/templates/` (기존 init 템플릿 구조)
- `/src/commands/init.ts` (init 커맨드 구현)
- 모든 테스트 파일 (`/tests/` 하위 전체)

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

### 1. 템플릿 업데이트 — `src/templates/`

`cc-company init` 시 생성되는 기본 skill 템플릿을 디렉토리 형식으로 변경.

기존에 `.cc-company/skills/` 아래에 단일 `.md` 파일로 생성되는 기본 skill들이 있다면, 이를 디렉토리 형식으로 전환:

**예시 — 기존:**
```
templates/skills/deploy.md
```

**변경 후:**
```
templates/skills/deploy/SKILL.md
templates/skills/deploy/scripts/      (빈 디렉토리 — git은 빈 디렉토리를 추적하지 않으므로 .gitkeep 사용)
templates/skills/deploy/references/
templates/skills/deploy/assets/
```

빈 디렉토리에는 `.gitkeep` 파일을 넣어 git에서 추적되도록 하라.

init 커맨드(`src/commands/init.ts`)에서 templates를 복사하는 로직이 있다면, 디렉토리 복사가 정상 동작하는지 확인하라. `fs.cpSync({ recursive: true })` 사용.

만약 init이 store의 `createSkill()`을 호출하여 생성하는 방식이라면 (template 파일 복사가 아닌), 이미 Phase 2에서 `createSkill`이 디렉토리를 생성하도록 변경되었으므로 init 코드 변경은 불필요할 수 있다. 현재 코드를 읽고 판단하라.

### 2. 최종 테스트 검증

모든 테스트를 실행하여 전체 통과 확인:

```bash
npm run build
npm test
```

실패하는 테스트가 있다면 원인을 파악하고 수정하라. 특히:

- 기존 agent.service 테스트에서 skill assign/unassign이 디렉토리 기반 store와 호환되는지
- 기존 run.service 테스트에서 skill 없는 agent의 동작이 변경되지 않았는지
- init 관련 테스트가 있다면 디렉토리 형식으로 정상 생성되는지

### 3. `.cc-company/` 예시 디렉토리 업데이트

프로젝트 루트에 예시로 존재하는 `.cc-company/skills/` 아래의 단일 `.md` 파일들이 있다면, 디렉토리 형식으로 변환하라. 이는 마이그레이션 로직이 처리할 수 있지만, 레포에 커밋되는 예시는 최신 형식이어야 한다.

## Acceptance Criteria

```bash
npm run build # 컴파일 에러 없음
npm test # 모든 테스트 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/4-skill-directory/index.json`의 phase 5 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 이 phase는 마무리 단계다. 새로운 기능을 추가하지 마라.
- `.gitkeep` 파일은 빈 디렉토리 추적용이다. 내용은 빈 파일.
- 기존 테스트를 깨뜨리지 마라.
- init이 template 복사 방식이 아닌 store API 호출 방식이라면, template 파일 변경은 불필요. 코드를 읽고 판단하라.

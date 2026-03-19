# Phase 3: 서비스 + 커맨드 + 템플릿 전환 + 테스트 갱신

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/docs/adr.md`
- `/tasks/2-frontmatter-md/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/types/index.ts` (SubagentConfig, SkillConfig 확장)
- `/src/utils/frontmatter.ts` (파서/직렬화 유틸)
- `/src/store/fs-store.ts` (subagent/skill이 .md로 전환됨)
- `/tests/store/fs-store.test.ts` (갱신된 테스트)

그리고 아래 파일들도 반드시 읽어라:

- `/src/services/agent.service.ts`
- `/src/services/resource.service.ts`
- `/src/services/run.service.ts`
- `/src/commands/subagent.ts`
- `/src/commands/skill.ts`
- `/src/templates/index.ts`
- `/src/claude-runner/flag-builder.ts`
- `/tests/services/agent.service.test.ts`
- `/tests/services/resource.service.test.ts`
- `/tests/services/run.service.test.ts`
- `/tests/claude-runner/flag-builder.test.ts`

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

### 1. 서비스 레이어 점검

**`/src/services/resource.service.ts`:**
- `createSubagent(name, description, prompt)` → `store.createSubagent({ name, description, prompt })` 호출. store가 내부적으로 `.md`로 직렬화하므로 서비스 코드 변경 불필요.
- `createSkill(name, description, prompt)` → 동일. 변경 불필요.
- **확인만 하고 변경하지 마라.** 이미 동작해야 한다.

**`/src/services/agent.service.ts`:**
- `assignSubagent`에서 공용 풀에 없을 때 빈 템플릿 생성: `store.createSubagent({ name, description: '', prompt: '' })`. store가 `.md`로 직렬화하므로 변경 불필요.
- `assignSkill`도 동일. 변경 불필요.
- **확인만 하고 변경하지 마라.**

**`/src/services/run.service.ts`:**
- `resolveSubagents` 호출 → store가 `.md`에서 파싱하여 `SubagentConfig` 반환. `flag-builder`에 동일한 인터페이스로 전달. 변경 불필요.
- **확인만 하고 변경하지 마라.**

### 2. 커맨드 레이어 점검

**`/src/commands/subagent.ts`:**
- `add` 커맨드: `ctx.resourceService.createSubagent(name, options.description, options.prompt)` 호출. 변경 불필요.
- **확인만 하고 변경하지 마라.**

**`/src/commands/skill.ts`:**
- 동일. 변경 불필요.
- **확인만 하고 변경하지 마라.**

### 3. `/src/templates/index.ts` 점검

- `subagentTemplates`와 `skillTemplates`는 `SubagentConfig[]`과 `SkillConfig[]` 타입. optional 필드가 추가되었지만 기존 필드만 사용 중이므로 변경 불필요.
- **확인만 하고 변경하지 마라.**

### 4. `/src/claude-runner/flag-builder.ts` 점검

- `buildSubagentsJson` 함수: `subagent.name`, `subagent.description`, `subagent.prompt`만 사용. 인터페이스 동일하므로 변경 불필요.
- **확인만 하고 변경하지 마라.**

### 5. 테스트 갱신

**대부분의 테스트는 변경 불필요.** store API를 통해 subagent/skill을 생성하고, store API로 읽는 구조이므로 `.md` 전환은 store 내부 구현 디테일이다.

단, 테스트 중 `.json` 파일의 존재를 직접 확인하는 assertion이 있으면 `.md`로 변경해야 한다.

**`/tests/services/agent.service.test.ts`:**
- `공용 풀에 없는 리소스 assign → 공용 풀에 생성` 테스트: `subagent.prompt`가 빈 문자열인지 확인하는 assertion이 있다. store가 `.md`로 저장하고 `.md`에서 파싱하므로, 빈 body는 `prompt: ''`로 파싱되어야 한다. 그대로 통과해야 하지만 확인하라.
- 만약 실패하면: frontmatter 파서가 빈 body를 `''`로 반환하는지 확인하고, 필요 시 `frontmatter.ts`의 trim 로직을 점검하라.

**`/tests/services/resource.service.test.ts`:**
- `createSubagent`/`createSkill` 호출 후 store를 통해 확인. store API 동일하므로 변경 불필요.

**`/tests/services/run.service.test.ts`:**
- `store.createSubagent({ name, description, prompt })` 호출하는 부분. store가 `.md`로 저장하므로 변경 불필요.

**`/tests/claude-runner/flag-builder.test.ts`:**
- `SubagentConfig` 리터럴을 직접 만들어서 `buildFlags`에 전달. store를 거치지 않으므로 변경 불필요.

**작업 요약:** 모든 파일을 읽고 확인한 뒤, 만약 `.json` 파일 경로를 직접 참조하는 테스트 assertion이 있으면 `.md`로 변경하라. 그 외에는 변경하지 마라. 모든 테스트가 통과하는지 `npm test`로 검증하라.

## Acceptance Criteria

```bash
npm run build # 컴파일 에러 없음
npm test # 모든 테스트 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/2-frontmatter-md/index.json`의 phase 3 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 이 phase는 대부분 "점검 + 확인"이다. 불필요한 코드 변경을 하지 마라.
- 변경이 필요한 것은 테스트에서 `.json` 파일 경로를 직접 참조하는 assertion뿐이다.
- `flag-builder.ts`, `run.service.ts`, `resource.service.ts`, `agent.service.ts`, commands, templates를 수정하지 마라.
- 기존 테스트를 깨뜨리지 마라.

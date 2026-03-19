# Phase 2: fs-store 전환 + 테스트 갱신

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/docs/adr.md`
- `/tasks/2-frontmatter-md/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/types/index.ts` (SubagentConfig, SkillConfig에 optional 필드 추가됨)
- `/src/utils/frontmatter.ts` (parseSubagentMd, parseSkillMd, serializeSubagentMd, serializeSkillMd)
- `/tests/utils/frontmatter.test.ts`

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

### 1. `/src/store/fs-store.ts` 수정

subagent와 skill의 저장/로드 로직을 `.json`에서 `.md`(frontmatter)로 전환하라.

**Subagent 메서드 변경:**

- `getSubagent(name)`: 파일 경로를 `subagents/${name}.json` → `subagents/${name}.md`로 변경. `JSON.parse` 대신 `parseSubagentMd(fs.readFileSync(...))`를 사용.
- `listSubagents()`: `.json` 필터 → `.md` 필터로 변경. 파일명에서 `.md`를 제거하여 name 추출.
- `createSubagent(config)`: `JSON.stringify(config)` 대신 `serializeSubagentMd(config)`로 직렬화하여 `.md` 파일로 저장.
- `removeSubagent(name)`: 파일 경로를 `.json` → `.md`로 변경.

**Skill 메서드 변경:**

- `getSkill(name)`: 동일 패턴. `parseSkillMd` 사용.
- `listSkills()`: `.json` → `.md` 필터.
- `createSkill(config)`: `serializeSkillMd` 사용.
- `removeSkill(name)`: `.json` → `.md`.

**핵심 규칙:**
- import를 추가하라: `import { parseSubagentMd, parseSkillMd, serializeSubagentMd, serializeSkillMd } from '../utils/frontmatter.js'`
- Hook 관련 메서드는 절대 변경하지 마라. Hook은 JSON 유지.
- Agent 관련 메서드(getAgent, createAgent 등)도 변경하지 마라. Agent는 별도 `agent.json` + `prompt.md` 구조 유지.
- `IStore` 인터페이스(`store.ts`)는 변경 불필요. 메서드 시그니처는 동일하다.

### 2. `/tests/store/fs-store.test.ts` 갱신

기존 subagent/skill 관련 테스트를 `.md` 기반으로 수정하라.

**변경해야 할 테스트:**

**`공용 리소스 CRUD - Subagent` 블록:**
- `createSubagent → .cc-company/subagents/ 에 파일 생성`: 파일 경로 확인을 `.json` → `.md`로 변경. 파일 내용이 JSON이 아닌 frontmatter+body 형식인지 검증 추가 (내용에 `---`가 포함되고, name/description이 frontmatter에, prompt가 body에 있는지 확인).
- `listSubagents → 전체 목록`: 내부 로직은 store API를 통하므로 변경 불필요. 그대로 통과해야 함.
- `removeSubagent → 파일 삭제`: 파일 경로를 `.json` → `.md`로 변경.
- `존재하지 않는 리소스 get → 에러`: 변경 불필요.

**`공용 리소스 CRUD - Skill` 블록:**
- `createSkill → skills 디렉토리에 파일 생성`: `.json` → `.md`로 변경.
- `removeSkill → 파일 삭제`: `.json` → `.md`로 변경.
- 나머지는 변경 불필요.

**`참조 해석` 블록:**
- 기존 테스트는 `store.createSubagent()`로 데이터를 넣고 `resolveSubagents()`로 읽는 구조. store API가 동일하므로 테스트 코드 변경 불필요. 그대로 통과해야 함.

**Hook, Agent, RunLog, ProjectConfig 관련 테스트는 절대 변경하지 마라.**

## Acceptance Criteria

```bash
npm run build # 컴파일 에러 없음
npm test # 모든 테스트 통과 (기존 + frontmatter 유틸 + 갱신된 fs-store 테스트)
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/2-frontmatter-md/index.json`의 phase 2 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- Hook 메서드를 수정하지 마라. Hook은 JSON 유지.
- Agent 메서드를 수정하지 마라. Agent는 `agent.json` + `prompt.md` 구조 유지.
- `IStore` 인터페이스 파일(`src/store/store.ts`)을 수정하지 마라.
- 기존 Hook/Agent/RunLog/ProjectConfig 테스트를 깨뜨리지 마라.
- `resolveSubagents`/`resolveSkills` 메서드는 내부적으로 `getSubagent`/`getSkill`을 호출하므로 자동으로 전환된다. 별도 수정 불필요.

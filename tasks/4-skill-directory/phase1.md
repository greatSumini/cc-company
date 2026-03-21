# Phase 1: Types + IStore 인터페이스 + frontmatter utils

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/docs/adr.md`
- `/tasks/4-skill-directory/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 아래 소스 파일들을 반드시 읽어라:

- `/src/types/index.ts`
- `/src/store/store.ts`
- `/src/utils/frontmatter.ts`
- `/tests/utils/frontmatter.test.ts`

## 작업 내용

### 1. `src/types/index.ts` — SkillConfig에 resources 추가

```typescript
export interface SkillConfig {
  name: string
  description: string
  prompt: string
  resources?: string[]  // 보조 파일 상대경로 목록 (SKILL.md 기준)
  // 기존 optional 필드 유지
  model?: string
  allowedTools?: string
  context?: string
  agent?: string
  userInvocable?: boolean
  disableModelInvocation?: boolean
  argumentHint?: string
}
```

`FlagBuilderInput`에서 `pluginDirPath` 필드를 제거하고 `addDirPath`를 추가:

```typescript
export interface FlagBuilderInput {
  agent: AgentConfig
  promptFilePath: string
  subagents?: SubagentConfig[]
  settingsFilePath?: string
  mcpConfigFilePath?: string
  addDirPath?: string          // --add-dir 경로 (skills 임시 디렉토리)
  prompt?: string
  passthroughFlags: string[]
}
```

### 2. `src/store/store.ts` — IStore에 skill file 메서드 추가

기존 skill 메서드(getSkill, listSkills, createSkill, removeSkill) 유지. 아래 메서드 추가:

```typescript
// Skill file operations
addSkillFile(skillName: string, filePath: string, content: string): void
editSkillFile(skillName: string, filePath: string, content: string): void
removeSkillFile(skillName: string, filePath: string): void
getSkillFile(skillName: string, filePath: string): string
getSkillDir(skillName: string): string
```

### 3. `src/utils/frontmatter.ts` — resources 필드 지원

`parseSkillMd` 함수에서 `resources` 필드를 파싱:

```typescript
// parsed.data에서 resources 추출
const { ..., resources } = parsed.data as Record<string, unknown>

return {
  ...,
  resources: resources as string[] | undefined,
}
```

`serializeSkillMd` 함수에서 `resources` 필드를 직렬화:

```typescript
// optional 필드 추가
if (config.resources !== undefined && config.resources.length > 0) {
  frontmatterData.resources = config.resources
}
```

### 4. 테스트 작성 — `tests/utils/frontmatter.test.ts`

기존 테스트 파일에 아래 테스트 케이스를 추가:

```
[파싱 - Skill / resources]
✓ resources 배열 포함된 frontmatter → resources 필드 정상 파싱
✓ resources 미포함 → resources는 undefined

[직렬화 - Skill / resources]
✓ resources 있는 SkillConfig serialize → parse → 원본과 동일 (round-trip)
✓ resources가 undefined → 직렬화 시 resources 키 생략
```

테스트 작성 시 기존 테스트 파일의 패턴과 스타일을 정확히 따라라. 한글 describe, 조건→결과 형식 it.

## Acceptance Criteria

```bash
npm run build # 컴파일 에러 없음
npm test # 모든 테스트 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/4-skill-directory/index.json`의 phase 1 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- `FlagBuilderInput`에서 `pluginDirPath`를 제거하면 `flag-builder.ts`와 `run.service.ts`에서 컴파일 에러가 발생한다. 이 phase에서는 해당 파일들의 참조도 함께 수정하여 빌드가 통과하도록 하라. 단, flag-builder의 `--plugin-dir` 로직을 `--add-dir`로 교체하고, run.service의 `pluginDirPath` 참조를 `addDirPath`로 변경하라. 상세 로직(임시 디렉토리 생성 등)은 Phase 4에서 구현한다.
- 기존 frontmatter 테스트를 깨뜨리지 마라.
- `IStore` 인터페이스에 메서드를 추가하면 `FsStore`에서 컴파일 에러가 발생한다. 이 phase에서는 `FsStore`에 stub 구현(throw new Error('Not implemented'))을 넣어 빌드만 통과하게 하라. 실제 구현은 Phase 2에서 한다.

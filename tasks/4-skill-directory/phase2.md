# Phase 2: fs-store 디렉토리 기반 Skill 구현 + 마이그레이션

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/docs/adr.md`
- `/tasks/4-skill-directory/docs-diff.md` (이번 task의 문서 변경 기록)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `/src/types/index.ts` (SkillConfig.resources, FlagBuilderInput.addDirPath)
- `/src/store/store.ts` (IStore 신규 메서드)
- `/src/utils/frontmatter.ts` (resources 파싱/직렬화)
- `/src/store/fs-store.ts` (현재 stub 상태인 신규 메서드들)
- `/tests/store/fs-store.test.ts` (기존 테스트 패턴 파악)

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

### 1. fs-store.ts — 기존 Skill 메서드를 디렉토리 기반으로 전환

**`getSkill(name)`**:
- 먼저 마이그레이션 체크 수행 (아래 섹션 참조)
- `skills/{name}/SKILL.md` 경로에서 읽기
- `parseSkillMd()`로 파싱하여 반환

**`listSkills()`**:
- `skills/` 내 디렉토리를 순회 (기존: `.md` 파일 필터 → 변경: `isDirectory()` 필터)
- 각 디렉토리에서 `getSkill()` 호출

**`createSkill(config)`**:
- `skills/{name}/` 디렉토리 생성
- `SKILL.md` 작성 (`serializeSkillMd(config)`)
- 관례적 서브디렉토리 생성: `scripts/`, `references/`, `assets/` (빈 디렉토리)

**`removeSkill(name)`**:
- `skills/{name}/` 디렉토리 통째로 삭제 (`fs.rmSync({ recursive: true })`)

### 2. fs-store.ts — 신규 skill file 메서드 구현

Phase 1에서 stub으로 넣은 메서드들을 실제 구현으로 교체:

**`addSkillFile(skillName, filePath, content)`**:
1. skill 디렉토리 존재 확인 (없으면 에러)
2. 대상 파일의 부모 디렉토리 생성 (`fs.mkdirSync({ recursive: true })`)
3. 파일 쓰기
4. `SKILL.md` 읽기 → `parseSkillMd` → `resources` 배열에 `filePath` 추가 (중복 체크) → `serializeSkillMd` → 다시 쓰기

**`editSkillFile(skillName, filePath, content)`**:
1. skill 디렉토리 존재 확인
2. 대상 파일 존재 확인 (없으면 에러: `File not found: {filePath} in skill '{skillName}'`)
3. 파일 내용 덮어쓰기

**`removeSkillFile(skillName, filePath)`**:
1. skill 디렉토리 존재 확인
2. 대상 파일 존재 확인 (없으면 에러)
3. 파일 삭제
4. `SKILL.md` 읽기 → `resources` 배열에서 `filePath` 제거 → 다시 쓰기

**`getSkillFile(skillName, filePath)`**:
1. 파일 읽어서 내용 반환

**`getSkillDir(skillName)`**:
1. `path.join(this.rootPath, 'skills', skillName)` 반환 (존재 여부 확인 포함)

### 3. 마이그레이션 로직

`getSkill()` 진입 시, `skills/{name}` 경로가 디렉토리가 아닌 파일(`.md`)인지 체크:

```typescript
// [MIGRATION v0.3] 단일 .md → 디렉토리 전환. 안정화 후 삭제 예정
private migrateSkillIfNeeded(name: string): void {
  const legacyPath = path.join(this.rootPath, 'skills', `${name}.md`)
  const dirPath = path.join(this.rootPath, 'skills', name)

  if (fs.existsSync(legacyPath) && !fs.existsSync(dirPath)) {
    // 단일 .md → 디렉토리로 변환
    const content = fs.readFileSync(legacyPath, 'utf-8')
    fs.mkdirSync(dirPath, { recursive: true })
    fs.writeFileSync(path.join(dirPath, 'SKILL.md'), content)
    // 관례적 서브디렉토리 생성
    fs.mkdirSync(path.join(dirPath, 'scripts'), { recursive: true })
    fs.mkdirSync(path.join(dirPath, 'references'), { recursive: true })
    fs.mkdirSync(path.join(dirPath, 'assets'), { recursive: true })
    // 원본 삭제
    fs.unlinkSync(legacyPath)
    console.log(`Migrated skill '${name}' from .md to directory format.`)
  }
}
```

`listSkills()`에서도 마이그레이션 수행: 디렉토리 순회 전에 `skills/` 내 `.md` 파일을 먼저 스캔하여 모두 마이그레이션.

### 4. 테스트 작성 — `tests/store/fs-store.test.ts`

기존 Skill CRUD 테스트 4개를 디렉토리 기반으로 교체하고, 파일 CRUD + 마이그레이션 테스트를 추가:

```
[Skill 디렉토리 CRUD]
✓ createSkill → skills/{name}/ 디렉토리 + SKILL.md + 서브디렉토리 스캐폴딩 생성
✓ getSkill → 디렉토리 내 SKILL.md 파싱하여 SkillConfig 반환
✓ listSkills → 디렉토리 순회로 전체 목록 반환
✓ removeSkill → 디렉토리 통째로 삭제
✓ 존재하지 않는 skill getSkill → 에러

[Skill 파일 CRUD]
✓ addSkillFile → 파일 생성 + SKILL.md resources에 자동 등록
✓ editSkillFile 존재하지 않는 파일 → 에러
✓ removeSkillFile → 파일 삭제 + resources에서 자동 제거
✓ removeSkillFile 존재하지 않는 파일 → 에러

[마이그레이션]
✓ skills/ 내 단일 .md 파일 → getSkill 시 디렉토리로 자동 변환 + 원본 제거
✓ 이미 디렉토리인 skill → 마이그레이션 스킵 (정상 동작)
```

기존 fs-store.test.ts의 패턴을 정확히 따라라:
- `beforeEach`에서 `fs.mkdtempSync`로 임시 디렉토리 생성 + 필요한 하위 디렉토리 구성
- `afterEach`에서 `fs.rmSync({ recursive: true, force: true })`로 정리
- `describe('[한글 카테고리]', () => { ... })` + `it('조건 → 결과', () => { ... })`

## Acceptance Criteria

```bash
npm run build # 컴파일 에러 없음
npm test # 모든 테스트 통과
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/4-skill-directory/index.json`의 phase 2 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 기존 Skill 관련 테스트는 단일 `.md` 기반이므로 디렉토리 기반으로 완전히 교체하라. 기존 테스트를 남겨두면 실패한다.
- 마이그레이션 코드에는 반드시 `// [MIGRATION v0.3]` 주석을 달아라.
- `resolveSkills()` 메서드도 디렉토리 기반 `getSkill()`을 호출하므로 자동으로 호환된다. 별도 수정 불필요.
- Subagent 관련 코드는 건드리지 마라. 이번 scope는 Skill만.
- 기존 테스트(subagent, hook, agent, run.service 등)를 깨뜨리지 마라.

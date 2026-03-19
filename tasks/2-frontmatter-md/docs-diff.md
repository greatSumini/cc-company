# docs-diff: frontmatter-md

Baseline: `9fb8d41`

## `docs/adr.md`

```diff
diff --git a/docs/adr.md b/docs/adr.md
index fb112db..911d92a 100644
--- a/docs/adr.md
+++ b/docs/adr.md
@@ -165,3 +165,21 @@
 - ADR-003에서 "패스스루 전략"을 확정했지만, `-p`는 cc-company 자체의 동작 분기에 필요한 유일한 flag. 패스스루 원칙을 깨는 것이 아니라, "인식 + 전달"의 하이브리드 접근.
 - interactive mode는 Claude Code의 핵심 UX. 이를 지원하지 않으면 cc-company의 가치가 print mode에만 한정됨.
 - prompt optional화로 `cc-company run developer`라는 최소 입력으로 agent를 실행할 수 있어 DX 향상.
+
+---
+
+## ADR-012: Subagent/Skill 저장 형식을 JSON에서 Frontmatter MD로 전환
+
+**상태**: 확정 (2026-03-19)
+
+**맥락**: subagent/skill 리소스의 저장 형식을 `.json`에서 YAML frontmatter를 포함한 `.md` 파일로 변경한다.
+
+**결정**: prompt 필드가 JSON 문자열로 저장되면 가독성이 극히 떨어진다. 마크다운 본문으로 관리하면 IDE에서 넓게 보고 편집할 수 있다.
+
+**구현**:
+- frontmatter (YAML, `---` 구분자): `name`, `description`, 그리고 Claude Code 호환 optional 필드들 (`model`, `tools`, `disallowedTools`, `maxTurns`, `permissionMode` 등)
+- 마크다운 본문: 기존 `prompt` 필드의 내용. 런타임에서 파싱하여 `SubagentConfig.prompt`로 주입.
+- 파싱 라이브러리: `gray-matter` (dependencies)
+- Hook은 JSON 유지 (config 필드가 구조화된 JSON이므로 md 변환 부자연스러움)
+
+**영향**: `.cc-company/subagents/*.json` → `*.md`, `.cc-company/skills/*.json` → `*.md`. 런타임 인터페이스(SubagentConfig, SkillConfig) 유지.
```

## `docs/architecture.md`

```diff
diff --git a/docs/architecture.md b/docs/architecture.md
index 9b6866c..98b5100 100644
--- a/docs/architecture.md
+++ b/docs/architecture.md
@@ -6,6 +6,7 @@
 - **Language**: TypeScript
 - **CLI Parser**: commander
 - **Claude Code 연동**: child_process.spawn
+- **Frontmatter 파싱**: gray-matter
 - **배포**: npm
 
 ## 레이어 구조
@@ -51,7 +52,7 @@ interface IStore {
 }
 ```
 
-- **fs-store.ts** — 파일시스템 구현체 (MVP)
+- **fs-store.ts** — 파일시스템 구현체 (MVP). subagent/skill은 `.md` 파일을 `gray-matter`로 파싱하여 frontmatter → 메타데이터, body → prompt로 분리.
 - **api-store.ts** — HTTP API 구현체 (향후 대시보드 연동 시)
 
 ### Claude Runner
@@ -89,6 +90,8 @@ src/
 │   └── spawner.ts
 ├── logger/
 │   └── run-logger.ts
+├── utils/
+│   └── frontmatter.ts        # subagent/skill MD 파일의 파싱(parse*Md)과 직렬화(serialize*Md)
 ├── types/
 │   └── index.ts
 └── templates/                # init 시 복사할 기본 agent 템플릿
```

## `docs/spec.md`

```diff
diff --git a/docs/spec.md b/docs/spec.md
index 09e5147..5dbf1c6 100644
--- a/docs/spec.md
+++ b/docs/spec.md
@@ -101,6 +101,49 @@ cc-company hook add|list|remove <name>
 - 모든 리소스 필드는 optional
 - 값은 공용 풀의 리소스 이름(식별자) 배열
 
+## Subagent MD 형식
+
+YAML frontmatter + 마크다운 본문 구조:
+
+```markdown
+---
+name: git-expert
+description: Git 버전 관리 전문가
+model: sonnet          # optional
+tools: Read, Glob, Grep  # optional
+maxTurns: 10           # optional
+---
+
+You are a Git version control expert...
+```
+
+**필수 필드**: `name`, `description`
+**Optional 필드**: `model`, `tools`, `disallowedTools`, `maxTurns`, `permissionMode`
+
+## Skill MD 형식
+
+YAML frontmatter + 마크다운 본문 구조:
+
+```markdown
+---
+name: deploy
+description: 배포 프로세스 관리
+allowedTools: Bash, Read  # optional
+model: sonnet             # optional
+---
+
+# Deploy Skill
+
+Manages deployment processes...
+```
+
+**필수 필드**: `name`, `description`
+**Optional 필드**: `model`, `allowedTools`, `context`, `agent`, `userInvocable`, `disableModelInvocation`, `argumentHint`
+
+## Hook JSON 형식
+
+Hook은 config 필드가 구조화된 JSON이므로 `.json` 형식을 유지한다.
+
 ## 실행 로그 스키마
 
 ```json
```

## `docs/test-cases.md`

```diff
diff --git a/docs/test-cases.md b/docs/test-cases.md
index fd81635..ac6b34f 100644
--- a/docs/test-cases.md
+++ b/docs/test-cases.md
@@ -78,3 +78,21 @@ store는 in-memory fake 또는 실제 fs-store + 임시 디렉토리.
 ✓ spawner exitCode 0 → 로그에 정상 기록
 ✓ spawner exitCode 1 → 로그에 실패 기록 + exitCode 전파
 ```
+
+## frontmatter utils (유닛, ~8개)
+
+```
+[파싱 - subagent]
+✓ 정상적인 frontmatter + body → name, description, prompt 추출
+✓ optional 필드(model, tools, maxTurns) 포함 → 해당 필드 파싱
+✓ name 필드 누락 → 에러
+✓ frontmatter 없는 순수 마크다운 → 에러
+✓ 빈 body → prompt가 빈 문자열
+
+[파싱 - skill]
+✓ 정상적인 skill frontmatter + body → name, description, prompt 추출
+✓ skill optional 필드(allowedTools, context, agent) 포함 → 해당 필드 파싱
+
+[직렬화]
+✓ serialize 후 parse → 원본과 동일 (round-trip)
+```
```

## `docs/testing.md`

```diff
diff --git a/docs/testing.md b/docs/testing.md
index 234d6e2..1d49b4c 100644
--- a/docs/testing.md
+++ b/docs/testing.md
@@ -15,6 +15,7 @@
 | 모듈 | 테스트 유형 | 수준 | 이유 |
 |---|---|---|---|
 | flag-builder | 유닛 | 철저히 | 변환 로직이 틀리면 claude가 엉뚱하게 실행됨 |
+| frontmatter (utils) | 유닛 | 철저히 | 파싱이 틀리면 prompt가 통째로 날아감 |
 | store (fs-store) | 통합 | 핵심 경로 | 파일 I/O는 실제로 돌려봐야 의미 있음 |
 | services | 유닛 | 핵심 분기만 | 리소스 없을 때 에러, assign 자동 생성 등 |
 | commands | 없음 | - | commander 파싱은 프레임워크 책임 |
```

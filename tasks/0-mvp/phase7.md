# Phase 7: Templates

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:
- `/spec/spec.md` — 기본 agent 템플릿, .cc-company/ 구조
- `/spec/architecture.md` — 전체 구조
- `/spec/adr.md` — ADR-004 (공용 풀 + 참조)

그리고 이전 phase의 작업물을 반드시 확인하라:
- `src/commands/init.ts` — 현재 init 로직 (빈 구조 생성)
- `src/store/fs-store.ts` — 파일시스템 구조
- `src/types/index.ts` — AgentConfig, SubagentConfig 등 스키마

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라. 특히 init.ts가 현재 어떻게 구현되어 있는지 확인하고, 거기에 템플릿 복사 로직을 추가하라.

## 작업 내용

### 1. 템플릿 파일 생성

`src/templates/` 하위에 기본 agent 3종 + 공용 리소스를 정의한다.

#### 공용 Subagents

**git-expert**
```markdown
Git 버전 관리 전문가. 브랜치 전략, 커밋 메시지 작성, 충돌 해결, git 히스토리 분석 등을 담당한다.
복잡한 merge/rebase 상황에서 최적의 전략을 제시하고, 깨끗한 커밋 히스토리를 유지하도록 돕는다.
```

**code-reviewer**
```markdown
코드 리뷰 전문가. 코드 품질, 보안 취약점, 성능 이슈, 설계 패턴 위반 등을 식별한다.
단순한 스타일 지적이 아닌, 아키텍처와 비즈니스 로직 관점에서 의미 있는 피드백을 제공한다.
```

**ux-researcher**
```markdown
UX 리서치 전문가. 사용자 행동 분석, 인터뷰 설계, 사용성 테스트 계획 등을 담당한다.
데이터 기반의 UX 인사이트를 도출하고, 디자인 의사결정을 뒷받침하는 근거를 제공한다.
```

**recruiter**
```markdown
채용 전문가. 직무 기술서 작성, 면접 질문 설계, 후보자 평가 기준 수립 등을 담당한다.
조직 문화와 기술 요구사항을 균형 있게 고려한 채용 전략을 수립한다.
```

#### 공용 Skills

**deploy**
```markdown
배포 프로세스를 관리한다. CI/CD 파이프라인 설정, 배포 스크립트 작성, 롤백 계획 수립 등을 수행한다.
```

**design-system**
```markdown
디자인 시스템을 관리한다. 컴포넌트 라이브러리, 토큰, 스타일 가이드 등의 일관성을 유지한다.
```

**onboarding**
```markdown
신규 입사자 온보딩 프로세스를 관리한다. 온보딩 문서 작성, 체크리스트 관리, 멘토링 계획 수립 등을 수행한다.
```

#### Agent 정의

**developer**
- agent.json: `{ "name": "developer", "description": "소프트웨어 개발 전담 에이전트", "subagents": ["git-expert", "code-reviewer"], "skills": ["deploy"] }`
- prompt.md: 소프트웨어 개발자로서의 역할, 코드 품질 기준, 개발 원칙 등을 담은 시스템 프롬프트

**designer**
- agent.json: `{ "name": "designer", "description": "UI/UX 디자인 전담 에이전트", "subagents": ["ux-researcher"], "skills": ["design-system"] }`
- prompt.md: 디자이너로서의 역할, 디자인 원칙, 사용자 중심 사고 등을 담은 시스템 프롬프트

**hr**
- agent.json: `{ "name": "hr", "description": "인사/조직 관리 전담 에이전트", "subagents": ["recruiter"], "skills": ["onboarding"] }`
- prompt.md: HR 담당자로서의 역할, 조직 문화, 인사 정책 등을 담은 시스템 프롬프트

각 prompt.md는 해당 직무에 맞는 구체적이고 실용적인 시스템 프롬프트를 작성하라. 형식적인 내용이 아니라, Claude Code가 실제로 해당 직무를 수행할 때 유용한 지침이어야 한다.

### 2. init.ts 수정

현재 init.ts가 빈 구조만 만든다면, 다음을 추가하라:
1. `src/templates/`의 공용 리소스 파일들을 `.cc-company/subagents/`, `.cc-company/skills/`에 복사
2. 각 agent 디렉토리를 `.cc-company/agents/`에 복사
3. 복사가 아닌 **프로그래매틱 생성**도 괜찮다. 템플릿 내용을 코드에 하드코딩하는 방식. 어느 쪽이든 결과가 같으면 된다.

### 3. 템플릿 배포 고려

npm 패키지에 templates 디렉토리가 포함되어야 한다. package.json의 `files` 필드에 `dist/`, `templates/`를 포함하라. 또는 템플릿을 코드에 내장하면 이 문제가 사라진다.

## Acceptance Criteria

```bash
npm run build                                    # 컴파일 에러 없음
npm test                                         # 기존 테스트 모두 통과

# 기존 .cc-company가 있다면 삭제 후 테스트
rm -rf .cc-company
npx cc-company init                              # 초기화
ls .cc-company/agents/                           # developer, designer, hr 존재
ls .cc-company/subagents/                        # git-expert, code-reviewer, ux-researcher, recruiter 존재
ls .cc-company/skills/                           # deploy, design-system, onboarding 존재
cat .cc-company/agents/developer/agent.json      # subagents, skills 참조 확인
npx cc-company agent list                        # 3개 agent 표시
npx cc-company agent developer show              # subagents: git-expert, code-reviewer / skills: deploy
```

## AC 검증 방법

위 명령어를 순서대로 실행하라. 모두 성공하면 `/tasks/index.json`의 phase 7 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 템플릿 내용(프롬프트, 설명)은 한국어로 작성하라. 타겟 사용자가 한국어 사용자일 수 있으므로, 영어와 한국어 버전을 모두 고려하되 기본은 영어로 작성하라. 프롬프트 내용 자체는 영어가 Claude에게 더 효과적이다.
- prompt.md는 충분히 구체적이어야 한다. "당신은 개발자입니다" 수준의 한 줄짜리는 가치가 없다.
- agent.json의 리소스 참조가 실제 공용 풀 파일명과 정확히 일치하는지 확인하라.

# Phase 0: docs

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `/docs/spec.md`
- `/docs/architecture.md`
- `/prompts/task-create.md`
- `/.claude/commands/plan-and-build.md`

## 작업 내용

### 1. `/docs/spec.md` 업데이트

"실행 로그 스키마" 섹션 이후에 아래 내용을 추가:

```markdown
## Task Index 스키마

### `/tasks/index.json` (top-level)

\`\`\`json
{
  "repositoryUrl": "https://github.com/owner/repo",
  "tasks": [
    {
      "id": 0,
      "name": "mvp",
      "dir": "0-mvp",
      "status": "completed",
      "created_at": "2026-03-19T01:55:23+09:00",
      "completed_at": "2026-03-19T02:29:19+09:00",
      "pr_number": 1,
      "pr_url": "https://github.com/owner/repo/pull/1"
    }
  ]
}
\`\`\`

- `repositoryUrl`: GitHub repository URL. 최초 PR 생성 시 자동 추가.
- `pr_number`: PR 번호. PR 생성 시 자동 기록.
- `pr_url`: PR 전체 URL. PR 생성 시 자동 기록.
```

### 2. `/.claude/commands/plan-and-build.md` 업데이트

7번 단계를 아래와 같이 수정:

**기존:**
```
7. `scripts/run-phases.py` 완료 후 PR을 생성한다. `gh pr create`를 사용하되, 다음 원칙을 지켜라:
```

**변경:**
```
7. `scripts/run-phases.py` 완료 후 PR을 생성한다. `python3 scripts/create-pr.py`를 사용하되, 다음 원칙을 지켜라:
   - 본문이 한눈에 이해 가능한가: 의도, 변경 플로우, 아키텍처, 핵심 파일
   - 장황해서 핵심 파악이 어려운 것은 금물
   - commit history + message만으로 작업 흐름을 가늠할 수 있는가

   사용법:
   \`\`\`bash
   python3 scripts/create-pr.py <task-dir> --title "PR 제목" --body "PR 본문"
   \`\`\`

   스크립트가 자동으로:
   - gh_user 설정이 있으면 해당 계정으로 PR 생성
   - `/tasks/index.json`에 repositoryUrl, pr_number, pr_url 기록
```

## Acceptance Criteria

```bash
# 문서 변경 확인
grep -q "repositoryUrl" docs/spec.md
grep -q "pr_number" docs/spec.md
grep -q "create-pr.py" .claude/commands/plan-and-build.md
```

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/8-pr-tracking/index.json`의 phase 0 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 기존 문서 내용을 삭제하지 마라. 새 섹션을 추가하거나 특정 부분만 수정하라.
- 마크다운 코드 블록 안의 백틱은 이스케이프(`\``)하지 않아도 된다. 실제 문서에는 정상 백틱으로 작성하라.

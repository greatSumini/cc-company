import { describe, it, expect } from 'vitest'
import {
  parseSubagentMd,
  parseSkillMd,
  serializeSubagentMd,
  serializeSkillMd,
} from '../../src/utils/frontmatter'

describe('frontmatter utils', () => {
  describe('[파싱 - subagent]', () => {
    it('정상적인 frontmatter + body → name, description, prompt 추출', () => {
      const content = `---
name: git-expert
description: Git 버전 관리 전문가
---

You are a Git version control expert.
Help users with git commands and best practices.`

      const result = parseSubagentMd(content)

      expect(result.name).toBe('git-expert')
      expect(result.description).toBe('Git 버전 관리 전문가')
      expect(result.prompt).toBe(
        'You are a Git version control expert.\nHelp users with git commands and best practices.'
      )
    })

    it('optional 필드(model, tools, maxTurns) 포함 → 해당 필드 파싱', () => {
      const content = `---
name: code-reviewer
description: 코드 리뷰 전문가
model: sonnet
tools: Read, Glob, Grep
disallowedTools: Write, Bash
maxTurns: 10
permissionMode: auto
---

You are a code review expert.`

      const result = parseSubagentMd(content)

      expect(result.name).toBe('code-reviewer')
      expect(result.description).toBe('코드 리뷰 전문가')
      expect(result.model).toBe('sonnet')
      expect(result.tools).toBe('Read, Glob, Grep')
      expect(result.disallowedTools).toBe('Write, Bash')
      expect(result.maxTurns).toBe(10)
      expect(result.permissionMode).toBe('auto')
      expect(result.prompt).toBe('You are a code review expert.')
    })

    it('name 필드 누락 → 에러', () => {
      const content = `---
description: 설명만 있는 잘못된 파일
---

Some prompt content.`

      expect(() => parseSubagentMd(content)).toThrow(
        "Invalid frontmatter: missing required field 'name'"
      )
    })

    it('frontmatter 없는 순수 마크다운 → 에러', () => {
      const content = `# Git Expert

This is just a plain markdown file without frontmatter.`

      expect(() => parseSubagentMd(content)).toThrow('No frontmatter found')
    })

    it('빈 body → prompt가 빈 문자열', () => {
      const content = `---
name: empty-prompt
description: 빈 프롬프트 테스트
---
`

      const result = parseSubagentMd(content)

      expect(result.name).toBe('empty-prompt')
      expect(result.description).toBe('빈 프롬프트 테스트')
      expect(result.prompt).toBe('')
    })

    it('description 없으면 빈 문자열로 기본값', () => {
      const content = `---
name: no-desc
---

Some prompt.`

      const result = parseSubagentMd(content)

      expect(result.name).toBe('no-desc')
      expect(result.description).toBe('')
      expect(result.prompt).toBe('Some prompt.')
    })
  })

  describe('[파싱 - skill]', () => {
    it('정상적인 skill frontmatter + body → name, description, prompt 추출', () => {
      const content = `---
name: deploy
description: 배포 프로세스 관리
---

# Deploy Skill

Manages deployment processes for the application.`

      const result = parseSkillMd(content)

      expect(result.name).toBe('deploy')
      expect(result.description).toBe('배포 프로세스 관리')
      expect(result.prompt).toBe(
        '# Deploy Skill\n\nManages deployment processes for the application.'
      )
    })

    it('skill optional 필드(allowedTools, context, agent) 포함 → 해당 필드 파싱', () => {
      const content = `---
name: deploy
description: 배포 프로세스 관리
model: sonnet
allowedTools: Bash, Read
context: production
agent: devops
userInvocable: true
disableModelInvocation: false
argumentHint: --env=production
---

Deploy to production.`

      const result = parseSkillMd(content)

      expect(result.name).toBe('deploy')
      expect(result.description).toBe('배포 프로세스 관리')
      expect(result.model).toBe('sonnet')
      expect(result.allowedTools).toBe('Bash, Read')
      expect(result.context).toBe('production')
      expect(result.agent).toBe('devops')
      expect(result.userInvocable).toBe(true)
      expect(result.disableModelInvocation).toBe(false)
      expect(result.argumentHint).toBe('--env=production')
      expect(result.prompt).toBe('Deploy to production.')
    })

    it('skill name 필드 누락 → 에러', () => {
      const content = `---
description: 이름 없는 skill
---

Some skill content.`

      expect(() => parseSkillMd(content)).toThrow(
        "Invalid frontmatter: missing required field 'name'"
      )
    })

    it('skill frontmatter 없는 순수 마크다운 → 에러', () => {
      const content = `# Deploy

Just a markdown file.`

      expect(() => parseSkillMd(content)).toThrow('No frontmatter found')
    })
  })

  describe('[파싱 - Skill / resources]', () => {
    it('resources 배열 포함된 frontmatter → resources 필드 정상 파싱', () => {
      const content = `---
name: deploy
description: 배포 프로세스 관리
resources:
  - scripts/run-deploy.sh
  - references/env-schema.json
---

Deploy to production.`

      const result = parseSkillMd(content)

      expect(result.name).toBe('deploy')
      expect(result.resources).toEqual(['scripts/run-deploy.sh', 'references/env-schema.json'])
    })

    it('resources 미포함 → resources는 undefined', () => {
      const content = `---
name: deploy
description: 배포 프로세스 관리
---

Deploy to production.`

      const result = parseSkillMd(content)

      expect(result.name).toBe('deploy')
      expect(result.resources).toBeUndefined()
    })
  })

  describe('[직렬화]', () => {
    it('subagent serialize 후 parse → 원본과 동일 (round-trip)', () => {
      const original = {
        name: 'git-expert',
        description: 'Git 버전 관리 전문가',
        prompt: 'You are a Git expert.\nHelp with version control.',
        model: 'sonnet',
        tools: 'Read, Glob',
        maxTurns: 5,
      }

      const serialized = serializeSubagentMd(original)
      const parsed = parseSubagentMd(serialized)

      expect(parsed.name).toBe(original.name)
      expect(parsed.description).toBe(original.description)
      expect(parsed.prompt).toBe(original.prompt)
      expect(parsed.model).toBe(original.model)
      expect(parsed.tools).toBe(original.tools)
      expect(parsed.maxTurns).toBe(original.maxTurns)
    })

    it('skill serialize 후 parse → 원본과 동일 (round-trip)', () => {
      const original = {
        name: 'deploy',
        description: '배포 관리',
        prompt: '# Deploy\n\nManages deployments.',
        model: 'opus',
        allowedTools: 'Bash',
        userInvocable: true,
      }

      const serialized = serializeSkillMd(original)
      const parsed = parseSkillMd(serialized)

      expect(parsed.name).toBe(original.name)
      expect(parsed.description).toBe(original.description)
      expect(parsed.prompt).toBe(original.prompt)
      expect(parsed.model).toBe(original.model)
      expect(parsed.allowedTools).toBe(original.allowedTools)
      expect(parsed.userInvocable).toBe(original.userInvocable)
    })

    it('undefined optional 필드는 직렬화 시 생략', () => {
      const config = {
        name: 'minimal',
        description: '최소 설정',
        prompt: 'Minimal prompt.',
        model: undefined,
        tools: undefined,
      }

      const serialized = serializeSubagentMd(config)

      // model, tools 필드가 frontmatter에 포함되지 않아야 함
      expect(serialized).not.toContain('model:')
      expect(serialized).not.toContain('tools:')
      expect(serialized).toContain('name: minimal')
      expect(serialized).toContain('description: 최소 설정')
    })

    it('빈 prompt → frontmatter만 생성', () => {
      const config = {
        name: 'no-body',
        description: '본문 없음',
        prompt: '',
      }

      const serialized = serializeSubagentMd(config)
      const parsed = parseSubagentMd(serialized)

      expect(parsed.name).toBe('no-body')
      expect(parsed.prompt).toBe('')
    })
  })

  describe('[직렬화 - Skill / resources]', () => {
    it('resources 있는 SkillConfig serialize → parse → 원본과 동일 (round-trip)', () => {
      const original = {
        name: 'deploy',
        description: '배포 관리',
        prompt: '# Deploy\n\nManages deployments.',
        resources: ['scripts/run-deploy.sh', 'references/env-schema.json'],
      }

      const serialized = serializeSkillMd(original)
      const parsed = parseSkillMd(serialized)

      expect(parsed.name).toBe(original.name)
      expect(parsed.description).toBe(original.description)
      expect(parsed.prompt).toBe(original.prompt)
      expect(parsed.resources).toEqual(original.resources)
    })

    it('resources가 undefined → 직렬화 시 resources 키 생략', () => {
      const config = {
        name: 'minimal-skill',
        description: '최소 스킬',
        prompt: 'Minimal skill prompt.',
        resources: undefined,
      }

      const serialized = serializeSkillMd(config)

      expect(serialized).not.toContain('resources:')
      expect(serialized).toContain('name: minimal-skill')
      expect(serialized).toContain('description: 최소 스킬')
    })
  })
})

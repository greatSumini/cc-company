import { describe, it, expect } from 'vitest'
import { buildFlags } from '../../src/claude-runner/flag-builder'
import type { AgentConfig, SubagentConfig, FlagBuilderInput } from '../../src/types'

describe('flag-builder', () => {
  // 기본 agent 설정
  const baseAgent: AgentConfig = {
    name: 'developer',
    description: '개발자 에이전트',
  }

  describe('[기본]', () => {
    it('prompt.md만 있는 agent → --append-system-prompt-file만 생성', () => {
      const input: FlagBuilderInput = {
        agent: baseAgent,
        promptFilePath: '/path/to/prompt.md',
        prompt: '버그 고쳐줘',
        passthroughFlags: [],
      }

      const flags = buildFlags(input)

      expect(flags).toEqual([
        '--append-system-prompt-file',
        '/path/to/prompt.md',
        '버그 고쳐줘',
      ])
    })

    it('모든 설정이 있는 agent → 전체 플래그 생성', () => {
      const subagents: SubagentConfig[] = [
        { name: 'git-expert', description: 'Git 전문가', prompt: 'You are a git expert.' },
      ]

      const input: FlagBuilderInput = {
        agent: { ...baseAgent, subagents: ['git-expert'] },
        promptFilePath: '/path/to/prompt.md',
        subagents,
        settingsFilePath: '/path/to/settings.json',
        mcpConfigFilePath: '/path/to/mcp.json',
        addDirPath: '/path/to/add-dir',
        prompt: '테스트 프롬프트',
        passthroughFlags: ['--model', 'opus'],
      }

      const flags = buildFlags(input)

      expect(flags).toContain('--append-system-prompt-file')
      expect(flags).toContain('/path/to/prompt.md')
      expect(flags).toContain('--agents')
      expect(flags).toContain('--settings')
      expect(flags).toContain('/path/to/settings.json')
      expect(flags).toContain('--mcp-config')
      expect(flags).toContain('/path/to/mcp.json')
      expect(flags).toContain('--add-dir')
      expect(flags).toContain('/path/to/add-dir')
      expect(flags).toContain('--model')
      expect(flags).toContain('opus')
      expect(flags[flags.length - 1]).toBe('테스트 프롬프트')
    })

    it('설정이 하나도 없는 agent → 빈 플래그 배열 + prompt만', () => {
      const input: FlagBuilderInput = {
        agent: baseAgent,
        promptFilePath: '/path/to/prompt.md',
        prompt: 'hello',
        passthroughFlags: [],
      }

      const flags = buildFlags(input)

      // promptFilePath는 필수이므로 항상 포함
      expect(flags).toEqual([
        '--append-system-prompt-file',
        '/path/to/prompt.md',
        'hello',
      ])
    })
  })

  describe('[개별 플래그 매핑]', () => {
    it('subagents 1개 → --agents JSON에 1개 포함', () => {
      const subagents: SubagentConfig[] = [
        { name: 'git-expert', description: 'Git 전문가', prompt: 'You are a git expert.' },
      ]

      const input: FlagBuilderInput = {
        agent: baseAgent,
        promptFilePath: '/path/to/prompt.md',
        subagents,
        prompt: 'test',
        passthroughFlags: [],
      }

      const flags = buildFlags(input)
      const agentsIndex = flags.indexOf('--agents')

      expect(agentsIndex).toBeGreaterThan(-1)
      const agentsJson = flags[agentsIndex + 1]
      const parsed = JSON.parse(agentsJson)

      expect(parsed).toHaveProperty('git-expert')
      expect(parsed['git-expert'].description).toBe('Git 전문가')
      expect(parsed['git-expert'].prompt).toBe('You are a git expert.')
    })

    it('subagents 여러개 → --agents JSON에 전부 포함', () => {
      const subagents: SubagentConfig[] = [
        { name: 'git-expert', description: 'Git 전문가', prompt: 'git prompt' },
        { name: 'code-reviewer', description: '코드 리뷰어', prompt: 'review prompt' },
        { name: 'tester', description: '테스터', prompt: 'test prompt' },
      ]

      const input: FlagBuilderInput = {
        agent: baseAgent,
        promptFilePath: '/path/to/prompt.md',
        subagents,
        prompt: 'test',
        passthroughFlags: [],
      }

      const flags = buildFlags(input)
      const agentsIndex = flags.indexOf('--agents')
      const agentsJson = flags[agentsIndex + 1]
      const parsed = JSON.parse(agentsJson)

      expect(Object.keys(parsed)).toHaveLength(3)
      expect(parsed).toHaveProperty('git-expert')
      expect(parsed).toHaveProperty('code-reviewer')
      expect(parsed).toHaveProperty('tester')
    })

    it('mcp.json 존재 → --mcp-config 경로 포함', () => {
      const input: FlagBuilderInput = {
        agent: baseAgent,
        promptFilePath: '/path/to/prompt.md',
        mcpConfigFilePath: '/path/to/mcp.json',
        prompt: 'test',
        passthroughFlags: [],
      }

      const flags = buildFlags(input)

      expect(flags).toContain('--mcp-config')
      expect(flags).toContain('/path/to/mcp.json')
    })

    it('settings.json 존재 → --settings 경로 포함', () => {
      const input: FlagBuilderInput = {
        agent: baseAgent,
        promptFilePath: '/path/to/prompt.md',
        settingsFilePath: '/path/to/settings.json',
        prompt: 'test',
        passthroughFlags: [],
      }

      const flags = buildFlags(input)

      expect(flags).toContain('--settings')
      expect(flags).toContain('/path/to/settings.json')
    })

    it('addDirPath 있으면 → --add-dir 플래그 생성', () => {
      const input: FlagBuilderInput = {
        agent: baseAgent,
        promptFilePath: '/path/to/prompt.md',
        addDirPath: '/path/to/add-dir',
        prompt: 'test',
        passthroughFlags: [],
      }

      const flags = buildFlags(input)

      expect(flags).toContain('--add-dir')
      expect(flags).toContain('/path/to/add-dir')
    })

    it('addDirPath undefined → --add-dir 생략', () => {
      const input: FlagBuilderInput = {
        agent: baseAgent,
        promptFilePath: '/path/to/prompt.md',
        addDirPath: undefined,
        prompt: 'test',
        passthroughFlags: [],
      }

      const flags = buildFlags(input)

      expect(flags).not.toContain('--add-dir')
    })
  })

  describe('[패스스루]', () => {
    it('패스스루 플래그가 그대로 뒤에 붙는지', () => {
      const input: FlagBuilderInput = {
        agent: baseAgent,
        promptFilePath: '/path/to/prompt.md',
        prompt: 'test',
        passthroughFlags: ['--model', 'opus', '--output-format', 'json'],
      }

      const flags = buildFlags(input)

      expect(flags).toContain('--model')
      expect(flags).toContain('opus')
      expect(flags).toContain('--output-format')
      expect(flags).toContain('json')

      // 패스스루 플래그는 prompt 앞에 위치해야 함
      const modelIndex = flags.indexOf('--model')
      const promptIndex = flags.indexOf('test')
      expect(modelIndex).toBeLessThan(promptIndex)
    })

    it('패스스루에 -p 포함 시 정상 전달', () => {
      const input: FlagBuilderInput = {
        agent: baseAgent,
        promptFilePath: '/path/to/prompt.md',
        prompt: 'test',
        passthroughFlags: ['-p'],
      }

      const flags = buildFlags(input)

      expect(flags).toContain('-p')
    })

    it('패스스루 없을 때 빈 배열', () => {
      const input: FlagBuilderInput = {
        agent: baseAgent,
        promptFilePath: '/path/to/prompt.md',
        prompt: 'test',
        passthroughFlags: [],
      }

      const flags = buildFlags(input)

      // passthroughFlags가 빈 배열이면 추가 플래그 없음
      expect(flags).toEqual([
        '--append-system-prompt-file',
        '/path/to/prompt.md',
        'test',
      ])
    })
  })

  describe('[프롬프트]', () => {
    it('prompt 문자열이 플래그 배열 마지막에 위치하는지', () => {
      const input: FlagBuilderInput = {
        agent: baseAgent,
        promptFilePath: '/path/to/prompt.md',
        settingsFilePath: '/path/to/settings.json',
        prompt: '마지막 프롬프트',
        passthroughFlags: ['--model', 'opus'],
      }

      const flags = buildFlags(input)

      expect(flags[flags.length - 1]).toBe('마지막 프롬프트')
    })

    it('prompt에 특수문자/공백 포함 시 이스케이프 정상 처리', () => {
      // child_process.spawn은 shell: false가 기본이므로
      // 별도 이스케이프 없이 그대로 전달하면 됨
      const input: FlagBuilderInput = {
        agent: baseAgent,
        promptFilePath: '/path/to/prompt.md',
        prompt: '버그를 "고쳐줘" & 테스트 해줘 | grep foo',
        passthroughFlags: [],
      }

      const flags = buildFlags(input)

      // 특수문자가 그대로 포함되어야 함 (spawn이 처리)
      expect(flags[flags.length - 1]).toBe('버그를 "고쳐줘" & 테스트 해줘 | grep foo')
    })

    it('prompt가 undefined이면 플래그 배열에 prompt가 포함되지 않음', () => {
      const input: FlagBuilderInput = {
        agent: baseAgent,
        promptFilePath: '/path/to/prompt.md',
        prompt: undefined,
        passthroughFlags: [],
      }

      const flags = buildFlags(input)

      expect(flags).toEqual([
        '--append-system-prompt-file',
        '/path/to/prompt.md',
      ])
    })

    it('prompt가 undefined이고 passthrough flags가 있으면 flags만 포함', () => {
      const input: FlagBuilderInput = {
        agent: baseAgent,
        promptFilePath: '/path/to/prompt.md',
        prompt: undefined,
        passthroughFlags: ['--model', 'opus'],
      }

      const flags = buildFlags(input)

      expect(flags).toEqual([
        '--append-system-prompt-file',
        '/path/to/prompt.md',
        '--model',
        'opus',
      ])
    })
  })

  describe('[엣지 케이스]', () => {
    it('subagents 배열이 빈 배열 → --agents 플래그 생략', () => {
      const input: FlagBuilderInput = {
        agent: baseAgent,
        promptFilePath: '/path/to/prompt.md',
        subagents: [],
        prompt: 'test',
        passthroughFlags: [],
      }

      const flags = buildFlags(input)

      expect(flags).not.toContain('--agents')
    })

    it('optional 필드 전부 undefined → 에러 없이 최소 플래그만 생성', () => {
      const input: FlagBuilderInput = {
        agent: baseAgent,
        promptFilePath: '/path/to/prompt.md',
        subagents: undefined,
        settingsFilePath: undefined,
        mcpConfigFilePath: undefined,
        addDirPath: undefined,
        prompt: 'minimal test',
        passthroughFlags: [],
      }

      const flags = buildFlags(input)

      expect(flags).toEqual([
        '--append-system-prompt-file',
        '/path/to/prompt.md',
        'minimal test',
      ])
    })

    it('prompt undefined + subagents + settings → prompt 없이 정상 빌드', () => {
      const subagents: SubagentConfig[] = [
        { name: 'git-expert', description: 'Git 전문가', prompt: 'You are a git expert.' },
      ]

      const input: FlagBuilderInput = {
        agent: { ...baseAgent, subagents: ['git-expert'] },
        promptFilePath: '/path/to/prompt.md',
        subagents,
        settingsFilePath: '/path/to/settings.json',
        prompt: undefined,
        passthroughFlags: [],
      }

      const flags = buildFlags(input)

      expect(flags).toContain('--append-system-prompt-file')
      expect(flags).toContain('--agents')
      expect(flags).toContain('--settings')
      // prompt가 마지막에 없어야 함
      expect(flags[flags.length - 1]).toBe('/path/to/settings.json')
    })
  })
})

import matter from 'gray-matter'
import type { SubagentConfig, SkillConfig } from '../types/index.js'

export function parseSubagentMd(content: string): SubagentConfig {
  const parsed = matter(content)

  // frontmatter가 없거나 빈 객체인 경우
  if (!parsed.data || Object.keys(parsed.data).length === 0) {
    throw new Error('No frontmatter found')
  }

  // name 필드 필수
  if (!parsed.data.name) {
    throw new Error("Invalid frontmatter: missing required field 'name'")
  }

  const { name, description, model, tools, disallowedTools, maxTurns, permissionMode } =
    parsed.data as Record<string, unknown>

  return {
    name: name as string,
    description: (description as string) ?? '',
    prompt: parsed.content.trim(),
    model: model as string | undefined,
    tools: tools as string | undefined,
    disallowedTools: disallowedTools as string | undefined,
    maxTurns: maxTurns as number | undefined,
    permissionMode: permissionMode as string | undefined,
  }
}

export function parseSkillMd(content: string): SkillConfig {
  const parsed = matter(content)

  // frontmatter가 없거나 빈 객체인 경우
  if (!parsed.data || Object.keys(parsed.data).length === 0) {
    throw new Error('No frontmatter found')
  }

  // name 필드 필수
  if (!parsed.data.name) {
    throw new Error("Invalid frontmatter: missing required field 'name'")
  }

  const {
    name,
    description,
    resources,
    model,
    allowedTools,
    context,
    agent,
    userInvocable,
    disableModelInvocation,
    argumentHint,
  } = parsed.data as Record<string, unknown>

  return {
    name: name as string,
    description: (description as string) ?? '',
    prompt: parsed.content.trim(),
    resources: resources as string[] | undefined,
    model: model as string | undefined,
    allowedTools: allowedTools as string | undefined,
    context: context as string | undefined,
    agent: agent as string | undefined,
    userInvocable: userInvocable as boolean | undefined,
    disableModelInvocation: disableModelInvocation as boolean | undefined,
    argumentHint: argumentHint as string | undefined,
  }
}

export function serializeSubagentMd(config: SubagentConfig): string {
  // prompt를 제외한 frontmatter 데이터 구성
  const frontmatterData: Record<string, unknown> = {
    name: config.name,
    description: config.description,
  }

  // optional 필드는 값이 있을 때만 포함
  if (config.model !== undefined) frontmatterData.model = config.model
  if (config.tools !== undefined) frontmatterData.tools = config.tools
  if (config.disallowedTools !== undefined)
    frontmatterData.disallowedTools = config.disallowedTools
  if (config.maxTurns !== undefined) frontmatterData.maxTurns = config.maxTurns
  if (config.permissionMode !== undefined)
    frontmatterData.permissionMode = config.permissionMode

  return matter.stringify(config.prompt, frontmatterData)
}

export function serializeSkillMd(config: SkillConfig): string {
  // prompt를 제외한 frontmatter 데이터 구성
  const frontmatterData: Record<string, unknown> = {
    name: config.name,
    description: config.description,
  }

  // optional 필드는 값이 있을 때만 포함
  if (config.resources !== undefined && config.resources.length > 0) {
    frontmatterData.resources = config.resources
  }
  if (config.model !== undefined) frontmatterData.model = config.model
  if (config.allowedTools !== undefined) frontmatterData.allowedTools = config.allowedTools
  if (config.context !== undefined) frontmatterData.context = config.context
  if (config.agent !== undefined) frontmatterData.agent = config.agent
  if (config.userInvocable !== undefined)
    frontmatterData.userInvocable = config.userInvocable
  if (config.disableModelInvocation !== undefined)
    frontmatterData.disableModelInvocation = config.disableModelInvocation
  if (config.argumentHint !== undefined) frontmatterData.argumentHint = config.argumentHint

  return matter.stringify(config.prompt, frontmatterData)
}

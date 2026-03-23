import type { FlagBuilderInput, SubagentConfig } from '@agentinc/core'
import { isEmptyStringOrNil } from '@agentinc/core'

function buildSubagentsJson(subagents: SubagentConfig[]): string {
  const obj: Record<string, { description: string; prompt: string }> = {}
  for (const sub of subagents) {
    obj[sub.name] = {
      description: sub.description,
      prompt: sub.prompt,
    }
  }
  return JSON.stringify(obj)
}

export function buildFlags(input: FlagBuilderInput): string[] {
  const flags: string[] = []

  // --append-system-prompt-file
  flags.push('--append-system-prompt-file', input.promptFilePath)

  // --agents (subagents가 있고 빈 배열이 아닐 때만)
  if (input.subagents && input.subagents.length > 0) {
    flags.push('--agents', buildSubagentsJson(input.subagents))
  }

  // --settings
  if (input.settingsFilePath) {
    flags.push('--settings', input.settingsFilePath)
  }

  // --mcp-config
  if (input.mcpConfigFilePath) {
    flags.push('--mcp-config', input.mcpConfigFilePath)
  }

  // --add-dir
  if (input.addDirPath) {
    flags.push('--add-dir', input.addDirPath)
  }

  // passthrough flags
  if (input.passthroughFlags.length > 0) {
    flags.push(...input.passthroughFlags)
  }

  // prompt (마지막) — interactive mode에서는 prompt 없이 실행
  if (!isEmptyStringOrNil(input.prompt)) {
    flags.push(input.prompt)
  }

  return flags
}

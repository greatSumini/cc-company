#!/usr/bin/env node
import { Command } from 'commander'
import { registerInitCommand } from './commands/init.js'
import { registerRunCommand } from './commands/run.js'
import { registerAgentCommand } from './commands/agent.js'
import { registerSubagentCommand } from './commands/subagent.js'
import { registerSkillCommand } from './commands/skill.js'
import { registerHookCommand } from './commands/hook.js'
import { registerStartCommand } from './commands/start.js'

const program = new Command()

program
  .name('cc-company')
  .description('Run Claude Code like a company')
  .version('0.1.0')

registerInitCommand(program)
registerRunCommand(program)
registerAgentCommand(program)
registerSubagentCommand(program)
registerSkillCommand(program)
registerHookCommand(program)
registerStartCommand(program)

program.parse()

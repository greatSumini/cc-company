#!/usr/bin/env node
import { Command } from 'commander'
import { registerInitCommand } from './commands/init.js'
import { registerRunCommand } from './commands/run.js'
import { registerAgentCommand } from './commands/agent.js'
import { registerSubagentCommand } from './commands/subagent.js'
import { registerSkillCommand } from './commands/skill.js'
import { registerHookCommand } from './commands/hook.js'
import { registerStartCommand } from './commands/start.js'
import { registerTicketCommand } from './commands/ticket.js'
import { registerWebhookCommand } from './commands/webhook.js'

const program = new Command()

program
  .name('agentinc')
  .description('Run Claude Code like a company')
  .version('0.2.0')

registerInitCommand(program)
registerRunCommand(program)
registerAgentCommand(program)
registerSubagentCommand(program)
registerSkillCommand(program)
registerHookCommand(program)
registerStartCommand(program)
registerTicketCommand(program)
registerWebhookCommand(program)

program.parseAsync()

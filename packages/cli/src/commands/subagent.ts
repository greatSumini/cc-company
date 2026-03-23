import { Command } from 'commander'
import { createContext } from './context.js'

export function registerSubagentCommand(program: Command): void {
  const subagentCmd = program
    .command('subagent')
    .description('Manage shared subagents')

  // agentinc subagent add <name>
  subagentCmd
    .command('add <name>')
    .description('Add a new subagent to the shared pool')
    .option('-d, --description <description>', 'Subagent description', '')
    .option('-p, --prompt <prompt>', 'Subagent prompt', '')
    .action((name: string, options: { description: string; prompt: string }) => {
      const ctx = createContext()
      try {
        ctx.resourceService.createSubagent(name, options.description, options.prompt)
        console.log(`Subagent '${name}' created.`)
      } catch (err) {
        console.error((err as Error).message)
        process.exit(1)
      }
    })

  // agentinc subagent list
  subagentCmd
    .command('list')
    .description('List all shared subagents')
    .action(() => {
      const ctx = createContext()
      const subagents = ctx.resourceService.listSubagents()

      if (subagents.length === 0) {
        console.log('No subagents found.')
        return
      }

      for (const subagent of subagents) {
        const desc = subagent.description || '(no description)'
        console.log(`${subagent.name.padEnd(16)} ${desc}`)
      }
    })

  // agentinc subagent remove <name>
  subagentCmd
    .command('remove <name>')
    .description('Remove a subagent from the shared pool')
    .action((name: string) => {
      const ctx = createContext()
      try {
        ctx.resourceService.removeSubagent(name)
        console.log(`Subagent '${name}' removed.`)
      } catch (err) {
        console.error((err as Error).message)
        process.exit(1)
      }
    })
}

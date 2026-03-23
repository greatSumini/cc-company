import { Command } from 'commander'
import { createContext } from './context.js'

export function registerHookCommand(program: Command): void {
  const hookCmd = program
    .command('hook')
    .description('Manage shared hooks')

  // agentinc hook add <name>
  hookCmd
    .command('add <name>')
    .description('Add a new hook to the shared pool')
    .option('-d, --description <description>', 'Hook description', '')
    .action((name: string, options: { description: string }) => {
      const ctx = createContext()
      try {
        ctx.resourceService.createHook(name, options.description, {})
        console.log(`Hook '${name}' created.`)
      } catch (err) {
        console.error((err as Error).message)
        process.exit(1)
      }
    })

  // agentinc hook list
  hookCmd
    .command('list')
    .description('List all shared hooks')
    .action(() => {
      const ctx = createContext()
      const hooks = ctx.resourceService.listHooks()

      if (hooks.length === 0) {
        console.log('No hooks found.')
        return
      }

      for (const hook of hooks) {
        const desc = hook.description || '(no description)'
        console.log(`${hook.name.padEnd(16)} ${desc}`)
      }
    })

  // agentinc hook remove <name>
  hookCmd
    .command('remove <name>')
    .description('Remove a hook from the shared pool')
    .action((name: string) => {
      const ctx = createContext()
      try {
        ctx.resourceService.removeHook(name)
        console.log(`Hook '${name}' removed.`)
      } catch (err) {
        console.error((err as Error).message)
        process.exit(1)
      }
    })
}

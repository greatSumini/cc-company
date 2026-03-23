import { Command } from 'commander'
import { createContext } from './context.js'

export function registerAgentCommand(program: Command): void {
  const agentCmd = program
    .command('agent')
    .description('Manage agents')
    .allowUnknownOption()
    .allowExcessArguments()

  // agentinc agent create <name>
  agentCmd
    .command('create <name>')
    .description('Create a new agent')
    .option('-d, --description <description>', 'Agent description', '')
    .action((name: string, options: { description: string }) => {
      const ctx = createContext()
      try {
        ctx.agentService.create(name, options.description)
        console.log(`Agent '${name}' created.`)
      } catch (err) {
        console.error((err as Error).message)
        process.exit(1)
      }
    })

  // agentinc agent list
  agentCmd
    .command('list')
    .description('List all agents')
    .action(() => {
      const ctx = createContext()
      const agents = ctx.agentService.list()

      if (agents.length === 0) {
        console.log('No agents found.')
        return
      }

      for (const agent of agents) {
        const desc = agent.description || '(no description)'
        console.log(`${agent.name.padEnd(12)} ${desc}`)
      }
    })

  // agentinc agent remove <name>
  agentCmd
    .command('remove <name>')
    .description('Remove an agent')
    .action((name: string) => {
      const ctx = createContext()
      try {
        ctx.agentService.remove(name)
        console.log(`Agent '${name}' removed.`)
      } catch (err) {
        console.error((err as Error).message)
        process.exit(1)
      }
    })

  // agentinc agent show <name>
  agentCmd
    .command('show <name>')
    .description('Show agent details')
    .action((name: string) => {
      const ctx = createContext()
      try {
        const agent = ctx.agentService.show(name)
        console.log(`Name: ${agent.name}`)
        console.log(`Description: ${agent.description || '(no description)'}`)
        console.log('')
        console.log(`Subagents: ${agent.subagents?.join(', ') || '(none)'}`)
        console.log(`Skills: ${agent.skills?.join(', ') || '(none)'}`)
        console.log(`Hooks: ${agent.hooks?.join(', ') || '(none)'}`)
      } catch (err) {
        console.error((err as Error).message)
        process.exit(1)
      }
    })

  // agentinc agent add <agent-name> <resource-type> <resource-name>
  agentCmd
    .command('add <agent-name> <resource-type> <resource-name>')
    .description('Add a resource to an agent')
    .action((agentName: string, resourceType: string, resourceName: string) => {
      const ctx = createContext()
      try {
        switch (resourceType) {
          case 'subagent':
            ctx.agentService.assignSubagent(agentName, resourceName)
            console.log(`Subagent '${resourceName}' added to agent '${agentName}'.`)
            break
          case 'skill':
            ctx.agentService.assignSkill(agentName, resourceName)
            console.log(`Skill '${resourceName}' added to agent '${agentName}'.`)
            break
          case 'hook':
            ctx.agentService.assignHook(agentName, resourceName)
            console.log(`Hook '${resourceName}' added to agent '${agentName}'.`)
            break
          default:
            console.error(`Unknown resource type: ${resourceType}. Use 'subagent', 'skill', or 'hook'.`)
            process.exit(1)
        }
      } catch (err) {
        console.error((err as Error).message)
        process.exit(1)
      }
    })

  // agentinc agent unassign <agent-name> <resource-type> <resource-name>
  agentCmd
    .command('unassign <agent-name> <resource-type> <resource-name>')
    .description('Remove a resource from an agent')
    .action((agentName: string, resourceType: string, resourceName: string) => {
      const ctx = createContext()
      try {
        switch (resourceType) {
          case 'subagent':
            ctx.agentService.unassignSubagent(agentName, resourceName)
            console.log(`Subagent '${resourceName}' removed from agent '${agentName}'.`)
            break
          case 'skill':
            ctx.agentService.unassignSkill(agentName, resourceName)
            console.log(`Skill '${resourceName}' removed from agent '${agentName}'.`)
            break
          case 'hook':
            ctx.agentService.unassignHook(agentName, resourceName)
            console.log(`Hook '${resourceName}' removed from agent '${agentName}'.`)
            break
          default:
            console.error(`Unknown resource type: ${resourceType}. Use 'subagent', 'skill', or 'hook'.`)
            process.exit(1)
        }
      } catch (err) {
        console.error((err as Error).message)
        process.exit(1)
      }
    })
}

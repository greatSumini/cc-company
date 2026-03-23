import { Command } from 'commander'
import { createContext } from './context.js'

async function readContent(options: { content?: string; stdin?: boolean }): Promise<string> {
  if (options.content) return options.content
  if (options.stdin) {
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    return Buffer.concat(chunks).toString('utf-8')
  }
  throw new Error('Either --content or --stdin is required')
}

export function registerSkillCommand(program: Command): void {
  const skillCmd = program
    .command('skill')
    .description('Manage shared skills')

  // agentinc skill add <name>
  skillCmd
    .command('add <name>')
    .description('Add a new skill to the shared pool')
    .option('-d, --description <description>', 'Skill description', '')
    .option('-p, --prompt <prompt>', 'Skill prompt', '')
    .action((name: string, options: { description: string; prompt: string }) => {
      const ctx = createContext()
      try {
        ctx.resourceService.createSkill(name, options.description, options.prompt)
        console.log(`Skill '${name}' created.`)
      } catch (err) {
        console.error((err as Error).message)
        process.exit(1)
      }
    })

  // agentinc skill list
  skillCmd
    .command('list')
    .description('List all shared skills')
    .action(() => {
      const ctx = createContext()
      const skills = ctx.resourceService.listSkills()

      if (skills.length === 0) {
        console.log('No skills found.')
        return
      }

      for (const skill of skills) {
        const desc = skill.description || '(no description)'
        console.log(`${skill.name.padEnd(16)} ${desc}`)
      }
    })

  // agentinc skill remove <name>
  skillCmd
    .command('remove <name>')
    .description('Remove a skill from the shared pool')
    .action((name: string) => {
      const ctx = createContext()
      try {
        ctx.resourceService.removeSkill(name)
        console.log(`Skill '${name}' removed.`)
      } catch (err) {
        console.error((err as Error).message)
        process.exit(1)
      }
    })

  // agentinc skill show <name>
  skillCmd
    .command('show <name>')
    .description('Show skill details with file listing')
    .action((name: string) => {
      const ctx = createContext()
      try {
        const result = ctx.resourceService.showSkill(name)
        const { config, files } = result

        console.log(`Skill: ${config.name}`)
        console.log(`Description: ${config.description}`)
        if (config.model) {
          console.log(`Model: ${config.model}`)
        }

        console.log('Resources:')
        if (config.resources && config.resources.length > 0) {
          for (const resource of config.resources) {
            console.log(`  - ${resource}`)
          }
        } else {
          console.log('  (none)')
        }

        console.log('Files:')
        if (files.length > 0) {
          for (const file of files) {
            console.log(`  - ${file}`)
          }
        } else {
          console.log('  (none)')
        }
        // warnings는 showSkill 내에서 이미 console.warn으로 출력됨
      } catch (err) {
        console.error((err as Error).message)
        process.exit(1)
      }
    })

  // agentinc skill add-file <skill-name> <file-path>
  skillCmd
    .command('add-file <skill-name> <file-path>')
    .description('Add a file to a skill')
    .option('-c, --content <content>', 'File content')
    .option('--stdin', 'Read content from stdin')
    .action(async (skillName: string, filePath: string, options: { content?: string; stdin?: boolean }) => {
      const ctx = createContext()
      try {
        const content = await readContent(options)
        ctx.resourceService.addSkillFile(skillName, filePath, content)
        console.log(`File '${filePath}' added to skill '${skillName}'.`)
      } catch (err) {
        console.error((err as Error).message)
        process.exit(1)
      }
    })

  // agentinc skill edit-file <skill-name> <file-path>
  skillCmd
    .command('edit-file <skill-name> <file-path>')
    .description('Edit a file in a skill')
    .option('-c, --content <content>', 'File content')
    .option('--stdin', 'Read content from stdin')
    .action(async (skillName: string, filePath: string, options: { content?: string; stdin?: boolean }) => {
      const ctx = createContext()
      try {
        const content = await readContent(options)
        ctx.resourceService.editSkillFile(skillName, filePath, content)
        console.log(`File '${filePath}' updated in skill '${skillName}'.`)
      } catch (err) {
        console.error((err as Error).message)
        process.exit(1)
      }
    })

  // agentinc skill remove-file <skill-name> <file-path>
  skillCmd
    .command('remove-file <skill-name> <file-path>')
    .description('Remove a file from a skill')
    .action((skillName: string, filePath: string) => {
      const ctx = createContext()
      try {
        ctx.resourceService.removeSkillFile(skillName, filePath)
        console.log(`File '${filePath}' removed from skill '${skillName}'.`)
      } catch (err) {
        console.error((err as Error).message)
        process.exit(1)
      }
    })
}

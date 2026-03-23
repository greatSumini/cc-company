import * as fs from 'fs'
import * as path from 'path'
import { Command } from 'commander'
import { serializeSubagentMd, serializeSkillMd } from '@agentinc/core'
import { getRootPath } from './context.js'
import { subagentTemplates, skillTemplates, agentTemplates } from '../templates/index.js'

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize agentinc in current directory')
    .option('--force', 'Overwrite existing .agentinc directory')
    .action((options: { force?: boolean }) => {
      const rootPath = getRootPath()

      if (fs.existsSync(rootPath)) {
        if (!options.force) {
          console.error('.agentinc 디렉토리가 이미 존재합니다. --force 옵션을 사용하여 덮어쓸 수 있습니다.')
          process.exit(1)
        }
        fs.rmSync(rootPath, { recursive: true })
      }

      // 디렉토리 구조 생성
      fs.mkdirSync(rootPath, { recursive: true })
      fs.mkdirSync(path.join(rootPath, 'agents'), { recursive: true })
      fs.mkdirSync(path.join(rootPath, 'subagents'), { recursive: true })
      fs.mkdirSync(path.join(rootPath, 'skills'), { recursive: true })
      fs.mkdirSync(path.join(rootPath, 'hooks'), { recursive: true })
      fs.mkdirSync(path.join(rootPath, 'runs'), { recursive: true })

      // config.json 생성
      const config = { version: '0.1.0' }
      fs.writeFileSync(
        path.join(rootPath, 'config.json'),
        JSON.stringify(config, null, 2)
      )

      // 공용 subagents 생성 (MD 형식)
      for (const subagent of subagentTemplates) {
        fs.writeFileSync(
          path.join(rootPath, 'subagents', `${subagent.name}.md`),
          serializeSubagentMd(subagent)
        )
      }

      // 공용 skills 생성 (디렉토리 형식)
      for (const skill of skillTemplates) {
        const skillDir = path.join(rootPath, 'skills', skill.name)
        fs.mkdirSync(skillDir, { recursive: true })
        fs.writeFileSync(path.join(skillDir, 'SKILL.md'), serializeSkillMd(skill))
        // 관례적 서브디렉토리 생성 (.gitkeep 포함)
        for (const subDir of ['scripts', 'references', 'assets']) {
          const subDirPath = path.join(skillDir, subDir)
          fs.mkdirSync(subDirPath, { recursive: true })
          fs.writeFileSync(path.join(subDirPath, '.gitkeep'), '')
        }
      }

      // agents 생성
      for (const template of agentTemplates) {
        const agentDir = path.join(rootPath, 'agents', template.config.name)
        fs.mkdirSync(agentDir, { recursive: true })
        fs.writeFileSync(
          path.join(agentDir, 'agent.json'),
          JSON.stringify(template.config, null, 2)
        )
        fs.writeFileSync(
          path.join(agentDir, 'prompt.md'),
          template.promptMd
        )
      }

      console.log('agentinc가 초기화되었습니다.')
    })
}

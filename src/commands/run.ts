import { Command } from 'commander'
import { createContext } from './context.js'

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run an agent with a prompt')
    .argument('<agent>', 'Agent name')
    .argument('[prompt]', 'Prompt to send to the agent (required in print mode)')
    .option('-p, --print', 'Run in print (headless) mode')
    .allowUnknownOption()
    .allowExcessArguments()
    .action((agent: string, prompt: string | undefined, options: { print?: boolean }, _command: Command) => {
      const ctx = createContext()

      const printMode = options.print === true

      // print mode에서 prompt 필수 검증
      if (printMode && !prompt) {
        console.error('Error: prompt is required in print mode (-p)')
        process.exit(1)
      }

      // mode 결정
      const mode: 'interactive' | 'print' = printMode ? 'print' : 'interactive'

      // 패스스루 플래그 추출
      const runIndex = process.argv.indexOf('run')
      const allArgs = process.argv.slice(runIndex + 1)

      const passthroughFlags: string[] = []
      let positionalCount = 0
      let i = 0

      while (i < allArgs.length) {
        const arg = allArgs[i]

        // ADR-011: -p는 agentinc가 mode 결정에 사용하면서 동시에 Claude CLI에도 전달한다.
        // 여기서 skip하고, 아래에서 printMode일 때 수동 추가한다.
        if (arg === '-p' || arg === '--print') {
          i++
          continue
        }

        if (arg.startsWith('-')) {
          // 플래그: 패스스루에 추가
          passthroughFlags.push(arg)

          // 플래그가 값을 가지는지 확인 (다음 인자가 -로 시작하지 않으면 flag value로 취급)
          if (i + 1 < allArgs.length && !allArgs[i + 1].startsWith('-')) {
            passthroughFlags.push(allArgs[i + 1])
            i++
          }
        } else {
          // 포지셔널 인자
          if (positionalCount < 2) {
            positionalCount++
          } else {
            // 3번째 이후 포지셔널은 패스스루
            passthroughFlags.push(arg)
          }
        }
        i++
      }

      // print mode일 때 -p를 passthrough flags에 수동 추가
      if (printMode) {
        passthroughFlags.push('-p')
      }

      try {
        const result = ctx.runService.run(agent, prompt ?? null, mode, passthroughFlags)
        process.exitCode = result.exitCode
      } catch (err) {
        console.error((err as Error).message)
        process.exit(1)
      }
    })
}

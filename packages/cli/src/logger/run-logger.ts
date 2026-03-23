import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'node:crypto'
import type { RunLog, RunLogFilter, RunLogger as IRunLogger } from '@agentinc/core'

export class RunLogger implements IRunLogger {
  constructor(private runsDir: string) {}

  log(
    agent: string,
    prompt: string | null,
    mode: 'interactive' | 'print',
    flags: string[],
    result: { exitCode: number; stdout: string; stderr: string },
    startedAt: Date,
    finishedAt: Date
  ): void {
    const log: RunLog = {
      id: randomUUID(),
      agent,
      prompt,
      mode,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      exitCode: result.exitCode,
      flags,
      stdout: result.stdout,
      stderr: result.stderr,
    }
    this.save(log)
  }

  save(log: RunLog): void {
    if (!fs.existsSync(this.runsDir)) {
      fs.mkdirSync(this.runsDir, { recursive: true })
    }

    const timestamp = this.formatTimestamp(new Date(log.startedAt))
    const filename = `${timestamp}-${log.id}.json`
    const filePath = path.join(this.runsDir, filename)

    fs.writeFileSync(filePath, JSON.stringify(log, null, 2))
  }

  list(filter?: RunLogFilter): RunLog[] {
    if (!fs.existsSync(this.runsDir)) {
      return []
    }

    const logs = fs
      .readdirSync(this.runsDir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => {
        const content = fs.readFileSync(path.join(this.runsDir, file), 'utf-8')
        return JSON.parse(content) as RunLog
      })
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))

    if (!filter) {
      return logs
    }

    return logs.filter((log) => {
      if (filter.agent && log.agent !== filter.agent) return false
      return true
    })
  }

  private formatTimestamp(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${year}${month}${day}-${hours}${minutes}${seconds}`
  }
}

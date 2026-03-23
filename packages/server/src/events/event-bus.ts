import { EventEmitter } from 'events'
import type { Ticket } from '@agentinc/core'

export type ServerEvent =
  | { type: 'ticket:created'; payload: Ticket }
  | { type: 'ticket:updated'; payload: Ticket }
  | { type: 'agent:status'; payload: { agent: string; state: 'idle' | 'working' } }

class EventBus extends EventEmitter {
  emitEvent(event: ServerEvent): void {
    this.emit(event.type, event.payload)
  }
}

export const eventBus = new EventBus()

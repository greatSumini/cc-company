import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAgentStore } from '@/stores/agent-store'
import { useConnectionStore } from '@/stores/connection-store'
import type { Ticket } from '@/types/ticket'

const SSE_URL = '/events'
const RECONNECT_DELAY = 3000

export function useSSE() {
  const queryClient = useQueryClient()
  const updateAgentStatus = useAgentStore((s) => s.updateStatus)
  const setConnectionState = useConnectionStore((s) => s.setState)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    function connect() {
      // 기존 연결 정리
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      setConnectionState('connecting')

      const eventSource = new EventSource(SSE_URL)
      eventSourceRef.current = eventSource

      // 연결 성공
      eventSource.addEventListener('connected', () => {
        console.log('[SSE] Connected')
        setConnectionState('connected')
      })

      // 티켓 생성 이벤트
      eventSource.addEventListener('ticket:created', (event) => {
        const ticket = JSON.parse(event.data) as Ticket
        console.log('[SSE] ticket:created', ticket.id)

        // React Query 캐시에 새 티켓 추가
        queryClient.setQueryData<Ticket[]>(['tickets'], (old = []) => {
          // 중복 방지
          if (old.some((t) => t.id === ticket.id)) {
            return old
          }
          return [...old, ticket]
        })
      })

      // 티켓 업데이트 이벤트
      eventSource.addEventListener('ticket:updated', (event) => {
        const ticket = JSON.parse(event.data) as Ticket
        console.log('[SSE] ticket:updated', ticket.id, ticket.status)

        // React Query 캐시 업데이트
        queryClient.setQueryData<Ticket[]>(['tickets'], (old = []) => {
          return old.map((t) => (t.id === ticket.id ? ticket : t))
        })

        // 개별 티켓 캐시도 업데이트
        queryClient.setQueryData(['ticket', ticket.id], ticket)
      })

      // Agent 상태 변경 이벤트
      eventSource.addEventListener('agent:status', (event) => {
        const { agent, state } = JSON.parse(event.data) as {
          agent: string
          state: 'idle' | 'working'
        }
        console.log('[SSE] agent:status', agent, state)

        // Zustand 스토어 업데이트
        updateAgentStatus(agent, state)
      })

      // 에러 처리 및 재연결
      eventSource.onerror = (error) => {
        console.error('[SSE] Error:', error)
        setConnectionState('disconnected')
        eventSource.close()

        // 재연결 시도
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }
        reconnectTimeoutRef.current = window.setTimeout(() => {
          console.log('[SSE] Reconnecting...')
          connect()
        }, RECONNECT_DELAY)
      }
    }

    connect()

    // Cleanup
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [queryClient, updateAgentStatus, setConnectionState])
}

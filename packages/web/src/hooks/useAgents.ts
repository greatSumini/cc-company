import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/lib/api-client";
import { useAgentStore } from "@/stores/agent-store";

interface Agent {
  name: string;
  description: string;
}

interface AgentStatus {
  name: string;
  state: "offline" | "idle" | "working";
  currentTicketId?: string;
  processStartedAt?: string;
  lastHeartbeatAt?: string;
}

type AgentStatusMap = Record<string, AgentStatus>;

export function useAgents() {
  return useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: () => api.agents.list() as Promise<Agent[]>,
  });
}

export function useAgentStatuses() {
  const setStatuses = useAgentStore((s) => s.setStatuses);

  const query = useQuery<AgentStatusMap>({
    queryKey: ["agents", "status"],
    queryFn: () => api.agents.status() as Promise<AgentStatusMap>,
    // 초기 로드만, 이후 SSE로 업데이트
    refetchOnWindowFocus: false,
  });

  // 초기 상태를 Zustand에 동기화
  useEffect(() => {
    if (query.data) {
      const statusMap: Record<string, "offline" | "idle" | "working"> = {};

      for (const [name, status] of Object.entries(query.data)) {
        statusMap[name] = status.state;
      }
      setStatuses(statusMap);
    }
  }, [query.data, setStatuses]);

  return query;
}

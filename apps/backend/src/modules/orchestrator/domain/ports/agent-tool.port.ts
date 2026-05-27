export interface AgentToolPort {
  invoke(name: string, args: Record<string, unknown>): Promise<string>;
}

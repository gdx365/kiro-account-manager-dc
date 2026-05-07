export interface MCPServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
  disabled?: boolean
  autoApprove?: string[]
}

export interface MCPConfigResponse {
  mcpServers?: Record<string, MCPServerConfig>
}

export interface MCPToolStatsResponse {
  estimatedTools?: number
}

export interface ParsedMCPServer {
  name: string
  config: MCPServerConfig
}

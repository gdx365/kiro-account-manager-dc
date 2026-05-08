export interface BrowserInfo {
  name: string
  path: string
  incognitoArg?: string
}

export interface SystemMachineInfo {
  machineGuid: string
  osType: string
  requiresAdmin: boolean
  canModify: boolean
}

export interface KiroSettings {
  httpProxy?: string
  modelSelection?: string
  enableCodebaseIndexing?: boolean
  trustedCommandsMode?: string
  customTrustedCommands?: string
  agentAutonomy?: string
  enableTabAutocomplete?: boolean
  usageSummary?: boolean
  codeReferences?: boolean
  enableDebugLogs?: boolean
  notifyActionRequired?: boolean
  notifyFailure?: boolean
  notifySuccess?: boolean
  notifyBilling?: boolean
  trustedTools?: string[]
  referenceTracker?: boolean
  configureMcp?: string
  telemetryContentCollection?: boolean
  telemetryUsageAnalytics?: boolean
  telemetryEditStats?: boolean
  telemetryFeedback?: boolean
}

export interface AppSettingsShape {
  lockModel?: boolean
  lockedModel?: string | null
  autoRefresh?: boolean
  autoRefreshInterval?: number
  autoChangeMachineId?: boolean
  browserPath?: string
  autoSwitchEnabled?: boolean
  autoSwitchThreshold?: number
  autoSwitchInterval?: number
  [key: string]: unknown
}

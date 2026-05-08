import { useState, useEffect, useMemo } from 'react'
import { X, Terminal, AlertCircle, Wand2, ClipboardPaste, Check, AlertTriangle } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../../../hooks/useApp'
import { MCP_TEMPLATES } from './MCPTemplates'
import { showSuccess } from '../../../utils/toast'
import { getThemeAccent, getGradientAccentButton } from './themeAccent'
import type { MCPConfigResponse, MCPServerConfig, ParsedMCPServer } from './mcpTypes'
import React from 'react'

const DUPLICATE_STRATEGY_KEY = 'mcpDuplicateStrategy'
type DuplicateStrategy = 'skip' | 'overwrite' | 'rename'

interface AddMCPModalProps {
  onClose: () => void
  onSuccess: () => void
  projectDir: string | null
}

interface ParseResult {
  servers: ParsedMCPServer[]
  error: string | null
}

interface SaveResults {
  success: string[]
  failed: Array<{ name: string; error: string }>
  skipped: string[]
  renamed: Array<{ from: string; to: string }>
}

const asServerConfig = (value: unknown): MCPServerConfig | null => {
  if (!value || typeof value !== 'object') return null
  const obj = value as Record<string, unknown>
  if (typeof obj.command !== 'string' || !obj.command.trim()) return null
  return {
    command: obj.command,
    args: Array.isArray(obj.args) ? obj.args.filter((v): v is string => typeof v === 'string') : [],
    env: obj.env && typeof obj.env === 'object'
      ? Object.fromEntries(Object.entries(obj.env as Record<string, unknown>).filter(([, v]) => typeof v === 'string')) as Record<string, string>
      : {},
    disabled: typeof obj.disabled === 'boolean' ? obj.disabled : false,
    autoApprove: Array.isArray(obj.autoApprove) ? obj.autoApprove.filter((v): v is string => typeof v === 'string') : []
  }
}

function AddMCPModal({ onClose, onSuccess, projectDir }: AddMCPModalProps) {
  const { t, theme } = useApp()
  const accent = useMemo(() => getThemeAccent(theme), [theme])
  const accentGradientButtonClass = getGradientAccentButton(accent)

  const [jsonConfig, setJsonConfig] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [existingServers, setExistingServers] = useState<string[]>([])
  const [duplicates, setDuplicates] = useState<string[]>([])
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>(() => {
    const cached = localStorage.getItem(DUPLICATE_STRATEGY_KEY)
    if (cached === 'overwrite' || cached === 'rename' || cached === 'skip') return cached
    return 'skip'
  })

  const getUniqueServerName = (baseName: string, occupiedNames: Set<string>) => {
    let i = 1
    let candidate = `${baseName}-${i}`
    while (occupiedNames.has(candidate)) {
      i += 1
      candidate = `${baseName}-${i}`
    }
    return candidate
  }

  useEffect(() => {
    invoke<MCPConfigResponse>('get_mcp_config', { projectDir: projectDir || null })
      .then(config => setExistingServers(Object.keys(config.mcpServers || {})))
      .catch(() => {})
  }, [projectDir])

  useEffect(() => {
    localStorage.setItem(DUPLICATE_STRATEGY_KEY, duplicateStrategy)
  }, [duplicateStrategy])

  useEffect(() => {
    const example = { 'server-name': { command: 'uvx', args: ['package-name'] } }
    setJsonConfig(JSON.stringify(example, null, 2))
  }, [])

  useEffect(() => {
    if (!jsonConfig.trim()) {
      setParseResult(null)
      setDuplicates([])
      return
    }

    try {
      const parsed = JSON.parse(jsonConfig) as unknown
      const servers: ParsedMCPServer[] = []

      if (parsed && typeof parsed === 'object' && 'mcpServers' in parsed) {
        const mcpServers = (parsed as { mcpServers?: unknown }).mcpServers
        if (mcpServers && typeof mcpServers === 'object') {
          for (const [name, cfg] of Object.entries(mcpServers as Record<string, unknown>)) {
            const serverConfig = asServerConfig(cfg)
            if (serverConfig) servers.push({ name, config: serverConfig })
          }
        }
      } else if (parsed && typeof parsed === 'object') {
        const maybeServer = asServerConfig(parsed)
        if (maybeServer) {
          setParseResult({ servers: [], error: '请使用 { "name": { ... } } 或 { "mcpServers": { ... } } 格式' })
          setDuplicates([])
          return
        }

        for (const [name, cfg] of Object.entries(parsed as Record<string, unknown>)) {
          const serverConfig = asServerConfig(cfg)
          if (serverConfig) servers.push({ name, config: serverConfig })
        }
      }

      if (servers.length === 0) {
        setParseResult({ servers: [], error: '未找到有效的 MCP 服务配置' })
        setDuplicates([])
      } else {
        setParseResult({ servers, error: null })
        const dups = servers.map(s => s.name).filter(name => existingServers.includes(name))
        setDuplicates(dups)
      }
    } catch {
      setParseResult({ servers: [], error: 'JSON 格式错误' })
      setDuplicates([])
    }
  }, [jsonConfig, existingServers])

  const applyTemplate = (templateName: string) => {
    const template = MCP_TEMPLATES[templateName as keyof typeof MCP_TEMPLATES]
    if (!template) return
    const config = { [templateName]: template }
    setJsonConfig(JSON.stringify(config, null, 2))
    setError('')
  }

  const formatJson = () => {
    try {
      const parsed = JSON.parse(jsonConfig)
      setJsonConfig(JSON.stringify(parsed, null, 2))
    } catch {}
  }

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const parsed = JSON.parse(text)
      setJsonConfig(JSON.stringify(parsed, null, 2))
      setError('')
    } catch {
      setError('剪贴板内容不是有效 JSON')
    }
  }

  const handleSave = async () => {
    if (!parseResult || parseResult.servers.length === 0) {
      setError(parseResult?.error || '没有可保存的配置')
      return
    }

    setSaving(true)
    setError('')

    let latestServers = existingServers
    try {
      const latestConfig = await invoke<MCPConfigResponse>('get_mcp_config', { projectDir: projectDir || null })
      latestServers = Object.keys(latestConfig.mcpServers || {})
      setExistingServers(latestServers)
    } catch {
      // keep cached names
    }

    const occupiedNames = new Set(latestServers)
    const results: SaveResults = { success: [], failed: [], skipped: [], renamed: [] }

    for (const { name, config } of parseResult.servers) {
      let targetName = name

      if (occupiedNames.has(name)) {
        if (duplicateStrategy === 'skip') {
          results.skipped.push(name)
          continue
        }
        if (duplicateStrategy === 'rename') {
          targetName = getUniqueServerName(name, occupiedNames)
          results.renamed.push({ from: name, to: targetName })
        }
      }

      try {
        await invoke('save_mcp_server', { name: targetName, config, projectDir: projectDir || null })
        results.success.push(targetName)
        occupiedNames.add(targetName)
      } catch (e) {
        results.failed.push({ name: targetName, error: String(e) })
      }
    }

    setSaving(false)

    if (results.failed.length > 0) {
      const failedNames = results.failed.map(f => f.name).join(', ')
      const summary: string[] = [`部分失败: ${failedNames}`]
      if (results.success.length > 0) summary.push(`成功: ${results.success.join(', ')}`)
      if (results.skipped.length > 0) summary.push(`跳过: ${results.skipped.join(', ')}`)
      if (results.renamed.length > 0) summary.push(`重命名: ${results.renamed.map(r => `${r.from}→${r.to}`).join(', ')}`)
      setError(summary.join('；'))
      return
    }

    if (results.success.length === 0 && results.skipped.length > 0) {
      setError(`未新增服务，已跳过: ${results.skipped.join(', ')}`)
      return
    }

    const summaryParts: string[] = []
    if (results.success.length > 0) summaryParts.push(`新增 ${results.success.length}`)
    if (results.skipped.length > 0) summaryParts.push(`跳过 ${results.skipped.length}`)
    if (results.renamed.length > 0) summaryParts.push(`重命名 ${results.renamed.length}`)
    if (summaryParts.length > 0) {
      showSuccess(`MCP 服务处理完成：${summaryParts.join('，')}`)
    }

    onSuccess()
  }

  const serverCount = parseResult?.servers?.length || 0
  const serverNames = parseResult?.servers?.map(s => s.name) || []
  const displayNames = serverNames.length > 3
    ? `${serverNames.slice(0, 3).join(', ')} 等 ${serverNames.length} 个`
    : serverNames.join(', ')

  return (
    <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4' onClick={onClose}>
      <div className='relative overflow-hidden glass-card border border-border rounded-lg shadow-2xl w-[560px] max-w-full max-h-[85vh] flex flex-col' onClick={e => e.stopPropagation()}>
        <div className={`absolute top-0 left-0 right-0 h-24 ${accent.bgSoft} pointer-events-none`} />

        <div className='relative flex items-center justify-between px-6 py-4 border-b border-border'>
          <div className='flex items-center gap-3'>
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${accent.gradientFrom} ${accent.gradientTo} flex items-center justify-center shadow-lg ${accent.shadow}`}>
              <Terminal size={20} className='text-white' />
            </div>
            <h2 className='text-base font-semibold text-foreground'>{t('mcpManager.addMCPServer')}</h2>
          </div>
          <button onClick={onClose} className={`cursor-pointer p-2 rounded-lg hover:bg-muted/50 transition-colors duration-200 focus:outline-none focus:ring-2 ${accent.ring}`}>
            <X size={18} className='text-muted-foreground' />
          </button>
        </div>

        <div className='relative flex-1 overflow-auto p-6 space-y-4'>
          <div>
            <label className='block text-xs text-muted-foreground mb-1.5'>快速模板</label>
            <div className='flex flex-wrap gap-1.5'>
              {Object.keys(MCP_TEMPLATES).map(key => (
                <button
                  key={key}
                  onClick={() => applyTemplate(key)}
                  className={`cursor-pointer px-2.5 py-1 text-xs rounded-lg border border-border bg-background border-input ${accent.hoverBorder} text-foreground transition-colors duration-200 focus:outline-none focus:ring-2 ${accent.ring}`}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          <div className='flex-1'>
            <div className='flex items-center justify-between mb-1.5'>
              <div className='flex items-center gap-2 flex-1 min-w-0'>
                <label className='text-xs text-muted-foreground shrink-0'>配置</label>
                {serverCount > 0 && !parseResult?.error && (
                  <span className='text-xs text-green-500 flex items-center gap-1 truncate'>
                    <Check size={12} className='shrink-0' />
                    <span className='truncate'>{displayNames}</span>
                  </span>
                )}
                {parseResult?.error && (
                  <span className='text-xs text-red-500 flex items-center gap-1'>
                    <AlertCircle size={12} />
                    {parseResult.error}
                  </span>
                )}
              </div>
              <div className='flex items-center gap-2 shrink-0'>
                <button onClick={pasteFromClipboard} className={`cursor-pointer text-xs text-muted-foreground ${accent.textHover} flex items-center gap-1 transition-colors duration-200 focus:outline-none focus:ring-2 ${accent.ring}`}>
                  <ClipboardPaste size={12} />粘贴
                </button>
                <button onClick={formatJson} className={`cursor-pointer text-xs text-muted-foreground ${accent.textHover} flex items-center gap-1 transition-colors duration-200 focus:outline-none focus:ring-2 ${accent.ring}`}>
                  <Wand2 size={12} />格式化
                </button>
              </div>
            </div>
            <textarea
              value={jsonConfig}
              onChange={e => setJsonConfig(e.target.value)}
              rows={12}
              spellCheck={false}
              className='w-full px-3 py-2 text-xs border rounded-lg font-mono resize-none bg-background border-input text-foreground focus:ring-primary/20 focus:border-primary focus:ring-2'
            />
            <div className='text-xs text-muted-foreground mt-1.5'>
              支持 {'{ "name": config }'} 或 {'{ "mcpServers": { ... } }'} 格式
            </div>
          </div>

          {duplicates.length > 0 && (
            <div className='text-xs text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg flex flex-col gap-2'>
              <div className='flex items-start gap-2'>
                <AlertTriangle size={14} className='shrink-0 mt-0.5' />
                <span>
                  以下服务已存在: {duplicates.join(', ')}
                  {duplicateStrategy === 'overwrite' && '（将覆盖）'}
                  {duplicateStrategy === 'skip' && '（将跳过）'}
                  {duplicateStrategy === 'rename' && '（将自动重命名）'}
                </span>
              </div>
              <div className='flex items-center gap-1.5 pl-6'>
                <span className='text-muted-foreground'>冲突处理:</span>
                <button onClick={() => setDuplicateStrategy('skip')} className={`cursor-pointer px-2 py-1 rounded border text-xs transition-colors duration-200 focus:outline-none focus:ring-2 ${accent.ring} ${duplicateStrategy === 'skip' ? `${accent.border} ${accent.bgSoft}` : 'border-border hover:bg-muted/50'}`}>跳过</button>
                <button onClick={() => setDuplicateStrategy('overwrite')} className={`cursor-pointer px-2 py-1 rounded border text-xs transition-colors duration-200 focus:outline-none focus:ring-2 ${accent.ring} ${duplicateStrategy === 'overwrite' ? `${accent.border} ${accent.bgSoft}` : 'border-border hover:bg-muted/50'}`}>覆盖</button>
                <button onClick={() => setDuplicateStrategy('rename')} className={`cursor-pointer px-2 py-1 rounded border text-xs transition-colors duration-200 focus:outline-none focus:ring-2 ${accent.ring} ${duplicateStrategy === 'rename' ? `${accent.border} ${accent.bgSoft}` : 'border-border hover:bg-muted/50'}`}>自动重命名</button>
              </div>
            </div>
          )}

          {error && <div className='text-red-500 text-xs bg-red-500/10 px-3 py-2 rounded-lg'>{error}</div>}
        </div>

        <div className='relative flex justify-end gap-3 px-6 py-4 border-t border-border'>
          <button onClick={onClose} className={`cursor-pointer px-5 py-2.5 rounded-lg text-sm text-foreground hover:bg-muted/50 transition-colors duration-200 focus:outline-none focus:ring-2 ${accent.ring}`}>
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || serverCount === 0}
            className={`cursor-pointer px-6 py-2.5 ${accentGradientButtonClass} rounded-lg text-sm font-medium disabled:opacity-50 transition-colors duration-200 focus:outline-none focus:ring-2 ${accent.ring}`}
          >
            {saving ? t('common.saving') : serverCount > 1 ? `添加 ${serverCount} 个` : t('common.add')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddMCPModal

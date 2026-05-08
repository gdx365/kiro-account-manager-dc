import { useState, useEffect, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../../../hooks/useApp'
import { useDialog } from '../../../contexts/DialogContext'
import { Server, Plus, Edit2, Trash2, Terminal, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import AddMCPModal from './AddMCPModal'
import EditMCPModal from './EditMCPModal'
import { handleUiError } from '../../../utils/errorLogger'
import { getThemeAccent, getGradientAccentButton, type ThemeAccent } from './themeAccent'
import type { MCPConfigResponse, MCPServerConfig, MCPToolStatsResponse } from './mcpTypes'
import React from 'react'

interface MCPPanelProps {
  onCountChange?: (count: number) => void
  projectDir: string | null
}

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  accent: ThemeAccent
  clearLabel: string
}

function SearchInput({ value, onChange, placeholder, accent, clearLabel }: SearchInputProps) {
  return (
    <div className='flex-1 max-w-xs relative'>
      <Search size={16} className='absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none' />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className='pl-9 pr-8 h-8 text-foreground bg-background border-input focus:ring-primary/20 focus:border-primary focus:ring-1 transition-colors duration-200'
      />
      {value && (
        <button
          type='button'
          aria-label={clearLabel}
          onClick={() => onChange('')}
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted/50 cursor-pointer transition-colors duration-200 focus:ring-2 ${accent.ring}`}
        >
          <X size={14} className='text-muted-foreground' />
        </button>
      )}
    </div>
  )
}

function MCPPanel({ onCountChange, projectDir }: MCPPanelProps) {
  const { t, theme } = useApp()
  const accent = useMemo(() => getThemeAccent(theme), [theme])
  const accentGradientButtonClass = getGradientAccentButton(accent)
  const { showConfirm } = useDialog()

  const colors = {
    badgeActive: 'bg-primary/20 text-primary border border-primary/30',
    badgeDisabled: 'bg-muted/50 text-muted-foreground border border-border/50',
    toggleOn: 'bg-primary',
    toggleOff: 'bg-muted',
    toggleThumb: 'bg-white',
    warning: 'bg-amber-500/10',
    warningBorder: 'border-amber-500/20'
  }

  const [servers, setServers] = useState<Record<string, MCPServerConfig>>({})
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingServer, setEditingServer] = useState<{ name: string; config: MCPServerConfig } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [toolCount, setToolCount] = useState(0)

  const loadConfig = useCallback(async () => {
    try {
      const config = await invoke<MCPConfigResponse>('get_mcp_config', { projectDir: projectDir || null })
      const mcpServers = config.mcpServers || {}
      setServers(mcpServers)
      onCountChange?.(Object.keys(mcpServers).length)

      const stats = await invoke<MCPToolStatsResponse>('get_mcp_tool_stats', { projectDir: projectDir || null })
      setToolCount(stats.estimatedTools || 0)
    } catch (e) {
      handleUiError('加载 MCP 配置失败', e, { userMessage: '加载 MCP 配置失败' })
    } finally {
      setLoading(false)
    }
  }, [onCountChange, projectDir])

  useEffect(() => { loadConfig() }, [loadConfig])

  const handleToggle = async (name: string, disabled: boolean) => {
    const oldDisabled = servers[name]?.disabled
    setServers(prev => ({ ...prev, [name]: { ...prev[name], disabled } }))
    try {
      await invoke('toggle_mcp_server', { name, disabled, projectDir: projectDir || null })
    } catch (e) {
      setServers(prev => ({ ...prev, [name]: { ...prev[name], disabled: oldDisabled } }))
      handleUiError('切换 MCP 状态失败', e, { userMessage: '切换状态失败' })
    }
  }

  const handleDelete = async (name: string) => {
    if (!await showConfirm(t('mcp.confirmDelete'), `${t('common.confirm')} ${name}?`)) return
    try {
      await invoke('delete_mcp_server', { name, projectDir: projectDir || null })
      setServers(prev => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    } catch (e) {
      handleUiError('删除 MCP 服务失败', e, { userMessage: '删除失败' })
    }
  }

  const serverList = Object.entries(servers)
  const filteredServers = useMemo(() => {
    if (!searchQuery.trim()) return serverList
    const q = searchQuery.toLowerCase()
    return serverList.filter(([name, cfg]) =>
      name.toLowerCase().includes(q) || [cfg.command, ...(cfg.args || [])].join(' ').toLowerCase().includes(q)
    )
  }, [serverList, searchQuery])

  return (
    <div className='h-full flex flex-col max-w-full overflow-x-hidden'>
      {toolCount > 50 && (
        <div className={`mx-6 mt-4 mb-2 px-4 py-3 rounded-xl border-2 ${colors.warning} ${colors.warningBorder} flex items-start gap-3`}>
          <div className='mt-0.5 text-foreground'>⚠️</div>
          <div className='flex-1'>
            <div className='text-sm font-medium text-foreground mb-1'>MCP 工具数量较多</div>
            <div className='text-xs text-muted-foreground leading-relaxed'>
              当前约 {toolCount} 个工具（{serverList.length} 个服务）。过多工具可能影响选择性能，建议禁用不常用服务。
            </div>
          </div>
        </div>
      )}

      <div className='px-6 py-3 border-b border-border flex items-center justify-between gap-4 max-w-full overflow-x-hidden'>
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('common.search')}
          accent={accent}
          clearLabel={t('common.clear')}
        />
        <div className='flex items-center gap-3'>
          <span className='text-sm text-muted-foreground'>{filteredServers.length}/{serverList.length}</span>
          <button
            onClick={() => setShowAddModal(true)}
            className={`cursor-pointer px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${accentGradientButtonClass} transition-colors duration-200 focus:outline-none focus:ring-2 ${accent.ring}`}
          >
            <Plus size={14} />{t('mcp.add')}
          </button>
        </div>
      </div>

      <div className='flex-1 overflow-auto p-6'>
        {loading ? (
          <div className='text-center py-12 text-muted-foreground'>{t('common.loading')}</div>
        ) : serverList.length === 0 ? (
          <div className='text-center py-12'>
            <Server size={48} className='mx-auto mb-4 text-muted-foreground opacity-50' />
            <p className='text-muted-foreground'>{t('mcp.noServers')}</p>
          </div>
        ) : (
          <div className='space-y-3'>
            {filteredServers.map(([name, config]) => (
              <MCPServerItem
                key={name}
                name={name}
                config={config}
                accent={accent}
                colors={colors}
                t={t}
                onToggle={(disabled: boolean) => handleToggle(name, disabled)}
                onEdit={() => setEditingServer({ name, config })}
                onDelete={() => handleDelete(name)}
              />
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddMCPModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); loadConfig() }}
          projectDir={projectDir}
        />
      )}
      {editingServer && (
        <EditMCPModal
          name={editingServer.name}
          config={editingServer.config}
          onClose={() => setEditingServer(null)}
          onSuccess={() => { setEditingServer(null); loadConfig() }}
          projectDir={projectDir}
        />
      )}
    </div>
  )
}

interface MCPServerItemProps {
  name: string
  config: MCPServerConfig
  accent: ThemeAccent
  colors: {
    badgeActive: string
    badgeDisabled: string
    toggleOn: string
    toggleOff: string
    toggleThumb: string
  }
  onToggle: (disabled: boolean) => void
  onEdit: () => void
  onDelete: () => void
  t: (key: string) => string
}

function MCPServerItem({ name, config, accent, colors, onToggle, onEdit, onDelete, t }: MCPServerItemProps) {
  const isDisabled = !!config.disabled
  const commandStr = [config.command, ...(config.args || [])].join(' ')
  const envCount = Object.keys(config.env || {}).length
  const autoApproveCount = config.autoApprove?.length || 0

  return (
    <div className='glass-card border border-border rounded-xl p-4 flex items-center gap-4'>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDisabled ? 'bg-muted/30' : colors.badgeActive}`}>
        <Server size={20} className={isDisabled ? 'text-muted-foreground' : accent.text} />
      </div>

      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-2'>
          <h3 className={`font-semibold text-foreground ${isDisabled ? 'opacity-50' : ''}`}>{name}</h3>
          {isDisabled && <span className={`text-xs px-2 py-0.5 rounded ${colors.badgeDisabled}`}>{t('mcp.disabled')}</span>}
        </div>
        <div className={`flex items-center gap-1.5 text-sm text-muted-foreground ${isDisabled ? 'opacity-50' : ''}`}>
          <Terminal size={12} />
          <code className='truncate'>{commandStr}</code>
        </div>
        {(envCount > 0 || autoApproveCount > 0) && (
          <div className={`flex items-center gap-3 mt-1.5 text-xs text-muted-foreground ${isDisabled ? 'opacity-50' : ''}`}>
            {envCount > 0 && <span className='px-1.5 py-0.5 rounded info-badge'>{envCount} {t('mcpManager.envVars')}</span>}
            {autoApproveCount > 0 && (
              <span className='px-1.5 py-0.5 rounded success-badge'>
                {config.autoApprove?.includes('*') ? `${t('mcpManager.autoApprove')} *` : `${t('mcpManager.autoApprove')} ${autoApproveCount} ${t('mcpManager.tools')}`}
              </span>
            )}
          </div>
        )}
      </div>

      <div className='flex items-center gap-2'>
        <button onClick={() => onToggle(!isDisabled)} className={`cursor-pointer relative w-11 h-6 min-h-[24px] rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 ${accent.ring} ${isDisabled ? colors.toggleOff : colors.toggleOn}`}>
          <div className={`absolute top-0.5 w-5 h-5 ${colors.toggleThumb} rounded-full transition-transform ${isDisabled ? 'left-0.5' : 'left-5'}`} />
        </button>
        <button onClick={onEdit} className={`cursor-pointer p-2 rounded-lg hover:bg-muted/50 transition-colors duration-200 focus:outline-none focus:ring-2 ${accent.ring}`}>
          <Edit2 size={16} className='text-muted-foreground' />
        </button>
        <button onClick={onDelete} className='cursor-pointer p-2 rounded-lg hover:bg-red-500/10 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/60'>
          <Trash2 size={16} className='text-red-500' />
        </button>
      </div>
    </div>
  )
}

export default MCPPanel

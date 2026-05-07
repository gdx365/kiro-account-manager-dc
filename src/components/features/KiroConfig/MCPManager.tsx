import { useState, useEffect, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../../../hooks/useApp'
import { useDialog } from '../../../contexts/DialogContext'
import { Server, Plus, Sparkles } from 'lucide-react'
import MCPServerCard from './MCPServerCard'
import AddMCPModal from './AddMCPModal'
import EditMCPModal from './EditMCPModal'
import { handleUiError } from '../../../utils/errorLogger'
import { getThemeAccent, getGradientAccentButton } from './themeAccent'
import type { MCPConfigResponse, MCPServerConfig } from './mcpTypes'
import React from 'react'

function MCPManager() {
  const { t, theme } = useApp()
  const accent = useMemo(() => getThemeAccent(theme), [theme])
  const accentGradientButtonClass = getGradientAccentButton(accent)
  const { showConfirm } = useDialog()
  const [servers, setServers] = useState<Record<string, MCPServerConfig>>({})
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingServer, setEditingServer] = useState<{ name: string; config: MCPServerConfig } | null>(null)

  const loadConfig = useCallback(async () => {
    try {
      const config = await invoke<MCPConfigResponse>('get_mcp_config', { projectDir: null })
      setServers(config.mcpServers || {})
    } catch (e) {
      handleUiError('加载 MCP 配置失败', e, { userMessage: '加载 MCP 配置失败' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const handleToggle = async (name: string, disabled: boolean) => {
    try {
      await invoke('toggle_mcp_server', { name, disabled, projectDir: null })
      setServers(prev => ({
        ...prev,
        [name]: { ...prev[name], disabled }
      }))
    } catch (e) {
      handleUiError('切换 MCP 状态失败', e, { userMessage: '切换状态失败' })
    }
  }

  const handleDelete = async (name: string) => {
    const confirmed = await showConfirm(t('mcpManager.deleteServer'), `${t('mcpManager.confirmDelete')} ${name}？`)
    if (!confirmed) return

    try {
      await invoke('delete_mcp_server', { name, projectDir: null })
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

  return (
    <div className='h-full flex flex-col glass-main'>
      <div className='glass-card border-b border-border px-6 py-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <div className={`w-10 h-10 bg-gradient-to-br ${accent.gradientFrom} ${accent.gradientTo} rounded-xl flex items-center justify-center shadow-lg ${accent.shadow}`}>
              <Sparkles size={20} className='text-white' />
            </div>
            <div>
              <h1 className='text-xl font-bold text-foreground'>{t('mcpManager.title')}</h1>
              <p className='text-sm text-muted-foreground'>{t('mcpManager.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className={`cursor-pointer px-4 py-2 ${accentGradientButtonClass} rounded-xl text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 ${accent.ring}`}
          >
            <Plus size={16} />{t('mcpManager.addServer')}
          </button>
        </div>
      </div>

      <div className='flex-1 overflow-auto p-6'>
        {loading ? (
          <div className='text-center py-12 text-muted-foreground'>{t('common.loading')}</div>
        ) : serverList.length === 0 ? (
          <div className='text-center py-12'>
            <Server size={48} className='mx-auto mb-4 text-muted-foreground opacity-50' />
            <p className='text-muted-foreground'>{t('mcpManager.noServers')}</p>
            <p className='text-sm text-muted-foreground mt-1'>{t('mcpManager.addFirst')}</p>
          </div>
        ) : (
          <div className='grid gap-4'>
            {serverList.map(([name, config]) => (
              <MCPServerCard
                key={name}
                name={name}
                config={config}
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
          projectDir={null}
        />
      )}

      {editingServer && (
        <EditMCPModal
          name={editingServer.name}
          config={editingServer.config}
          onClose={() => setEditingServer(null)}
          onSuccess={() => { setEditingServer(null); loadConfig() }}
          projectDir={null}
        />
      )}
    </div>
  )
}

export default MCPManager

import { useState, useEffect, useMemo } from 'react'
import { X, Terminal, AlertCircle, Wand2 } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { Textarea } from '@/components/ui/textarea'
import { useApp } from '../../../hooks/useApp'
import { getThemeAccent, getGradientAccentButton } from './themeAccent'
import type { MCPServerConfig } from './mcpTypes'
import React from 'react'

interface EditMCPModalProps {
  name: string
  config: MCPServerConfig
  onClose: () => void
  onSuccess: () => void
  projectDir: string | null
}

function toServerConfig(input: unknown, fallbackDisabled: boolean): MCPServerConfig | null {
  if (!input || typeof input !== 'object') return null
  const obj = input as Record<string, unknown>
  const command = typeof obj.command === 'string' ? obj.command : ''
  if (!command) return null
  const args = Array.isArray(obj.args) ? obj.args.filter((v): v is string => typeof v === 'string') : []
  const env = obj.env && typeof obj.env === 'object'
    ? Object.fromEntries(Object.entries(obj.env as Record<string, unknown>).filter(([, v]) => typeof v === 'string')) as Record<string, string>
    : {}
  const disabled = typeof obj.disabled === 'boolean' ? obj.disabled : fallbackDisabled
  const autoApprove = Array.isArray(obj.autoApprove) ? obj.autoApprove.filter((v): v is string => typeof v === 'string') : []
  return { command, args, env, disabled, autoApprove }
}

function EditMCPModal({ name, config, onClose, onSuccess, projectDir }: EditMCPModalProps) {
  const { t, theme } = useApp()
  const accent = useMemo(() => getThemeAccent(theme), [theme])
  const accentGradientButtonClass = getGradientAccentButton(accent)

  const [jsonConfig, setJsonConfig] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [parseError, setParseError] = useState('')

  useEffect(() => {
    const configObj: MCPServerConfig = {
      command: config.command || '',
      args: config.args || [],
      env: config.env || {},
      disabled: !!config.disabled,
      autoApprove: config.autoApprove || []
    }
    setJsonConfig(JSON.stringify(configObj, null, 2))
  }, [config])

  useEffect(() => {
    if (!jsonConfig.trim()) {
      setParseError('')
      return
    }
    try {
      const parsed = JSON.parse(jsonConfig)
      const nextConfig = toServerConfig(parsed, !!config.disabled)
      if (!nextConfig) {
        setParseError(t('mcpManager.errorNoCommand'))
        return
      }
      setParseError('')
    } catch {
      setParseError('JSON 格式错误')
    }
  }, [jsonConfig, config.disabled, t])

  const formatJson = () => {
    try {
      const parsed = JSON.parse(jsonConfig)
      setJsonConfig(JSON.stringify(parsed, null, 2))
    } catch {}
  }

  const handleSave = async () => {
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonConfig)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(`JSON 格式错误: ${message}`)
      return
    }

    const newConfig = toServerConfig(parsed, !!config.disabled)
    if (!newConfig) {
      setError(t('mcpManager.errorNoCommand'))
      return
    }

    setSaving(true)
    setError('')

    try {
      await invoke('save_mcp_server', { name, config: newConfig, projectDir: projectDir || null })
      onSuccess()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4' onClick={onClose}>
      <div className='relative overflow-hidden glass-card border border-border rounded-lg shadow-2xl w-[520px] max-h-[85vh] flex flex-col' onClick={e => e.stopPropagation()}>
        <div className={`absolute top-0 left-0 right-0 h-24 ${accent.bgSoft} pointer-events-none`} />

        <div className='relative flex items-center justify-between px-6 py-4 border-b border-border'>
          <div className='flex items-center gap-3'>
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${accent.gradientFrom} ${accent.gradientTo} flex items-center justify-center shadow-lg ${accent.shadow}`}>
              <Terminal size={20} className='text-white' />
            </div>
            <h2 className='text-base font-semibold text-foreground'>{t('common.edit')}: {name}</h2>
          </div>
          <button onClick={onClose} className='cursor-pointer p-2 rounded-lg hover:bg-muted/50'>
            <X size={18} className='text-muted-foreground' />
          </button>
        </div>

        <div className='relative flex-1 overflow-auto p-6 space-y-4'>
          <div className='flex-1'>
            <div className='flex items-center justify-between mb-1.5'>
              <div className='flex items-center gap-2'>
                <label className='text-xs text-muted-foreground'>配置</label>
                {parseError && (
                  <span className='text-xs text-red-500 flex items-center gap-1'>
                    <AlertCircle size={12} />
                    {parseError}
                  </span>
                )}
              </div>
              <button onClick={formatJson} className={`cursor-pointer text-xs text-muted-foreground ${accent.textHover} flex items-center gap-1 transition-colors`}>
                <Wand2 size={12} />
                格式化
              </button>
            </div>
            <Textarea
              value={jsonConfig}
              onChange={e => setJsonConfig(e.target.value)}
              rows={16}
              spellCheck={false}
              className={`font-mono text-sm ${parseError ? 'border-red-500/50' : ''} text-foreground bg-background border-input focus:ring-primary/20 focus:border-primary`}
            />
          </div>

          {error && <div className='text-red-500 text-xs bg-red-500/10 px-3 py-2 rounded-lg'>{error}</div>}
        </div>

        <div className='relative flex justify-end gap-3 px-6 py-4 border-t border-border'>
          <button onClick={onClose} className='cursor-pointer px-5 py-2.5 rounded-lg text-sm text-foreground hover:bg-muted/50'>
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !!parseError}
            className={`cursor-pointer px-6 py-2.5 ${accentGradientButtonClass} rounded-lg text-sm font-medium disabled:opacity-50`}
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditMCPModal

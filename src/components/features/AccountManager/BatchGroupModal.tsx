import { useState, useEffect, useMemo } from 'react'
import { Folder, Plus, Check, X } from 'lucide-react'
import { useApp } from '../../../hooks/useApp'
import { useDialog } from '../../../contexts/DialogContext'
import { getGroups, setAccountGroup, addGroup } from '../../../api/groupTag'
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter} from '../../shared/dialog'
import { Button } from '../../shared/button'
import { getThemeAccent } from '../KiroConfig/themeAccent'
import { Account, GroupDefinition } from '../../../types/account'
import React from 'react'

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
]

interface BatchGroupModalProps {
  accountIds: string[];
  accounts?: Account[];
  onClose: () => void;
  onSuccess?: (data: { accountIds: string[]; selectedGroupId: string | null }) => void;
}

function BatchGroupModal({ accountIds, accounts = [], onClose, onSuccess }: BatchGroupModalProps) {
  const { t, theme } = useApp()
  const { showError } = useDialog()

  const accent = useMemo(() => getThemeAccent(theme), [theme])
  const colors = useMemo(() => ({
    inputFocus: 'focus:ring-primary/20 focus:border-primary'
  }), [])
  
  const [groups, setGroups] = useState<GroupDefinition[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [newGroupName, setNewGroupName] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getGroups().then(setGroups).catch(() => {})
  }, [])

  // 计算选中账号的共同分组（交集）
  useEffect(() => {
    if (accounts.length === 0 || accountIds.length === 0) return
    
    const selectedAccounts = accounts.filter(a => accountIds.includes(a.id))
    if (selectedAccounts.length === 0) return
    
    // 获取第一个账号的分组
    const firstGroupId = selectedAccounts[0]?.groupId || ''
    
    // 检查是否所有账号都有相同的分组
    const allSameGroup = selectedAccounts.every(account => (account.groupId || '') === firstGroupId)
    
    if (allSameGroup) {
      setSelectedGroupId(firstGroupId)
    } else {
      // 如果分组不一致，默认为空（无分组）
      setSelectedGroupId('')
    }
  }, [accounts, accountIds])

  const handleAddGroup = async () => {
    const trimmed = newGroupName.trim().slice(0, 20)
    if (!trimmed) return
    
    const existing = groups.find(g => g.name === trimmed)
    if (existing) {
      setSelectedGroupId(existing.id)
      setNewGroupName('')
      setShowInput(false)
      return
    }
    
    const color = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
    try {
      const newGroup = await addGroup(trimmed, color) as GroupDefinition
      setGroups([...groups, newGroup])
      setSelectedGroupId(newGroup.id)
      setNewGroupName('')
      setShowInput(false)
    } catch (e) {
      await showError(t('common.error'), String(e))
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await Promise.all(accountIds.map(id => setAccountGroup(id, selectedGroupId || null)))
      onSuccess?.({ accountIds, selectedGroupId: selectedGroupId || null })
      onClose()
    } catch (e) {
      await showError(t('common.error'), String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogRoot open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent maxWidth="480px">
        <DialogHeader icon={Folder} iconColor={accent.text} iconBg={accent.iconBadgeBg}>
          <DialogTitle>{t('groups.batchSet') || '批量设置分组'}</DialogTitle>
          <DialogDescription>{accountIds.length} 个账号</DialogDescription>
        </DialogHeader>

        <DialogBody gap="md">
          {/* 当前选择的分组 */}
          <div>
            <label className={`block text-sm font-semibold text-foreground mb-3`}>
              {t('groups.selected') || '选择分组'}
            </label>
            
            {showInput ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddGroup()
                    } else if (e.key === 'Escape') {
                      setShowInput(false)
                      setNewGroupName('')
                    }
                  }}
                  placeholder={t('groups.newGroupPlaceholder') || '输入新分组名...'}
                  className={`flex-1 px-4 py-3 border-2 rounded-xl text-foreground bg-background border-input ${colors.inputFocus} focus:ring-2 transition-all outline-none`}
                  autoFocus
                />
                <button
                  onClick={handleAddGroup}
                  disabled={!newGroupName.trim()}
                  className={`px-4 py-3 ${accent.solidBg} text-white rounded-xl ${accent.solidHoverBg} disabled:opacity-50 transition-all shadow-lg ${accent.shadow} hover:shadow-xl disabled:shadow-none cursor-pointer`}
                  title={t('groups.addGroup') || '添加分组'}
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => { setShowInput(false); setNewGroupName('') }}
                  className={`px-4 py-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer`}
                  title={t('common.cancel')}
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className={`flex-1 px-4 py-3 border-2 rounded-xl text-foreground bg-background border-input ${colors.inputFocus} focus:ring-2 transition-all outline-none`}
                >
                  <option value="">{t('groups.noGroup') || '无分组'}</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowInput(true)}
                  className={`px-4 py-3 ${accent.solidBg} text-white rounded-xl ${accent.solidHoverBg} transition-all shadow-lg ${accent.shadow} hover:shadow-xl cursor-pointer`}
                  title={t('groups.addGroup') || '添加分组'}
                >
                  <Plus size={18} />
                </button>
              </div>
            )}
            
            <p className={`text-xs text-foreground opacity-60 mt-2 leading-relaxed`}>
              {t('groups.batchHint') || '选择一个分组应用到所有选中的账号，或创建新分组'}
            </p>
          </div>

          {/* 当前分组预览 */}
          {selectedGroupId && (
            <div className={`p-4 rounded-xl border ${accent.subtleBg} border-primary/10`}>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ 
                  backgroundColor: groups.find(g => g.id === selectedGroupId)?.color || '#8b5cf6' 
                }} />
                <span className="text-sm font-medium text-foreground">
                  {groups.find(g => g.id === selectedGroupId)?.name || ''}
                </span>
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            loading={loading}
          >
            {loading ? t('common.saving') : t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}

export default BatchGroupModal

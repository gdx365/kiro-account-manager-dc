import { FolderOpen, Globe } from 'lucide-react'

export interface AccentLike {
  scopeBadge: string
}

export function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
}

export function ScopeBadge({ scope, accent }: { scope: string; accent: AccentLike }) {
  if (scope === 'project') {
    return (
      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-500 border border-amber-500/30">
        <FolderOpen size={10} />项目
      </span>
    )
  }
  return (
    <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${accent.scopeBadge}`}>
      <Globe size={10} />用户
    </span>
  )
}


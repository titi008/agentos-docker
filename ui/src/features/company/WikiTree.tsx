'use client'

import { ChevronDown, ChevronRight, FileText, Folder } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

import type { WikiPageMeta } from './types'

interface TreeFolder {
  name: string
  path: string
  folders: TreeFolder[]
  pages: WikiPageMeta[]
  /** Pages in this folder and below. */
  total: number
}

const PINNED = ['brief.md', 'status.md']

function pageOrder(a: WikiPageMeta, b: WikiPageMeta): number {
  const pinA = PINNED.indexOf(a.path)
  const pinB = PINNED.indexOf(b.path)
  if (pinA !== -1 || pinB !== -1) {
    return (pinA === -1 ? 99 : pinA) - (pinB === -1 ? 99 : pinB)
  }
  return a.path.localeCompare(b.path)
}

/** Groups flat page paths into folders by their `/` segments. */
export function buildTree(pages: WikiPageMeta[]): TreeFolder {
  const root: TreeFolder = {
    name: '',
    path: '',
    folders: [],
    pages: [],
    total: 0
  }
  for (const page of [...pages].sort(pageOrder)) {
    const segments = page.path.split('/')
    let folder = root
    folder.total += 1
    for (const segment of segments.slice(0, -1)) {
      const path = folder.path ? `${folder.path}/${segment}` : segment
      let child = folder.folders.find((item) => item.name === segment)
      if (!child) {
        child = { name: segment, path, folders: [], pages: [], total: 0 }
        folder.folders.push(child)
      }
      child.total += 1
      folder = child
    }
    folder.pages.push(page)
  }
  const sortFolders = (folder: TreeFolder) => {
    folder.folders.sort((a, b) => a.name.localeCompare(b.name))
    folder.folders.forEach(sortFolders)
  }
  sortFolders(root)
  return root
}

const rowClass =
  'flex min-h-[34px] w-full min-w-0 items-center gap-2 rounded-lg pr-2 text-left text-[13px] text-fg-2 transition-colors hover:bg-hover hover:text-fg max-md:min-h-11 [&_svg]:size-3.5 [&_svg]:shrink-0'

interface LevelProps {
  folder: TreeFolder
  depth: number
  selectedPath: string | null
  onSelect: (path: string) => void
  collapsed: Set<string>
  onToggle: (path: string) => void
  forceExpanded: boolean
}

function TreeLevel({
  folder,
  depth,
  selectedPath,
  onSelect,
  collapsed,
  onToggle,
  forceExpanded
}: LevelProps) {
  const indent = { paddingLeft: 8 + depth * 18 }
  return (
    <>
      {folder.pages.map((page) => {
        const selected = page.path === selectedPath
        const name = page.path.split('/').pop() ?? page.path
        return (
          <li key={page.path}>
            <button
              type="button"
              title={page.path}
              aria-current={selected ? 'page' : undefined}
              onClick={() => onSelect(page.path)}
              className={cn(
                rowClass,
                selected && 'bg-raised text-fg ring-1 ring-line ring-inset'
              )}
              style={indent}
            >
              <FileText
                aria-hidden
                className={selected ? 'text-accent' : 'text-fg-3'}
              />
              <span className="min-w-0 truncate font-mono text-[12.5px]">
                {name}
              </span>
              {page.version !== null && page.version !== undefined ? (
                <span className="ml-auto shrink-0 font-mono text-[11.5px] text-fg-3">
                  v{page.version}
                </span>
              ) : null}
            </button>
          </li>
        )
      })}
      {folder.folders.map((child) => {
        const expanded = forceExpanded || !collapsed.has(child.path)
        return (
          <li key={child.path}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => onToggle(child.path)}
              className={rowClass}
              style={indent}
            >
              {expanded ? (
                <ChevronDown aria-hidden className="text-fg-3" />
              ) : (
                <ChevronRight aria-hidden className="text-fg-3" />
              )}
              <Folder aria-hidden className="text-fg-3" />
              <span className="min-w-0 truncate font-mono text-[12.5px]">
                {child.name}/
              </span>
              <span className="ml-auto shrink-0 text-xs text-fg-3">
                {child.total} {child.total === 1 ? 'page' : 'pages'}
              </span>
            </button>
            {expanded ? (
              <ul className="flex flex-col gap-0.5">
                <TreeLevel
                  folder={child}
                  depth={depth + 1}
                  selectedPath={selectedPath}
                  onSelect={onSelect}
                  collapsed={collapsed}
                  onToggle={onToggle}
                  forceExpanded={forceExpanded}
                />
              </ul>
            ) : null}
          </li>
        )
      })}
    </>
  )
}

/** Wiki pages grouped into folders, each with its version. */
export function WikiTree({
  pages,
  selectedPath,
  onSelect,
  forceExpanded
}: {
  pages: WikiPageMeta[]
  selectedPath: string | null
  onSelect: (path: string) => void
  /** Expand every folder, e.g. while searching. */
  forceExpanded: boolean
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const tree = buildTree(pages)
  const toggle = (path: string) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  return (
    <nav aria-label="Page tree">
      <ul className="flex flex-col gap-0.5">
        <TreeLevel
          folder={tree}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
          collapsed={collapsed}
          onToggle={toggle}
          forceExpanded={forceExpanded}
        />
      </ul>
    </nav>
  )
}

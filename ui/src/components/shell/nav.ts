import {
  Activity,
  BookOpen,
  Briefcase,
  Clock,
  LayoutGrid,
  MessageSquare,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon
} from 'lucide-react'

import type { RouteTab } from '@/components/ui/page'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** Path prefix that marks the item active. */
  match: string
  badge?: 'approvals'
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Work',
    items: [
      { label: 'Chat', href: '/', icon: MessageSquare, match: '/' },
      {
        label: 'Approvals',
        href: '/approvals',
        icon: ShieldCheck,
        match: '/approvals',
        badge: 'approvals'
      },
      {
        label: 'Company',
        href: '/company/tasks',
        icon: Briefcase,
        match: '/company'
      },
      {
        label: 'Automations',
        href: '/automations/schedules',
        icon: Clock,
        match: '/automations'
      }
    ]
  },
  {
    label: 'Build',
    items: [
      {
        label: 'Studio',
        href: '/studio/agents',
        icon: LayoutGrid,
        match: '/studio'
      },
      {
        label: 'Knowledge',
        href: '/knowledge/documents',
        icon: BookOpen,
        match: '/knowledge'
      },
      {
        label: 'Monitoring',
        href: '/monitoring/traces',
        icon: Activity,
        match: '/monitoring'
      }
    ]
  }
]

export const SETTINGS_NAV: NavItem = {
  label: 'Settings',
  href: '/settings',
  icon: SlidersHorizontal,
  match: '/settings'
}

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.match === '/') return pathname === '/'
  return pathname === item.match || pathname.startsWith(`${item.match}/`)
}

/** Section titles, purposes and tabs. Use these so labels match everywhere. */
export const SECTIONS = {
  company: {
    title: 'Company',
    description: 'Products, projects and tasks run by Company Manager.',
    tabs: [
      { href: '/company/tasks', label: 'Tasks' },
      { href: '/company/wiki', label: 'Wiki' }
    ]
  },
  automations: {
    title: 'Automations',
    description: 'Recurring routines and background jobs.',
    tabs: [
      { href: '/automations/schedules', label: 'Schedules' },
      { href: '/automations/queue', label: 'Job queue' }
    ]
  },
  studio: {
    title: 'Studio',
    description:
      'Build and manage agents, teams, workflows and the building blocks they use.',
    tabs: [
      { href: '/studio/agents', label: 'Agents' },
      { href: '/studio/teams', label: 'Teams' },
      { href: '/studio/workflows', label: 'Workflows' },
      { href: '/studio/registry', label: 'Registry' }
    ]
  },
  knowledge: {
    title: 'Knowledge',
    description: 'What your agents know, remember and have written down.',
    tabs: [
      { href: '/knowledge/documents', label: 'Documents' },
      { href: '/knowledge/files', label: 'Notes & files' },
      { href: '/knowledge/memories', label: 'Memories' },
      { href: '/knowledge/profiles', label: 'Learned profiles' }
    ]
  },
  monitoring: {
    title: 'Monitoring',
    description: 'Runs, costs and quality across your agents.',
    tabs: [
      { href: '/monitoring/traces', label: 'Traces' },
      { href: '/monitoring/usage', label: 'Usage & costs' },
      { href: '/monitoring/evals', label: 'Evaluations' }
    ]
  }
} satisfies Record<
  string,
  { title: string; description: string; tabs: RouteTab[] }
>

/**
 * Deep links that open a create dialog, used by the command palette.
 * Each view reads the `new` query param and clears it when the dialog closes.
 */
export const CREATE_LINKS = {
  task: '/company/tasks?new=task',
  product: '/company/tasks?new=product',
  project: '/company/tasks?new=project',
  wikiPage: '/company/wiki?new=page',
  agent: '/studio/agents?new=agent',
  team: '/studio/teams?new=team',
  workflow: '/studio/workflows?new=workflow',
  document: '/knowledge/documents?new=document',
  memory: '/knowledge/memories?new=memory'
} as const

/** Chat deep link for an agent, team or workflow. */
export function chatHref(
  kind: 'agent' | 'team' | 'workflow',
  id: string,
  sessionId?: string
): string {
  const params = new URLSearchParams({ [kind]: id })
  if (sessionId) params.set('session', sessionId)
  return `/?${params.toString()}`
}

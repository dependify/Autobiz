'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  FileText,
  Share2,
  Search,
  Zap,
  FileSignature,
  Receipt,
  BarChart3,
  PhoneCall,
  Globe,
  Settings,
  ChevronRight,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/crm', label: 'CRM', icon: Users },
  { href: '/dashboard/content', label: 'Content', icon: FileText },
  { href: '/dashboard/social', label: 'Social', icon: Share2 },
  { href: '/dashboard/seo', label: 'SEO', icon: Search },
  { href: '/dashboard/leads', label: 'Leads', icon: Zap },
  { href: '/dashboard/proposals', label: 'Proposals', icon: FileSignature },
  { href: '/dashboard/invoices', label: 'Invoices', icon: Receipt },
  { href: '/dashboard/accounting', label: 'Accounting', icon: BarChart3 },
  { href: '/dashboard/voice', label: 'Voice', icon: PhoneCall },
  { href: '/dashboard/website', label: 'Website', icon: Globe },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <aside className="w-60 flex-shrink-0 bg-card border-r border-border flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xs">D</span>
          </div>
          <span className="font-semibold text-foreground">Dependify</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors group',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight className="w-3 h-3 opacity-50" />}
            </Link>
          )
        })}
      </nav>

      {/* User info / upgrade prompt */}
      <div className="p-4 border-t border-border">
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-xs font-medium text-foreground">Starter Plan</p>
          <p className="text-xs text-muted-foreground mt-0.5">Upgrade for more features</p>
          <button className="mt-2 w-full py-1.5 px-3 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:opacity-90 transition-opacity">
            Upgrade
          </button>
        </div>
      </div>
    </aside>
  )
}

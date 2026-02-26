'use client'

import { Bell, Search } from 'lucide-react'
import { getInitials } from '@/lib/utils'

export function TopBar() {
  // In a real app this would come from auth context
  const userName = 'Business Owner'

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 flex-shrink-0">
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-lg">
        <div className="flex items-center gap-2 w-full bg-background border border-border rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Search contacts, content, invoices..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground focus:outline-none"
          />
          <kbd className="hidden sm:block px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded border border-border">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="relative p-2 hover:bg-muted rounded-lg transition-colors">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
        </button>

        {/* User avatar */}
        <button className="flex items-center gap-2 hover:bg-muted rounded-lg px-2 py-1.5 transition-colors">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-medium">{getInitials(userName)}</span>
          </div>
          <span className="text-sm text-foreground hidden sm:block">{userName}</span>
        </button>
      </div>
    </header>
  )
}

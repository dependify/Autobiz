import { TrendingUp, Users, FileText, DollarSign, Calendar, PhoneCall, AlertCircle, Sparkles } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

// Metric card component
function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  currency,
}: {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: React.ComponentType<{ className?: string }>
  currency?: string
}) {
  const displayValue = currency
    ? formatCurrency(Number(value), currency)
    : value

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground font-medium">{title}</span>
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold text-foreground">{displayValue}</span>
        {change !== undefined && (
          <span className={`text-xs font-medium ${change >= 0 ? 'text-green-500' : 'text-destructive'}`}>
            {change >= 0 ? '+' : ''}{change}% {changeLabel}
          </span>
        )}
      </div>
    </div>
  )
}

// AI insight card
function AIInsightCard() {
  return (
    <div className="bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/20 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">AI Insight of the Day</span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Your top 3 leads from last week haven&apos;t been contacted in 5 days. 
        Consider reaching out to <strong className="text-foreground">TechCorp Ltd</strong> — 
        they viewed your proposal twice. A personalized follow-up could close this deal.
      </p>
      <button className="mt-3 text-xs font-medium text-primary hover:underline">
        Take action →
      </button>
    </div>
  )
}

export default function DashboardPage() {
  // In a real app these would come from API calls
  const metrics = [
    { title: 'Revenue This Month', value: 2450000, currency: 'NGN', change: 12.5, changeLabel: 'vs last month', icon: DollarSign },
    { title: 'Open Deals Value', value: 8900000, currency: 'NGN', change: 3.2, changeLabel: 'new this week', icon: TrendingUp },
    { title: 'New Leads (7d)', value: 24, change: 8, changeLabel: 'vs last week', icon: Users },
    { title: 'Pending Invoices', value: 7, icon: FileText },
  ]

  const upcomingPosts = [
    { platform: 'Instagram', content: 'Why Nigerian SMEs need digital presence...', scheduledAt: 'Today 10:00 AM' },
    { platform: 'LinkedIn', content: '5 ways to automate your business in 2024', scheduledAt: 'Tomorrow 9:00 AM' },
  ]

  const recentCalls = [
    { contact: 'Adaeze Okafor', duration: '4m 32s', sentiment: 'positive', time: '2h ago' },
    { contact: 'Emeka Chukwu', duration: '8m 15s', sentiment: 'neutral', time: '4h ago' },
  ]

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Business Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Monday, 24 February 2026</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Insight + Upcoming */}
        <div className="lg:col-span-2 space-y-4">
          <AIInsightCard />

          {/* Upcoming scheduled posts */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground text-sm">Scheduled Posts</h3>
              <a href="/dashboard/content" className="text-xs text-primary hover:underline">View all</a>
            </div>
            <div className="space-y-3">
              {upcomingPosts.map((post, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-primary">{post.platform}</span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                        <Calendar className="w-3 h-3" />
                        {post.scheduledAt}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">{post.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Pending invoices */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              <h3 className="font-semibold text-foreground text-sm">7 Pending Invoices</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(1280000, 'NGN')} outstanding
            </p>
            <a href="/dashboard/invoices" className="mt-2 block text-xs text-primary hover:underline">
              View &amp; send reminders →
            </a>
          </div>

          {/* Recent calls */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground text-sm">Recent Calls</h3>
              <a href="/dashboard/voice" className="text-xs text-primary hover:underline">View all</a>
            </div>
            <div className="space-y-3">
              {recentCalls.map((call, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <PhoneCall className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-foreground font-medium">{call.contact}</p>
                      <p className="text-xs text-muted-foreground">{call.duration} · {call.time}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    call.sentiment === 'positive'
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {call.sentiment}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

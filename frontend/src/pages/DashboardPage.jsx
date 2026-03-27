import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || ''

// 상태별 색상/라벨
const healthConfig = {
  red:    { bg: 'bg-red-50',    border: 'border-red-300',    badge: 'bg-red-100 text-red-700',    dot: 'bg-red-500',    label: '긴급' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-300', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', label: '주의' },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500', label: '모니터링' },
  green:  { bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100 text-green-700',  dot: 'bg-green-500',  label: '정상' },
  gray:   { bg: 'bg-gray-50',   border: 'border-gray-200',   badge: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400',   label: 'Prospect' },
}

const priorityConfig = {
  urgent: { color: 'text-red-600',    bg: 'bg-red-50 border-red-200',    label: '긴급' },
  high:   { color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', label: '높음' },
  medium: { color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200',   label: '보통' },
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
  return diff
}

function ContractBadge({ subscriptionEnd, status }) {
  if (status === 'churned') return (
    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">해지</span>
  )
  if (status === 'prospect') return (
    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Prospect</span>
  )
  if (!subscriptionEnd) return null
  const days = daysUntil(subscriptionEnd)
  if (days < 0) return <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">만료됨</span>
  if (days <= 60) return <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">D-{days}</span>
  if (days <= 90) return <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">D-{days}</span>
  return <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{subscriptionEnd?.slice(0, 7)}</span>
}

function AccountCard({ account }) {
  const cfg = healthConfig[account.health] || healthConfig.gray
  const days = daysUntil(account.subscription_end)
  const arrNum = account.arr ? parseInt(account.arr) : 0

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 space-y-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 font-medium">{account.group}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>{cfg.label}</span>
          </div>
          <p className="font-semibold text-gray-900 mt-0.5 text-sm leading-tight">{account.key_account}</p>
        </div>
        <ContractBadge subscriptionEnd={account.subscription_end} status={account.status} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          {arrNum > 0 ? (
            <p className="text-lg font-bold text-gray-900">
              ${arrNum >= 1000 ? (arrNum / 1000).toFixed(0) + 'K' : arrNum}
              <span className="text-xs font-normal text-gray-400 ml-1">ARR</span>
            </p>
          ) : (
            <p className="text-sm text-gray-400">계약 없음</p>
          )}
          {account.amplitude_plan && (
            <span className="text-xs text-purple-600 font-medium">{account.amplitude_plan}</span>
          )}
        </div>
        {account.deal_stage && (
          <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-lg max-w-[120px] text-right leading-tight">
            {account.deal_stage}
          </span>
        )}
      </div>

      {account.next_action && (
        <div className="pt-1 border-t border-gray-200">
          <p className="text-xs text-gray-600">
            <span className="text-gray-400">→ </span>{account.next_action}
          </p>
        </div>
      )}
      {account.notes_summary && (
        <p className="text-xs text-gray-500 italic">"{account.notes_summary}"</p>
      )}
    </div>
  )
}

function ActionItem({ item }) {
  const cfg = priorityConfig[item.priority] || priorityConfig.medium
  return (
    <div className={`rounded-xl border ${cfg.bg} p-3 flex gap-3 items-start`}>
      <span className={`text-xs font-bold ${cfg.color} mt-0.5 shrink-0`}>{cfg.label}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 leading-snug">{item.action}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-400">{item.group} · {item.account}</span>
          {item.due && <span className="text-xs text-gray-400">· {item.due}</span>}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')  // all | urgent | active | prospect

  useEffect(() => {
    fetch(`${API}/api/intel/report`)
      .then(r => r.json())
      .then(data => { setReport(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"/>
        <p className="text-sm text-gray-500">데이터 로딩 중...</p>
      </div>
    </div>
  )

  if (!report) return (
    <div className="text-center py-16 text-gray-400">데이터를 불러올 수 없습니다</div>
  )

  const accounts = report.accounts || []
  const actions = report.action_items || []
  const risks = report.risks || []

  // 통계
  const stats = {
    total_arr: accounts.filter(a => a.arr).reduce((s, a) => s + parseInt(a.arr || 0), 0),
    active: accounts.filter(a => a.status === 'active').length,
    urgent: accounts.filter(a => a.health === 'red').length,
    churned: accounts.filter(a => a.status === 'churned').length,
    prospect: accounts.filter(a => a.status === 'prospect').length,
  }

  const filtered = accounts.filter(a => {
    if (filter === 'urgent') return a.health === 'red' || a.health === 'orange'
    if (filter === 'active') return a.status === 'active'
    if (filter === 'prospect') return a.status === 'prospect' || a.status === 'churned'
    return true
  })

  const sortedAccounts = [...filtered].sort((a, b) => {
    const order = { red: 0, orange: 1, yellow: 2, green: 3, gray: 4 }
    return (order[a.health] ?? 5) - (order[b.health] ?? 5)
  })

  return (
    <div className="space-y-5 pb-24">
      {/* 리포트 생성 시간 */}
      {report.generated_at ? (
        <div className="text-xs text-gray-400 text-center">
          마지막 업데이트: {new Date(report.generated_at).toLocaleString('ko-KR')}
        </div>
      ) : (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-700">
          <p className="font-medium">주간 리포트가 아직 생성되지 않았습니다</p>
          <p className="text-xs mt-1 text-purple-500">Claude Code에서 "주간보고 해줘"라고 입력하면 자동 생성됩니다</p>
        </div>
      )}

      {/* 요약 통계 */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-xl font-bold text-gray-900">{stats.active}</p>
          <p className="text-xs text-gray-500 mt-0.5">활성</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-3 text-center">
          <p className="text-xl font-bold text-red-600">{stats.urgent}</p>
          <p className="text-xs text-red-500 mt-0.5">긴급</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-xl font-bold text-gray-900">{stats.prospect}</p>
          <p className="text-xs text-gray-500 mt-0.5">Prospect</p>
        </div>
        <div className="bg-purple-50 rounded-xl border border-purple-200 p-3 text-center">
          <p className="text-lg font-bold text-purple-700">
            ${Math.round(stats.total_arr / 1000)}K
          </p>
          <p className="text-xs text-purple-500 mt-0.5">총 ARR</p>
        </div>
      </div>

      {/* 전략 요약 */}
      {report.strategy_summary && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-purple-600 mb-1">전략 요약</p>
          <p className="text-sm text-gray-700 leading-relaxed">{report.strategy_summary}</p>
        </div>
      )}

      {/* Action Items */}
      {actions.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <span>할 일</span>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{actions.length}</span>
          </h2>
          {actions.map((item, i) => <ActionItem key={i} item={item} />)}
        </div>
      )}

      {/* 계정 현황 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">계정 현황</h2>
          <div className="flex gap-1">
            {[['all','전체'], ['urgent','긴급'], ['active','활성'], ['prospect','잠재']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  filter === val
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {sortedAccounts.map((account, i) => (
          <AccountCard key={i} account={account} />
        ))}
      </div>

      {/* 리스크 */}
      {risks.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-gray-900">리스크</h2>
          {risks.map((r, i) => (
            <div key={i} className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 items-start">
              <span className="text-red-500 text-sm shrink-0">⚠</span>
              <div>
                <p className="text-xs font-semibold text-red-700">{r.account}</p>
                <p className="text-xs text-red-600 mt-0.5">{r.risk}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

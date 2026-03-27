import { useState, useEffect } from 'react'
import { useLang } from '../contexts/LanguageContext'

// lang에 따라 ko/en 필드 선택 헬퍼
function pick(obj, key, lang) {
  return (lang === 'en' && obj[`${key}_en`]) ? obj[`${key}_en`] : obj[key]
}

const API = import.meta.env.VITE_API_URL || ''

function getHealthConfig(t) {
  return {
    red:    { bg: 'bg-red-50',    border: 'border-red-300',    badge: 'bg-red-100 text-red-700',       dot: 'bg-red-500',    label: t('healthRed') },
    orange: { bg: 'bg-orange-50', border: 'border-orange-300', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', label: t('healthOrange') },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500', label: t('healthYellow') },
    green:  { bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500',  label: t('healthGreen') },
    gray:   { bg: 'bg-gray-50',   border: 'border-gray-200',   badge: 'bg-gray-100 text-gray-600',     dot: 'bg-gray-400',   label: t('healthGray') },
  }
}

function getPriorityConfig(t) {
  return {
    urgent: { color: 'text-red-600',    bg: 'bg-red-50 border-red-200',       label: t('priorityUrgent') },
    high:   { color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', label: t('priorityHigh') },
    medium: { color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200',     label: t('priorityMedium') },
  }
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
}

function ContractBadge({ subscriptionEnd, status, t }) {
  if (status === 'churned') return (
    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">{t('churned')}</span>
  )
  if (status === 'prospect') return (
    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Prospect</span>
  )
  if (!subscriptionEnd) return null
  const days = daysUntil(subscriptionEnd)
  if (days < 0)   return <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">{t('expired')}</span>
  if (days <= 60)  return <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">D-{days}</span>
  if (days <= 90)  return <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">D-{days}</span>
  return <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{subscriptionEnd?.slice(0, 7)}</span>
}

function AccountCard({ account, t, lang }) {
  const healthConfig = getHealthConfig(t)
  const cfg = healthConfig[account.health] || healthConfig.gray
  const arrNum = account.arr ? parseInt(account.arr) : 0
  const dealStage   = pick(account, 'deal_stage', lang)
  const nextAction  = pick(account, 'next_action', lang)
  const notesSummary = pick(account, 'notes_summary', lang)

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
        <ContractBadge subscriptionEnd={account.subscription_end} status={account.status} t={t} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          {arrNum > 0 ? (
            <p className="text-lg font-bold text-gray-900">
              ${arrNum >= 1000 ? (arrNum / 1000).toFixed(0) + 'K' : arrNum}
              <span className="text-xs font-normal text-gray-400 ml-1">ARR</span>
            </p>
          ) : (
            <p className="text-sm text-gray-400">{t('noContract')}</p>
          )}
          {account.amplitude_plan && (
            <span className="text-xs text-purple-600 font-medium">{account.amplitude_plan}</span>
          )}
        </div>
        {dealStage && (
          <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-lg max-w-[130px] text-right leading-tight">
            {dealStage}
          </span>
        )}
      </div>

      {nextAction && (
        <div className="pt-1 border-t border-gray-200">
          <p className="text-xs text-gray-600">{t('nextAction')}{nextAction}</p>
        </div>
      )}
      {notesSummary && (
        <p className="text-xs text-gray-500 italic">"{notesSummary}"</p>
      )}
    </div>
  )
}

function ActionItem({ item, t, lang }) {
  const priorityConfig = getPriorityConfig(t)
  const cfg = priorityConfig[item.priority] || priorityConfig.medium
  const action = pick(item, 'action', lang)
  return (
    <div className={`rounded-xl border ${cfg.bg} p-3 flex gap-3 items-start`}>
      <span className={`text-xs font-bold ${cfg.color} mt-0.5 shrink-0`}>{cfg.label}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 leading-snug">{action}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-gray-400">{item.group} · {item.account}</span>
          {item.due && <span className="text-xs text-gray-400">· {item.due}</span>}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { t, lang } = useLang()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

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
        <p className="text-sm text-gray-500">{t('loadingData')}</p>
      </div>
    </div>
  )

  if (!report) return (
    <div className="text-center py-16 text-gray-400">{t('loadError')}</div>
  )

  const accounts = report.accounts || []
  const actions  = report.action_items || []
  const risks    = report.risks || []

  const stats = {
    total_arr: accounts.filter(a => a.arr).reduce((s, a) => s + parseInt(a.arr || 0), 0),
    active:    accounts.filter(a => a.status === 'active').length,
    urgent:    accounts.filter(a => a.health === 'red').length,
    prospect:  accounts.filter(a => a.status === 'prospect').length,
  }

  const filterMap = { urgent: ['red','orange'], active: ['active'], prospect: ['prospect','churned'] }
  const filtered = accounts.filter(a => {
    if (filter === 'urgent')  return ['red','orange'].includes(a.health)
    if (filter === 'active')  return a.status === 'active'
    if (filter === 'prospect') return ['prospect','churned'].includes(a.status)
    return true
  })
  const sorted = [...filtered].sort((a, b) => {
    const order = { red: 0, orange: 1, yellow: 2, green: 3, gray: 4 }
    return (order[a.health] ?? 5) - (order[b.health] ?? 5)
  })

  const filters = [
    ['all',     t('filterAll')],
    ['urgent',  t('filterUrgent')],
    ['active',  t('filterActive')],
    ['prospect',t('filterProspect')],
  ]

  return (
    <div className="space-y-5 pb-24">
      {/* 리포트 상태 */}
      {report.generated_at ? (
        <p className="text-xs text-gray-400 text-center">
          {t('lastUpdated')}: {new Date(report.generated_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
        </p>
      ) : (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-700">
          <p className="font-medium">{t('noReport')}</p>
          <p className="text-xs mt-1 text-purple-500">{t('noReportSub')}</p>
        </div>
      )}

      {/* 요약 통계 */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-xl font-bold text-gray-900">{stats.active}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('statActive')}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-3 text-center">
          <p className="text-xl font-bold text-red-600">{stats.urgent}</p>
          <p className="text-xs text-red-500 mt-0.5">{t('statUrgent')}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-xl font-bold text-gray-900">{stats.prospect}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('statProspect')}</p>
        </div>
        <div className="bg-purple-50 rounded-xl border border-purple-200 p-3 text-center">
          <p className="text-lg font-bold text-purple-700">${Math.round(stats.total_arr / 1000)}K</p>
          <p className="text-xs text-purple-500 mt-0.5">{t('statTotalArr')}</p>
        </div>
      </div>

      {/* 전략 요약 */}
      {(report.strategy_summary || report.strategy_summary_en) && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-purple-600 mb-1">{t('strategySummary')}</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            {pick(report, 'strategy_summary', lang)}
          </p>
        </div>
      )}

      {/* Action Items */}
      {actions.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            {t('actionItems')}
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{actions.length}</span>
          </h2>
          {actions.map((item, i) => <ActionItem key={i} item={item} t={t} lang={lang} />)}
        </div>
      )}

      {/* 계정 현황 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">{t('accountStatus')}</h2>
          <div className="flex gap-1 flex-wrap justify-end">
            {filters.map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  filter === val ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {sorted.map((account, i) => <AccountCard key={i} account={account} t={t} lang={lang} />)}
      </div>

      {/* 리스크 */}
      {risks.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-gray-900">{t('risks')}</h2>
          {risks.map((r, i) => (
            <div key={i} className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 items-start">
              <span className="text-red-500 text-sm shrink-0">⚠</span>
              <div>
                <p className="text-xs font-semibold text-red-700">{r.account}</p>
                <p className="text-xs text-red-600 mt-0.5">{pick(r, 'risk', lang)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

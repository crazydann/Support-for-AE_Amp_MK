import { useState, useEffect } from 'react'
import { useLang } from '../contexts/LanguageContext'
import AgentAuditModal from '../components/AgentAuditModal'

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

// ─── TODO VIEW ────────────────────────────────────────────────────────────────

function AccountCard({ account, t, lang }) {
  const healthConfig = getHealthConfig(t)
  const cfg = healthConfig[account.health] || healthConfig.gray
  const arrNum = account.arr ? parseInt(account.arr) : 0
  const nextAction = pick(account, 'next_action', lang)
  const history = account.activity_history || []
  const recentActivities = history.slice(0, 2)

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-3.5 space-y-2.5`}>
      {/* 헤더: 그룹·계정명 + D-day */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
            <span className="text-xs text-gray-400">{account.group}</span>
          </div>
          <p className="font-semibold text-gray-900 text-sm leading-tight mt-0.5">{account.key_account}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ContractBadge subscriptionEnd={account.subscription_end} status={account.status} t={t} />
          {arrNum > 0 && (
            <span className="text-xs text-gray-500 font-medium">
              ${arrNum >= 1000 ? (arrNum/1000).toFixed(0)+'K' : arrNum} ARR
            </span>
          )}
        </div>
      </div>

      {/* 최근 활동 이력 */}
      {recentActivities.length > 0 ? (
        <div className="space-y-1.5">
          {recentActivities.map((item, i) => {
            const acfg = activityTypeConfig[item.type] || activityTypeConfig.memo
            return (
              <div key={i} className="flex gap-2 items-start">
                <div className={`${acfg.bg} rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5`}>
                  {acfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-medium ${acfg.color}`}>
                      {lang === 'en' ? acfg.label_en : acfg.label}
                    </span>
                    <span className="text-xs text-gray-400">{item.date}</span>
                  </div>
                  <p className="text-xs text-gray-700 leading-snug truncate">
                    {lang === 'en' ? (item.summary_en || item.summary) : item.summary}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">
          {lang === 'en' ? 'No recent activity' : '최근 활동 없음'}
        </p>
      )}

      {/* 다음 액션 */}
      {nextAction && (
        <div className="pt-2 border-t border-gray-200">
          <div className="flex gap-1.5 items-start">
            <span className="text-xs text-blue-500 shrink-0 mt-0.5">→</span>
            <p className="text-xs text-gray-700 leading-snug">{nextAction}</p>
          </div>
        </div>
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

function TodoView({ report, t, lang }) {
  const accounts = report.accounts || []
  const actions  = report.action_items || []
  const risks    = report.risks || []

  const stats = {
    total_arr: accounts.filter(a => a.arr).reduce((s, a) => s + parseInt(a.arr || 0), 0),
    active:    accounts.filter(a => a.status === 'active').length,
    urgent:    accounts.filter(a => a.health === 'red').length,
    prospect:  accounts.filter(a => a.status === 'prospect').length,
  }

  // 최근 활동 피드: activity_history 있는 계정을 last_activity 내림차순
  const activityFeedAccounts = [...accounts]
    .filter(a => (a.activity_history || []).length > 0)
    .sort((a, b) => (b.last_activity || '').localeCompare(a.last_activity || ''))

  const priorityConfig = getPriorityConfig(t)

  return (
    <div className="space-y-5 pb-24">
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

      {/* 이번 주 요약 */}
      {(report.strategy_summary || report.strategy_summary_en) && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-purple-600 mb-1.5">{t('strategySummary')}</p>
          <p className="text-sm text-gray-700 leading-relaxed">{pick(report, 'strategy_summary', lang)}</p>
        </div>
      )}

      {/* 할 일 */}
      {actions.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            {t('actionItems')}
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{actions.length}</span>
          </h2>
          {actions.map((item, i) => {
            const cfg = priorityConfig[item.priority] || priorityConfig.medium
            const action = pick(item, 'action', lang)
            return (
              <div key={i} className={`rounded-xl border ${cfg.bg} p-3 flex gap-3 items-start`}>
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
          })}
        </div>
      )}

      {/* 최근 고객 동향 */}
      {activityFeedAccounts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-gray-900">
            {lang === 'en' ? 'Recent Activity' : '최근 고객 동향'}
          </h2>
          <div className="space-y-2">
            {activityFeedAccounts.map((account, i) => {
              const healthConfig = getHealthConfig(t)
              const cfg = healthConfig[account.health] || healthConfig.gray
              const nextAction = pick(account, 'next_action', lang)
              const recentItems = (account.activity_history || []).slice(0, 2)
              return (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
                  {/* 계정 헤더 */}
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                    <span className="text-xs text-gray-400">{account.group}</span>
                    <span className="text-sm font-semibold text-gray-900">{account.key_account}</span>
                    <span className="ml-auto text-xs text-gray-400">{account.last_activity}</span>
                  </div>
                  {/* 활동 이력 */}
                  <div className="space-y-1.5 pl-4">
                    {recentItems.map((item, j) => {
                      const acfg = activityTypeConfig[item.type] || activityTypeConfig.memo
                      return (
                        <div key={j} className="flex gap-2 items-start">
                          <span className={`text-xs shrink-0 mt-0.5 ${acfg.color}`}>{acfg.icon}</span>
                          <p className="text-xs text-gray-600 leading-snug">
                            <span className="text-gray-400 mr-1">{item.date}</span>
                            {lang === 'en' ? (item.summary_en || item.summary) : item.summary}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                  {/* 다음 액션 */}
                  {nextAction && (
                    <div className="pl-4 pt-1 border-t border-gray-100">
                      <p className="text-xs text-blue-600">
                        <span className="mr-1">→</span>{nextAction}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

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

// ─── ACCOUNT VIEW ─────────────────────────────────────────────────────────────

// 타입별 아이콘/색상
const activityTypeConfig = {
  email:   { icon: '✉', color: 'text-blue-500',  bg: 'bg-blue-50',   label: '이메일', label_en: 'Email' },
  meeting: { icon: '📅', color: 'text-purple-500', bg: 'bg-purple-50', label: '미팅',   label_en: 'Meeting' },
  slack:   { icon: '💬', color: 'text-green-500', bg: 'bg-green-50',  label: '슬랙',   label_en: 'Slack' },
  memo:    { icon: '📝', color: 'text-orange-500', bg: 'bg-orange-50', label: '메모',   label_en: 'Memo' },
}

function ActivityFeed({ history, lang }) {
  if (!history || history.length === 0) return (
    <p className="text-xs text-gray-400 text-center py-2">
      {lang === 'en' ? 'No activity recorded yet' : '기록된 활동이 없습니다'}
    </p>
  )
  return (
    <div className="space-y-2">
      {history.map((item, i) => {
        const cfg = activityTypeConfig[item.type] || activityTypeConfig.memo
        return (
          <div key={i} className="flex gap-2 items-start">
            <div className={`${cfg.bg} rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0 mt-0.5`}>
              {cfg.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-xs font-medium ${cfg.color}`}>
                  {lang === 'en' ? cfg.label_en : cfg.label}
                </span>
                <span className="text-xs text-gray-400">{item.date}</span>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed">
                {lang === 'en' ? (item.summary_en || item.summary) : item.summary}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SubAccountRow({ account, expanded, onToggle, t, lang, relatedActions, relatedRisks, accountNotes = [], onAudit }) {
  const healthConfig = getHealthConfig(t)
  const priorityConfig = getPriorityConfig(t)
  const cfg = healthConfig[account.health] || healthConfig.gray
  const arrNum = account.arr ? parseInt(account.arr) : 0
  const dealStage = pick(account, 'deal_stage', lang)
  const nextAction = pick(account, 'next_action', lang)

  // notes.json 메모를 activity_history 형식으로 변환해 합치기
  const noteActivities = accountNotes.map(n => ({
    date: n.date || n.created_at?.slice(0, 10) || '',
    type: 'memo',
    summary: n.content,
    summary_en: n.content,
  }))
  const mergedHistory = [...(account.activity_history || []), ...noteActivities]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  return (
    <div className={`rounded-xl border ${expanded ? cfg.border : 'border-gray-200'} overflow-hidden ml-3`}>
      {/* 계열사 헤더 */}
      <button
        onClick={onToggle}
        className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors ${
          expanded ? cfg.bg : 'bg-white hover:bg-gray-50'
        }`}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
        <span className="flex-1 text-sm font-semibold text-gray-900 truncate">{account.key_account}</span>
        {/* Agent Audit 버튼 */}
        <button
          onClick={e => { e.stopPropagation(); onAudit && onAudit(account) }}
          title="Agent Analytics Audit"
          className="p-1 rounded-md text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </button>
        {arrNum > 0 && (
          <span className="text-xs font-bold text-gray-700 shrink-0">
            ${arrNum >= 1000 ? (arrNum/1000).toFixed(0)+'K' : arrNum}
          </span>
        )}
        <ContractBadge subscriptionEnd={account.subscription_end} status={account.status} t={t} />
        <svg className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 확장 내용 */}
      {expanded && (
        <div className={`${cfg.bg} border-t ${cfg.border} px-3 py-3 space-y-3`}>
          {/* 기본 정보 1행 */}
          <div className="grid grid-cols-4 gap-1 text-center">
            {account.amplitude_plan && (
              <div className="bg-white rounded-lg p-1.5">
                <p className="text-xs text-gray-400 mb-0.5">Plan</p>
                <p className="text-xs font-semibold text-purple-700 truncate">{account.amplitude_plan}</p>
              </div>
            )}
            {account.subscription_end && account.status !== 'churned' && (
              <div className="bg-white rounded-lg p-1.5">
                <p className="text-xs text-gray-400 mb-0.5">{lang === 'en' ? 'Expires' : '만료일'}</p>
                <p className="text-xs font-semibold text-gray-800">{account.subscription_end?.slice(0,7)}</p>
              </div>
            )}
            <div className="bg-white rounded-lg p-1.5">
              <p className="text-xs text-gray-400 mb-0.5">Status</p>
              <span className={`text-xs font-semibold ${cfg.badge} px-1 py-0.5 rounded-full`}>{cfg.label}</span>
            </div>
            {arrNum > 0 && (
              <div className="bg-white rounded-lg p-1.5">
                <p className="text-xs text-gray-400 mb-0.5">ARR</p>
                <p className="text-xs font-semibold text-gray-800">${arrNum >= 1000 ? (arrNum/1000).toFixed(0)+'K' : arrNum}</p>
              </div>
            )}
          </div>

          {/* 현황 요약 */}
          {(account.notes_summary || account.notes_summary_en) && (
            <div className="bg-white rounded-lg p-2.5">
              <p className="text-xs text-gray-400 mb-1">{lang === 'en' ? 'Summary' : '현황 요약'}</p>
              <p className="text-xs text-gray-700 leading-relaxed">{pick(account, 'notes_summary', lang)}</p>
            </div>
          )}

          {/* 활동 이력 (메인) - activity_history + 메모 합산 */}
          <div className="bg-white rounded-lg p-2.5">
            <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
              {lang === 'en' ? 'Activity History' : '활동 이력'}
              {noteActivities.length > 0 && (
                <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-normal">
                  +{noteActivities.length} {lang === 'en' ? 'memo' : '메모'}
                </span>
              )}
            </p>
            <ActivityFeed history={mergedHistory} lang={lang} />
          </div>

          {/* 전략 */}
          {(account.strategy || account.strategy_en) && (
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-2.5">
              <p className="text-xs font-semibold text-purple-600 mb-1">{lang === 'en' ? 'Strategy' : '전략'}</p>
              <p className="text-xs text-gray-700 leading-relaxed">{pick(account, 'strategy', lang)}</p>
            </div>
          )}

          {/* 딜 단계 */}
          {dealStage && (
            <div className="bg-white rounded-lg p-2.5">
              <p className="text-xs text-gray-400 mb-1">{lang === 'en' ? 'Deal Stage' : '딜 단계'}</p>
              <p className="text-xs font-medium text-gray-800">{dealStage}</p>
            </div>
          )}

          {/* 다음 액션 */}
          {nextAction && (
            <div className="bg-white rounded-lg p-2.5">
              <p className="text-xs text-gray-400 mb-1">{lang === 'en' ? 'Next Action' : '다음 액션'}</p>
              <p className="text-xs text-gray-800 leading-relaxed">{nextAction}</p>
            </div>
          )}

          {/* 연관 Action Items */}
          {relatedActions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500">{lang === 'en' ? 'Action Items' : '할 일'}</p>
              {relatedActions.map((item, i) => {
                const pcfg = priorityConfig[item.priority] || priorityConfig.medium
                return (
                  <div key={i} className={`rounded-lg border ${pcfg.bg} px-3 py-2 flex gap-2 items-start`}>
                    <span className={`text-xs font-bold ${pcfg.color} shrink-0 mt-0.5`}>{pcfg.label}</span>
                    <div>
                      <p className="text-xs text-gray-800 leading-snug">{pick(item, 'action', lang)}</p>
                      {item.due && <p className="text-xs text-gray-400 mt-0.5">{item.due}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 연관 Risks */}
          {relatedRisks.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500">{t('risks')}</p>
              {relatedRisks.map((r, i) => (
                <div key={i} className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex gap-2 items-start">
                  <span className="text-red-400 text-xs shrink-0">⚠</span>
                  <p className="text-xs text-red-700 leading-snug">{pick(r, 'risk', lang)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AccountView({ report, t, lang }) {
  const [expandedGroup, setExpandedGroup] = useState(null)
  const [expandedAccount, setExpandedAccount] = useState(null)
  const [notes, setNotes] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)
  const [auditAccount, setAuditAccount] = useState(null)

  useEffect(() => {
    fetch(`${API}/api/intel/notes`)
      .then(r => r.json())
      .then(d => setNotes(d.notes || []))
      .catch(() => {})
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch(`${API}/api/intel/sync?force=true`, { method: 'POST' })
      const data = await res.json()
      setSyncMsg(lang === 'en' ? `Sync done (${data.added || 0} added)` : `동기화 완료 (${data.added || 0}건 추가)`)
      setTimeout(() => setSyncMsg(null), 4000)
    } catch {
      setSyncMsg(lang === 'en' ? 'Sync failed' : '동기화 실패')
      setTimeout(() => setSyncMsg(null), 3000)
    } finally {
      setSyncing(false)
    }
  }

  const handleGleanSync = async () => {
    // Glean MCP는 Claude Code에서만 가능 → 안내 메시지
    setSyncMsg(lang === 'en'
      ? 'Glean sync: ask Claude "글린 동기화 해줘"'
      : 'Glean 동기화: Claude에게 "글린 동기화 해줘"라고 요청하세요')
    setTimeout(() => setSyncMsg(null), 5000)
  }

  const accounts = report.accounts || []
  const actionItems = report.action_items || []
  const risks = report.risks || []

  // 그룹별로 묶기
  const groupMap = {}
  accounts.forEach(acc => {
    const g = acc.group || 'etc'
    if (!groupMap[g]) groupMap[g] = []
    groupMap[g].push(acc)
  })

  // 계열사 정렬: last_activity 내림차순, 동일 시 ARR 내림차순
  Object.keys(groupMap).forEach(g => {
    groupMap[g].sort((a, b) => {
      const da = a.last_activity || '1900-01-01'
      const db = b.last_activity || '1900-01-01'
      if (db !== da) return db.localeCompare(da)
      return parseInt(b.arr || 0) - parseInt(a.arr || 0)
    })
  })

  // 그룹 정렬: 그룹 내 가장 최근 last_activity 기준
  const groups = Object.keys(groupMap).sort((a, b) => {
    const latestA = groupMap[a][0]?.last_activity || '1900-01-01'
    const latestB = groupMap[b][0]?.last_activity || '1900-01-01'
    return latestB.localeCompare(latestA)
  })

  const totalArr = accounts.reduce((s, a) => s + parseInt(a.arr || 0), 0)

  return (
    <>
    {/* Agent Audit 모달 */}
    {auditAccount && (
      <AgentAuditModal
        account={auditAccount}
        relatedActions={actionItems.filter(a => a.account === auditAccount.key_account)}
        relatedRisks={risks.filter(r => r.account === auditAccount.key_account)}
        onClose={() => setAuditAccount(null)}
      />
    )}
    <div className="space-y-3 pb-24">
      {/* 총 ARR + 동기화 버튼 */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2">
        <span className="text-xs text-purple-600 font-medium">
          {lang === 'en' ? 'Total Managed ARR' : '관리 총 ARR'}
          <span className="text-gray-400 font-normal ml-1">
            ({accounts.filter(a => a.arr).length} {lang === 'en' ? 'accounts' : '개'})
          </span>
        </span>
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-purple-700">${Math.round(totalArr / 1000)}K</span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1 text-xs bg-white border border-purple-200 text-purple-600 px-2 py-1 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
          >
            <svg className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? (lang === 'en' ? 'Syncing…' : '동기화 중…') : (lang === 'en' ? 'Sync' : '동기화')}
          </button>
          <button
            onClick={handleGleanSync}
            className="flex items-center gap-1 text-xs bg-white border border-violet-300 text-violet-600 px-2 py-1 rounded-lg hover:bg-violet-100 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            Glean
          </button>
        </div>
      </div>
      {syncMsg && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700 text-center">
          {syncMsg}
        </div>
      )}

      {/* 그룹 목록 */}
      {groups.map(groupName => {
        const groupAccounts = groupMap[groupName]
        const groupArr = groupAccounts.reduce((s, a) => s + parseInt(a.arr || 0), 0)
        const isGroupExpanded = expandedGroup === groupName
        // 그룹 헬스: 가장 나쁜 계열사 기준
        const healthOrder = { red: 0, orange: 1, yellow: 2, green: 3, gray: 4 }
        const worstHealth = groupAccounts.reduce((worst, a) => {
          return (healthOrder[a.health] ?? 5) < (healthOrder[worst] ?? 5) ? a.health : worst
        }, 'gray')
        const healthConfig = getHealthConfig(t)
        const gcfg = healthConfig[worstHealth] || healthConfig.gray

        return (
          <div key={groupName} className={`rounded-xl border ${isGroupExpanded ? gcfg.border : 'border-gray-200'} overflow-hidden`}>
            {/* 그룹 헤더 */}
            <button
              onClick={() => { setExpandedGroup(isGroupExpanded ? null : groupName); setExpandedAccount(null) }}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                isGroupExpanded ? gcfg.bg : 'bg-white hover:bg-gray-50'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${gcfg.dot}`} />
              <span className="flex-1 text-sm font-bold text-gray-900">{groupName}</span>
              <span className="text-xs text-gray-400 shrink-0">{groupAccounts.length}개</span>
              {groupArr > 0 && (
                <span className="text-sm font-bold text-gray-800 shrink-0">
                  ${Math.round(groupArr / 1000)}K
                </span>
              )}
              <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${isGroupExpanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* 계열사 목록 */}
            {isGroupExpanded && (
              <div className={`${gcfg.bg} border-t ${gcfg.border} p-2 space-y-2`}>
                {groupAccounts.map((account, i) => {
                  const key = `${groupName}-${i}`
                  return (
                    <SubAccountRow
                      key={key}
                      account={account}
                      expanded={expandedAccount === key}
                      onToggle={() => setExpandedAccount(expandedAccount === key ? null : key)}
                      t={t}
                      lang={lang}
                      relatedActions={actionItems.filter(a => a.account === account.key_account)}
                      relatedRisks={risks.filter(r => r.account === account.key_account)}
                      accountNotes={notes.filter(n => n.account === account.key_account)}
                      onAudit={setAuditAccount}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
    </>
  )
}

// ─── WEEKLY VIEW ──────────────────────────────────────────────────────────────

// 타입별 피드 설정 (weekly용 — SFDC 제외)
const feedTypeConfig = {
  gmail:   { icon: '✉',  color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-100',   label: '이메일',    label_en: 'Email' },
  slack:   { icon: '💬', color: 'text-green-600',  bg: 'bg-green-50',   border: 'border-green-100',  label: '슬랙',      label_en: 'Slack' },
  meeting: { icon: '📅', color: 'text-purple-600', bg: 'bg-purple-50',  border: 'border-purple-100', label: '미팅',      label_en: 'Meeting' },
  glean:   { icon: '🔍', color: 'text-indigo-600', bg: 'bg-indigo-50',  border: 'border-indigo-100', label: 'Glean/Drive', label_en: 'Glean/Drive' },
  drive:   { icon: '📄', color: 'text-indigo-600', bg: 'bg-indigo-50',  border: 'border-indigo-100', label: 'Drive',     label_en: 'Drive' },
  memo:    { icon: '📝', color: 'text-orange-600', bg: 'bg-orange-50',  border: 'border-orange-100', label: '메모',      label_en: 'Memo' },
  insight: { icon: '💡', color: 'text-yellow-600', bg: 'bg-yellow-50',  border: 'border-yellow-100', label: '인사이트',  label_en: 'Insight' },
}

function WeeklyView({ t, lang }) {
  const [feed, setFeed] = useState(null)
  const [loadingFeed, setLoadingFeed] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)
  const [activeTab, setActiveTab] = useState('all') // all | gmail | slack | meeting | glean | memo
  const priorityConfig = getPriorityConfig(t)

  // weekly-feed 로드
  useEffect(() => {
    fetch(`${API}/api/intel/weekly-feed?days=14`)
      .then(r => r.json())
      .then(d => { setFeed(d); setLoadingFeed(false) })
      .catch(() => setLoadingFeed(false))
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch(`${API}/api/intel/sync?force=true`, { method: 'POST' })
      const data = await res.json()
      setSyncMsg(lang === 'en'
        ? `Sync done (${data.added || 0} added)`
        : `동기화 완료 (${data.added || 0}건 추가)`)
      // 피드 재로드
      const r2 = await fetch(`${API}/api/intel/weekly-feed?days=14`)
      const d2 = await r2.json()
      setFeed(d2)
      setTimeout(() => setSyncMsg(null), 4000)
    } catch {
      setSyncMsg(lang === 'en' ? 'Sync failed' : '동기화 실패')
      setTimeout(() => setSyncMsg(null), 3000)
    } finally {
      setSyncing(false)
    }
  }

  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1))

  const allEntries = feed?.entries || []
  const byDate = feed?.by_date || {}
  const byType = feed?.by_type || {}
  const actionItems = feed?.action_items || []

  // 탭 필터
  const filteredEntries = activeTab === 'all'
    ? allEntries
    : allEntries.filter(e => (e.type || e.log_type) === activeTab)

  // 날짜별 그룹핑 (필터 적용 후)
  const filteredByDate = {}
  filteredEntries.forEach(e => {
    const d = e.date || (e.ts || '').slice(0, 10) || 'unknown'
    if (!filteredByDate[d]) filteredByDate[d] = []
    filteredByDate[d].push(e)
  })
  const sortedDates = Object.keys(filteredByDate).sort((a, b) => b.localeCompare(a))

  // 탭 목록 (데이터 있는 타입만)
  const tabs = [
    { id: 'all', label: lang === 'en' ? 'All' : '전체', count: allEntries.length },
    ...[
      { id: 'gmail',   label: lang === 'en' ? 'Email' : '이메일', icon: '✉' },
      { id: 'slack',   label: 'Slack', icon: '💬' },
      { id: 'meeting', label: lang === 'en' ? 'Meeting' : '미팅', icon: '📅' },
      { id: 'glean',   label: 'Glean', icon: '🔍' },
      { id: 'memo',    label: lang === 'en' ? 'Memo' : '메모', icon: '📝' },
    ].filter(tab => byType[tab.id] > 0).map(tab => ({
      ...tab,
      count: byType[tab.id] || 0
    }))
  ]

  const sortedActions = [...actionItems].sort((a, b) => {
    const order = { urgent: 0, high: 1, medium: 2 }
    return (order[a.priority] ?? 3) - (order[b.priority] ?? 3)
  })

  return (
    <div className="space-y-4 pb-24">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-4 text-white">
        <p className="text-xs font-medium opacity-80 mb-1">
          {lang === 'en' ? 'Weekly Activity Feed' : '주간 활동 피드'} · {today.toLocaleDateString(lang === 'en' ? 'en-US' : 'ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <h2 className="text-base font-bold leading-snug">
          {lang === 'en' ? 'AE MK — Last 2 Weeks' : 'AE MK 최근 2주 활동'}
        </h2>
        <div className="flex gap-4 mt-3 pt-3 border-t border-white/20 flex-wrap">
          {byType.gmail > 0 && (
            <div className="text-center">
              <p className="text-lg font-bold">{byType.gmail}</p>
              <p className="text-xs opacity-70">{lang === 'en' ? 'Emails' : '이메일'}</p>
            </div>
          )}
          {byType.slack > 0 && (
            <div className="text-center">
              <p className="text-lg font-bold">{byType.slack}</p>
              <p className="text-xs opacity-70">Slack</p>
            </div>
          )}
          {byType.meeting > 0 && (
            <div className="text-center">
              <p className="text-lg font-bold">{byType.meeting}</p>
              <p className="text-xs opacity-70">{lang === 'en' ? 'Meetings' : '미팅'}</p>
            </div>
          )}
          {byType.glean > 0 && (
            <div className="text-center">
              <p className="text-lg font-bold">{byType.glean}</p>
              <p className="text-xs opacity-70">Glean</p>
            </div>
          )}
          {byType.memo > 0 && (
            <div className="text-center">
              <p className="text-lg font-bold">{byType.memo}</p>
              <p className="text-xs opacity-70">{lang === 'en' ? 'Memos' : '메모'}</p>
            </div>
          )}
          {allEntries.length === 0 && (
            <div className="text-center">
              <p className="text-lg font-bold opacity-60">0</p>
              <p className="text-xs opacity-50">{lang === 'en' ? 'No activity' : '활동 없음'}</p>
            </div>
          )}
        </div>
      </div>

      {/* 동기화 버튼 */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSync}
          disabled={syncing}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
            syncing
              ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
          }`}
        >
          <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncing
            ? (lang === 'en' ? 'Syncing…' : '동기화 중…')
            : (lang === 'en' ? 'Sync Gmail / Calendar / Slack' : 'Gmail · 캘린더 · Slack 동기화')}
        </button>
      </div>
      {syncMsg && (
        <div className={`text-xs font-medium px-3 py-2 rounded-xl text-center ${
          syncMsg.includes('실패') || syncMsg.includes('failed')
            ? 'bg-red-50 text-red-600 border border-red-200'
            : 'bg-green-50 text-green-600 border border-green-200'
        }`}>
          {syncMsg}
        </div>
      )}

      {/* 타입 탭 필터 */}
      {tabs.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {tab.icon && <span>{tab.icon}</span>}
              {tab.label}
              <span className={`text-xs px-1 rounded-full ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 활동 피드 */}
      {loadingFeed ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-400">{lang === 'en' ? 'Loading…' : '불러오는 중…'}</p>
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 border-dashed rounded-xl p-6 text-center space-y-2">
          <p className="text-sm font-medium text-gray-500">
            {lang === 'en' ? 'No activity in the past 2 weeks' : '최근 2주 활동 없음'}
          </p>
          <p className="text-xs text-gray-400">
            {lang === 'en'
              ? 'Press "Sync" to fetch emails, calendar, and Slack data'
              : '"동기화" 버튼을 눌러 이메일, 캘린더, 슬랙 데이터를 가져오세요'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedDates.map(date => (
            <div key={date} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* 날짜 헤더 */}
              <div className="bg-gray-50 border-b border-gray-100 px-3 py-2 flex items-center gap-2">
                <span className="text-xs font-bold text-gray-600">
                  {new Date(date + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'ko-KR', {
                    month: 'long', day: 'numeric', weekday: 'short'
                  })}
                </span>
                <span className="ml-auto text-xs text-gray-400">{filteredByDate[date].length}{lang === 'en' ? ' items' : '건'}</span>
              </div>
              {/* 항목들 */}
              <div className="divide-y divide-gray-50">
                {filteredByDate[date].map((item, i) => {
                  const itemType = item.type || item.log_type || 'memo'
                  const cfg = feedTypeConfig[itemType] || feedTypeConfig.memo
                  const summary = item.summary || item.title || ''
                  return (
                    <div key={i} className="px-3 py-2.5 flex gap-2.5 items-start">
                      <div className={`${cfg.bg} rounded-full w-7 h-7 flex items-center justify-center text-sm shrink-0 mt-0.5`}>
                        {cfg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className={`text-xs font-semibold ${cfg.color}`}>
                            {lang === 'en' ? cfg.label_en : cfg.label}
                          </span>
                          {item.account && (
                            <>
                              <span className="text-xs text-gray-300">·</span>
                              <span className="text-xs font-medium text-gray-600">{item.account}</span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed">
                          {summary}
                        </p>
                        {item.url && (
                          <a href={item.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-600 mt-0.5 inline-block truncate max-w-full">
                            {item.url.slice(0, 60)}{item.url.length > 60 ? '…' : ''}
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 이번 주 할 일 ── */}
      {sortedActions.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            ✅ {lang === 'en' ? 'Action Items' : '이번 주 할 일'}
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-normal">{sortedActions.length}</span>
          </h2>
          <div className="space-y-2">
            {sortedActions.map((item, i) => {
              const cfg = priorityConfig[item.priority] || priorityConfig.medium
              const action = pick(item, 'action', lang)
              const days = item.due ? daysUntil(item.due) : null
              return (
                <div key={i} className={`rounded-xl border ${cfg.bg} p-3`}>
                  <div className="flex gap-2.5 items-start">
                    <span className={`text-xs font-bold ${cfg.color} shrink-0 mt-0.5`}>{cfg.label}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 leading-snug">{action}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-gray-400">{item.account}</span>
                        {item.due && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                            days !== null && days <= 3 ? 'bg-red-100 text-red-600'
                            : days !== null && days <= 7 ? 'bg-orange-100 text-orange-600'
                            : 'bg-gray-100 text-gray-500'
                          }`}>
                            {item.due}{days !== null ? ` (D-${days})` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────

export default function DashboardPage({ dashView = 'todo' }) {
  const { t, lang } = useLang()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)

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

  return (
    <div>
      {/* 리포트 생성 시간 */}
      {report.generated_at ? (
        <p className="text-xs text-gray-400 text-center mb-4">
          {t('lastUpdated')}: {new Date(report.generated_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' })} KST
        </p>
      ) : (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-700 mb-4">
          <p className="font-medium">{t('noReport')}</p>
          <p className="text-xs mt-1 text-purple-500">{t('noReportSub')}</p>
        </div>
      )}

      {dashView === 'todo'
        ? <TodoView report={report} t={t} lang={lang} />
        : dashView === 'weekly'
        ? <WeeklyView t={t} lang={lang} />
        : <AccountView report={report} t={t} lang={lang} />
      }
    </div>
  )
}

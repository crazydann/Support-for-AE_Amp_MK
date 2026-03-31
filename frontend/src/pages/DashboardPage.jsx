import { useState, useEffect, useRef } from 'react'
import { useLang } from '../contexts/LanguageContext'
import AgentAuditModal from '../components/AgentAuditModal'
import { useTranslations } from '../hooks/useTranslations'

function pick(obj, key, lang) {
  return (lang === 'en' && obj[`${key}_en`]) ? obj[`${key}_en`] : obj[key]
}

/** pick() + 자동 번역 합성: _en 필드 없으면 tr()로 번역 */
function makePT(lang, tr) {
  return (obj, key) => {
    if (!obj) return ''
    if (lang === 'en' && obj[`${key}_en`]) return obj[`${key}_en`]
    const val = obj[key] || ''
    return lang === 'en' ? (tr(val) || val) : val
  }
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
  const { tr } = useTranslations(lang)
  const pt = makePT(lang, tr)
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
          <p className="text-sm text-gray-700 leading-relaxed">{pt(report, 'strategy_summary')}</p>
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
            const action = pt(item, 'action')
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
              const nextAction = pt(account, 'next_action')
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
                            {lang === 'en' ? (item.summary_en || tr(item.summary)) : item.summary}
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
                <p className="text-xs text-red-600 mt-0.5">{pt(r, 'risk')}</p>
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
  const { tr } = useTranslations(lang)
  if (!history || history.length === 0) return (
    <p className="text-xs text-gray-400 text-center py-2">
      {lang === 'en' ? 'No activity recorded yet' : '기록된 활동이 없습니다'}
    </p>
  )
  return (
    <div className="space-y-2">
      {history.map((item, i) => {
        const cfg = activityTypeConfig[item.type] || activityTypeConfig.memo
        const rawSummary = lang === 'en' ? (item.summary_en || item.summary) : item.summary
        const displaySummary = lang === 'en' && !item.summary_en ? tr(item.summary) : rawSummary
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
              <p className="text-xs text-gray-700 leading-relaxed">{displaySummary}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SubAccountRow({ account, expanded, onToggle, t, lang, tr: trProp, relatedActions, relatedRisks, accountNotes = [], onAudit }) {
  const { tr: trHook } = useTranslations(lang)
  const tr = trProp || trHook
  const pt = makePT(lang, tr)
  const healthConfig = getHealthConfig(t)
  const priorityConfig = getPriorityConfig(t)
  const cfg = healthConfig[account.health] || healthConfig.gray
  const arrNum = account.arr ? parseInt(account.arr) : 0
  const dealStage = pt(account, 'deal_stage')
  const nextAction = pt(account, 'next_action')

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
              <p className="text-xs text-gray-700 leading-relaxed">{pt(account, 'notes_summary')}</p>
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
              <p className="text-xs text-gray-700 leading-relaxed">{pt(account, 'strategy')}</p>
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
                      <p className="text-xs text-gray-800 leading-snug">{pt(item, 'action')}</p>
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
                  <p className="text-xs text-red-700 leading-snug">{pt(r, 'risk')}</p>
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
  const { tr } = useTranslations(lang)
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
                      tr={tr}
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

const feedTypeConfig = {
  gmail:   { icon: '✉',  color: 'text-blue-600',   bg: 'bg-blue-50',   pill: 'bg-blue-100 text-blue-700',    label: '이메일', label_en: 'Email' },
  slack:   { icon: '💬', color: 'text-green-600',  bg: 'bg-green-50',  pill: 'bg-green-100 text-green-700',  label: '슬랙',   label_en: 'Slack' },
  meeting: { icon: '📅', color: 'text-purple-600', bg: 'bg-purple-50', pill: 'bg-purple-100 text-purple-700',label: '미팅',   label_en: 'Meeting' },
  glean:   { icon: '🔍', color: 'text-indigo-600', bg: 'bg-indigo-50', pill: 'bg-indigo-100 text-indigo-700',label: 'Glean',  label_en: 'Glean' },
  drive:   { icon: '📄', color: 'text-indigo-600', bg: 'bg-indigo-50', pill: 'bg-indigo-100 text-indigo-700',label: 'Drive',  label_en: 'Drive' },
  memo:    { icon: '📝', color: 'text-orange-600', bg: 'bg-orange-50', pill: 'bg-orange-100 text-orange-700',label: '메모',   label_en: 'Memo' },
  insight: { icon: '💡', color: 'text-yellow-600', bg: 'bg-yellow-50', pill: 'bg-yellow-100 text-yellow-700',label: '인사이트', label_en: 'Insight' },
}

// 요약 텍스트에서 [접두사] 정리
function cleanSummary(s = '') {
  return s.replace(/^\[(Gmail|Slack|SFDC|글린|Glean)[^\]]*\]\s*/i, '').trim()
}

// 액션 아이템 고유 ID (account + action 해시)
function makeActionId(item) {
  const str = `${item.account || ''}|${item.action || ''}`
  let h = 0
  for (let i = 0; i < str.length; i++) { h = Math.imul(31, h) + str.charCodeAt(i) | 0 }
  return Math.abs(h).toString(36)
}

// 채널 타입 설정 (Weekly 전용)
const WEEKLY_CHANNELS = [
  { type: 'meeting', icon: '📅', label: '일정',  label_en: 'Schedule', color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200', pill: 'bg-purple-100 text-purple-700' },
  { type: 'gmail',   icon: '✉',  label: '이메일', label_en: 'Email',    color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   pill: 'bg-blue-100 text-blue-700' },
  { type: 'slack',   icon: '💬', label: '슬랙',   label_en: 'Slack',    color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  pill: 'bg-green-100 text-green-700' },
  { type: 'glean',   icon: '🔍', label: 'Glean',  label_en: 'Glean',    color: 'text-indigo-700', bg: 'bg-indigo-50',  border: 'border-indigo-200', pill: 'bg-indigo-100 text-indigo-700' },
  { type: 'memo',    icon: '📝', label: '메모',   label_en: 'Memo',     color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200', pill: 'bg-orange-100 text-orange-700' },
]

function WeeklyView({ t, lang }) {
  const [feed, setFeed] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)
  const [statuses, setStatuses] = useState({})
  const [openNotes, setOpenNotes] = useState({})
  const [showDone, setShowDone] = useState(false)
  const timers = useRef({})
  const { tr } = useTranslations(lang)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/intel/weekly-feed?days=365`).then(r => r.json()),
      fetch(`${API}/api/intel/action-status`).then(r => r.json()).catch(() => ({ statuses: {} })),
    ]).then(([feedData, statusData]) => {
      setFeed(feedData)
      setStatuses(statusData.statuses || {})
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleSync = async () => {
    setSyncing(true); setSyncMsg(null)
    try {
      await fetch(`${API}/api/intel/sync?force=true`, { method: 'POST' })
      const [feedData] = await Promise.all([fetch(`${API}/api/intel/weekly-feed?days=365`).then(r => r.json())])
      setFeed(feedData)
      setSyncMsg(lang === 'en' ? 'Sync done' : '동기화 완료')
      setTimeout(() => setSyncMsg(null), 3000)
    } catch { setSyncMsg('동기화 실패') } finally { setSyncing(false) }
  }

  const toggleDone = (id, wasDone) => {
    const cur = statuses[id] || {}
    const next = { ...statuses, [id]: { ...cur, done: !wasDone } }
    setStatuses(next)
    fetch(`${API}/api/intel/action-status`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_id: id, done: !wasDone, note: cur.note || '' }) }).catch(() => {})
  }

  const saveNote = (id, note) => {
    setStatuses(p => ({ ...p, [id]: { ...(p[id] || {}), note } }))
    clearTimeout(timers.current[id])
    timers.current[id] = setTimeout(() => {
      const cur = statuses[id] || {}
      fetch(`${API}/api/intel/action-status`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: id, done: cur.done || false, note }) }).catch(() => {})
    }, 1500)
  }

  const today = new Date()

  // ── 날짜 계산 ──
  const dow = today.getDay() || 7
  const thisMon = new Date(today); thisMon.setDate(today.getDate() - dow + 1)
  const lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7)
  const sixAgo  = new Date(today); sixAgo.setMonth(today.getMonth() - 6)
  const thisMonStr = thisMon.toISOString().slice(0, 10)
  const lastMonStr = lastMon.toISOString().slice(0, 10)
  const sixAgoStr  = sixAgo.toISOString().slice(0, 10)

  const fmtRange = mon => {
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    const f = d => d.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' })
    return `${f(mon)} – ${f(sun)}`
  }

  // ── 피드 데이터 ──
  const allEntries  = feed?.entries || []
  const actionItems = feed?.action_items || []

  // dedup
  const seen = new Set()
  const entries = allEntries.filter(e => {
    const k = `${e.account || ''}|${(e.summary || '').slice(0, 50)}`
    if (seen.has(k)) return false; seen.add(k); return true
  })

  const thisWeek = entries.filter(e => (e.date || '') >= thisMonStr)
  const lastWeek = entries.filter(e => { const d = e.date || ''; return d >= lastMonStr && d < thisMonStr })
  const earlier  = entries.filter(e => (e.date || '') >= sixAgoStr && (e.date || '') < lastMonStr)
  const archived = entries.filter(e => (e.date || '') < sixAgoStr)

  // ── 할일 분류 ──
  const priOrder = { urgent: 0, high: 1, medium: 2 }
  const sortedActions = [...actionItems].sort((a, b) => (priOrder[a.priority] ?? 9) - (priOrder[b.priority] ?? 9))
  const pendingTasks = sortedActions.filter(a => !statuses[makeActionId(a)]?.done)
  const doneTasks    = sortedActions.filter(a =>  statuses[makeActionId(a)]?.done)

  const priCfg = { urgent: { label: '긴급', label_en: 'Urgent', cls: 'bg-red-50 text-red-600 border border-red-200' },
                   high:   { label: '높음', label_en: 'High',   cls: 'bg-orange-50 text-orange-600 border border-orange-200' },
                   medium: { label: '보통', label_en: 'Normal', cls: 'bg-blue-50 text-blue-600 border border-blue-200' } }

  // ── 이번 주 핵심 (urgent/high만) ──
  const highlights = sortedActions.filter(a => a.priority === 'urgent' || a.priority === 'high').slice(0, 5)

  // ── 리스크 ──
  const risks = (feed?.risks || []).slice(0, 4)

  // ── 미팅 ──
  const weekMeetings = thisWeek.filter(e => (e.type || e.log_type) === 'meeting')
  const meetingAccounts = [...new Set(weekMeetings.map(e => e.account).filter(Boolean))]

  // ── 영업 인사이트 (urgent 상위 3개) ──
  const insights = sortedActions.slice(0, 3)

  // ── 신규 파이프라인 (high priority 계정 중 리스크 아닌 것) ──
  const riskAccounts = new Set(risks.map(r => r.account))
  const pipelineMap = new Map()
  sortedActions.filter(a => a.account && !riskAccounts.has(a.account)).forEach(a => {
    if (!pipelineMap.has(a.account)) pipelineMap.set(a.account, a)
  })
  const pipeline = [...pipelineMap.values()].slice(0, 5)

  const TYPE_PRI = { memo: 0, meeting: 1, gmail: 2, slack: 3, glean: 4 }
  const sortEntries = arr => [...arr].sort((a, b) => {
    const pa = TYPE_PRI[a.type || a.log_type] ?? 5, pb = TYPE_PRI[b.type || b.log_type] ?? 5
    if (pa !== pb) return pa - pb
    return (b.date || '').localeCompare(a.date || '')
  })

  function EntryRow({ item }) {
    const tp = item.type || item.log_type || 'memo'
    const ch = WEEKLY_CHANNELS.find(c => c.type === tp) || WEEKLY_CHANNELS[4]
    return (
      <div className="flex gap-2.5 items-start py-2.5 border-b border-gray-50 last:border-0">
        <span className="text-sm shrink-0 mt-0.5">{ch.icon}</span>
        <span className="text-xs text-gray-400 shrink-0 w-9 mt-0.5">{(item.date || '').slice(5)}</span>
        <div className="flex-1 min-w-0">
          {item.account && <span className={`inline-block text-xs font-semibold px-1.5 py-0.5 rounded mr-1.5 mb-0.5 ${ch.pill}`}>{item.account}</span>}
          <span className="text-xs text-gray-700 leading-relaxed">{cleanSummary(item.summary || item.title || '')}</span>
        </div>
      </div>
    )
  }

  function FeedSection({ items, title, range, open: defOpen = true }) {
    const [op, setOp] = useState(defOpen)
    const [all, setAll] = useState(false)
    if (!items.length) return null
    const sorted = sortEntries(items)
    const visible = all ? sorted : sorted.slice(0, 15)
    return (
      <div>
        <button onClick={() => setOp(o => !o)} className="w-full flex items-center gap-2 py-2.5 px-1 hover:bg-gray-50 rounded-lg">
          <span className="text-xs font-bold text-gray-700">{title}</span>
          {range && <span className="text-xs text-gray-400">{range}</span>}
          <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{items.length}</span>
          <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${op ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
        </button>
        {op && (
          <div className="bg-white rounded-xl border border-gray-200 px-3">
            {visible.map((e, i) => <EntryRow key={i} item={e} />)}
            {!all && sorted.length > 15 && (
              <button onClick={() => setAll(true)} className="w-full py-2 text-xs text-gray-400 hover:text-purple-600 border-t border-gray-50">
                +{sorted.length - 15}건 더 보기
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-3 pb-24">

      {/* ── 헤더 카드 ── */}
      <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl p-4 text-white">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="text-xs font-medium opacity-70">주간 보고 · AE MK</p>
            <p className="text-lg font-bold mt-0.5">{today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p className="text-xs opacity-60 mt-0.5">{fmtRange(thisMon)}</p>
          </div>
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/20 hover:bg-white/30 disabled:opacity-50">
            <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            {syncing ? '동기화 중…' : '동기화'}
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[{ tp: 'meeting', icon: '📅', label: '일정' }, { tp: 'gmail', icon: '✉', label: '이메일' }, { tp: 'slack', icon: '💬', label: '슬랙' }].map(c => {
            const n = thisWeek.filter(e => (e.type || e.log_type) === c.tp).length
            if (!n) return null
            return (
              <div key={c.tp} className="bg-white/15 rounded-xl px-3 py-1.5 text-center min-w-[52px]">
                <p className="text-sm font-bold">{n}</p>
                <p className="text-xs opacity-70">{c.icon} {c.label}</p>
              </div>
            )
          })}
          {actionItems.length > 0 && (
            <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center min-w-[52px]">
              <p className="text-sm font-bold">{doneTasks.length}/{actionItems.length}</p>
              <p className="text-xs opacity-70">✅ 할일</p>
            </div>
          )}
        </div>
        {syncMsg && <p className="mt-2 text-xs opacity-80">{syncMsg}</p>}
      </div>

      {/* ── debug ── */}
      <div className="text-center text-xs text-gray-400 py-1 bg-gray-50 rounded-xl">
        actions:{actionItems.length} | hi:{highlights.length} | ri:{risks.length} | mt:{weekMeetings.length} | ins:{insights.length}
      </div>

      {/* ── 이번 주 핵심 ── */}
      {highlights.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-xs font-bold text-gray-700">🔥 이번 주 핵심</span>
          </div>
          <div className="divide-y divide-gray-50">
            {highlights.map((a, i) => {
              const due = a.due || a.due_date || ''
              const diff = due ? Math.ceil((new Date(due) - today) / 86400000) : null
              const pc = priCfg[a.priority]
              return (
                <div key={i} className="px-4 py-3 flex items-start gap-2">
                  <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded shrink-0 mt-0.5">{a.account}</span>
                  <div className="flex-1 min-w-0">
                    {pc && <span className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded mr-1.5 ${pc.cls}`}>{pc.label}</span>}
                    {diff !== null && <span className={`text-xs font-medium mr-1.5 ${diff < 0 ? 'text-red-500' : diff <= 3 ? 'text-orange-500' : 'text-gray-400'}`}>{diff < 0 ? `D+${Math.abs(diff)}` : `D-${diff}`}</span>}
                    <span className="text-xs text-gray-700 leading-relaxed">{a.action}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 신규 파이프라인 ── */}
      {pipeline.length > 0 && (
        <div className="bg-blue-50 rounded-2xl border border-blue-100 px-4 py-3">
          <p className="text-xs font-bold text-blue-700 mb-2">📈 신규 파이프라인</p>
          <div className="space-y-1.5">
            {pipeline.map((a, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-xs font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded shrink-0">{a.account}</span>
                <p className="text-xs text-blue-800 leading-relaxed">{(a.action || '').slice(0, 60)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 리스크 시그널 ── */}
      {risks.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100">
            <span className="text-xs font-bold text-amber-800">⚠️ 리스크 시그널</span>
          </div>
          <div className="divide-y divide-gray-50">
            {risks.map((r, i) => (
              <div key={i} className="px-4 py-2.5 flex items-start gap-2">
                <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded shrink-0 mt-0.5">{r.account}</span>
                <p className="text-xs text-gray-700 leading-relaxed">{r.risk || r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 미팅 밀도 + 영업 인사이트 ── */}
      {(weekMeetings.length > 0 || insights.length > 0) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-2xl border border-gray-200 p-3">
            <p className="text-xs font-bold text-gray-600 mb-1">📅 미팅 밀도</p>
            <p className="text-2xl font-bold text-purple-600">{weekMeetings.length}</p>
            <p className="text-xs text-gray-400 mb-1">이번 주 고객 미팅</p>
            {meetingAccounts.length > 0 && <p className="text-xs text-gray-500 leading-relaxed">{meetingAccounts.join(', ')}</p>}
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-3">
            <p className="text-xs font-bold text-gray-600 mb-2">💡 영업 인사이트</p>
            <div className="space-y-1.5">
              {insights.map((a, i) => (
                <div key={i}>
                  <p className="text-xs font-semibold text-gray-700">{a.account}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{(a.action || '').slice(0, 55)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 할 일 ── */}
      {actionItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700">✅ 할 일</span>
            <span className="text-xs text-gray-400">{doneTasks.length}/{actionItems.length} 완료</span>
          </div>

          {/* 미완료 */}
          <div className="divide-y divide-gray-50">
            {pendingTasks.map(item => {
              const id = makeActionId(item)
              const st = statuses[id] || {}
              const noteOn = openNotes[id]
              const due = item.due || item.due_date || ''
              const diff = due ? Math.ceil((new Date(due) - today) / 86400000) : null
              const pc = priCfg[item.priority]
              return (
                <div key={id} className="px-3 py-3">
                  <div className="flex items-start gap-2.5">
                    {/* 완료 체크박스 */}
                    <button onClick={() => toggleDone(id, false)}
                      className="w-5 h-5 rounded border-2 border-gray-300 hover:border-purple-400 shrink-0 mt-0.5 flex items-center justify-center transition-colors" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        {item.account && <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">{item.account}</span>}
                        {pc && <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${pc.cls}`}>{pc.label}</span>}
                        {diff !== null && <span className={`text-xs font-medium ${diff < 0 ? 'text-red-500' : diff <= 3 ? 'text-orange-500' : 'text-gray-400'}`}>{diff < 0 ? `D+${Math.abs(diff)}` : `D-${diff}`}</span>}
                      </div>
                      <p className="text-xs text-gray-800 leading-relaxed">{item.action}</p>
                      {st.note && !noteOn && <p className="text-xs text-gray-400 mt-0.5 italic truncate">{st.note}</p>}
                    </div>
                    {/* 메모 토글 */}
                    <button onClick={() => setOpenNotes(p => ({ ...p, [id]: !p[id] }))}
                      className="text-gray-300 hover:text-purple-400 shrink-0 mt-1 transition-colors">
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </button>
                  </div>
                  {noteOn && (
                    <textarea value={st.note || ''} onChange={e => saveNote(id, e.target.value)}
                      placeholder="진행 메모 입력…" rows={2}
                      className="mt-1.5 ml-7 w-[calc(100%-1.75rem)] text-xs border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 placeholder-gray-300 resize-none focus:outline-none focus:ring-1 focus:ring-purple-300" />
                  )}
                </div>
              )
            })}
          </div>

          {/* 완료 항목 */}
          {doneTasks.length > 0 && (
            <div className="border-t border-gray-100">
              <button onClick={() => setShowDone(p => !p)} className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                <span className="text-xs text-gray-400">완료 {doneTasks.length}건</span>
                <svg className={`w-3.5 h-3.5 text-gray-300 ml-auto transition-transform ${showDone ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
              {showDone && (
                <div className="divide-y divide-gray-50 bg-gray-50">
                  {doneTasks.map(item => {
                    const id = makeActionId(item)
                    const st = statuses[id] || {}
                    return (
                      <div key={id} className="px-3 py-2.5 flex items-start gap-2.5">
                        <button onClick={() => toggleDone(id, true)}
                          className="w-5 h-5 rounded border-2 border-green-400 bg-green-400 shrink-0 mt-0.5 flex items-center justify-center">
                          <svg width="10" height="10" fill="none" stroke="white" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                        </button>
                        <div className="flex-1 min-w-0">
                          {item.account && <span className="text-xs text-gray-400 mr-1.5">{item.account}</span>}
                          <span className="text-xs text-gray-400 line-through">{item.action}</span>
                          {st.note && <p className="text-xs text-gray-300 mt-0.5 italic">{st.note}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 이번 주 활동 ── */}
      <FeedSection items={thisWeek} title="이번 주" range={fmtRange(thisMon)} open={true} />

      {/* ── 지난 주 활동 ── */}
      <FeedSection items={lastWeek} title="지난 주" range={fmtRange(lastMon)} open={true} />

      {/* ── 이전 활동 ── */}
      <FeedSection items={earlier} title="이전 활동" range="6개월 이내" open={false} />

      {/* ── 아카이브 ── */}
      {archived.length > 0 && <WeeklyArchive entries={archived} lang={lang} tr={tr} />}

      {/* ── 빈 상태 ── */}
      {!entries.length && !actionItems.length && (
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-8 text-center">
          <p className="text-sm text-gray-500 font-medium">동기화된 활동 없음</p>
          <p className="text-xs text-gray-400 mt-1">동기화 버튼으로 데이터를 가져오세요</p>
        </div>
      )}
    </div>
  )
}

/** 6개월 이전 아카이브: 기본 접힘, 월별 그룹 + 날짜+내용 */
function WeeklyArchive({ entries, lang, tr }) {
  const [open, setOpen] = useState(false)
  const byMonth = {}
  entries.forEach(e => {
    const m = (e.date || '').slice(0, 7) || 'unknown'
    if (!byMonth[m]) byMonth[m] = []
    byMonth[m].push(e)
  })
  const months = Object.keys(byMonth).sort().reverse()
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center gap-2 transition-colors">
        <span className="text-sm">🗄</span>
        <span className="flex-1 text-xs font-bold text-gray-500 uppercase tracking-wider">
          {lang === 'en' ? 'Archive (older than 6 months)' : '아카이브 (6개월 이전)'}
        </span>
        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{entries.length}</span>
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="divide-y divide-gray-100">
          {months.map(month => (
            <div key={month} className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-400 mb-2">{month}</p>
              <div className="space-y-1">
                {byMonth[month].map((item, i) => {
                  const itemType = item.type || item.log_type || 'memo'
                  const chCfg = WEEKLY_CHANNELS.find(c => c.type === itemType) || WEEKLY_CHANNELS[4]
                  const text = tr(cleanSummary(item.summary || item.title || ''))
                  return (
                    <div key={i} className="flex gap-2 items-start py-1">
                      <span className={`text-xs mt-0.5 shrink-0 ${chCfg.color}`}>{chCfg.icon}</span>
                      <span className="text-xs text-gray-400 shrink-0 w-10">{(item.date || '').slice(5)}</span>
                      <div className="flex-1 min-w-0">
                        {item.account && <span className="text-xs font-semibold text-gray-600 mr-1.5">{item.account}</span>}
                        <span className="text-xs text-gray-600 leading-relaxed">{text}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
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

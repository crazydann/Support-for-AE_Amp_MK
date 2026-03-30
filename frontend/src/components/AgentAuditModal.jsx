import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || ''

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

function fmt(arr) {
  const n = parseInt(arr || 0)
  return n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`
}

function daysLeft(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

function typeIcon(type) {
  const m = { email: '✉', slack: '💬', meeting: '🤝', memo: '📝', sfdc: '☁', glean: '🔍', weekly_report: '📊' }
  return m[type] || '📌'
}

// ── 섹션 컴포넌트들 ──────────────────────────────────────────────────────────

function SectionHeader({ children }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-2">
      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{children}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

function UnavailableRow({ label }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-gray-50 border border-dashed border-gray-200">
      <span className="text-sm text-red-400 font-bold shrink-0">✗</span>
      <span className="text-xs text-gray-400">{label}</span>
      <span className="ml-auto text-xs text-gray-300 bg-gray-100 px-2 py-0.5 rounded-full">Agent Analytics API 필요</span>
    </div>
  )
}

function MetricCard({ label, value, sub, color = 'gray' }) {
  const colors = {
    red: 'bg-red-50 border-red-100',
    orange: 'bg-orange-50 border-orange-100',
    yellow: 'bg-yellow-50 border-yellow-100',
    green: 'bg-green-50 border-green-100',
    purple: 'bg-purple-50 border-purple-100',
    gray: 'bg-gray-50 border-gray-100',
  }
  return (
    <div className={`rounded-xl border px-3 py-2 ${colors[color]}`}>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-bold text-gray-800 leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── 메인 모달 ────────────────────────────────────────────────────────────────

export default function AgentAuditModal({ account, relatedActions = [], relatedRisks = [], onClose }) {
  const [intelLog, setIntelLog] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const enc = encodeURIComponent(account.key_account)
    fetch(`${API}/api/intel/log?account=${enc}&days=90`)
      .then(r => r.json())
      .then(d => setIntelLog(d.entries || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [account.key_account])

  const arrNum = parseInt(account.arr || 0)
  const days = daysLeft(account.subscription_end)
  const healthColor = { red: 'red', orange: 'orange', yellow: 'yellow', green: 'green', gray: 'gray' }[account.health] || 'gray'
  const healthLabel = { red: '긴급', orange: '주의', yellow: '모니터링', green: '정상', gray: 'Prospect' }[account.health] || '-'
  const healthBadge = {
    red: 'bg-red-100 text-red-700',
    orange: 'bg-orange-100 text-orange-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    green: 'bg-green-100 text-green-700',
    gray: 'bg-gray-100 text-gray-500',
  }[account.health] || 'bg-gray-100 text-gray-500'

  // Activity history 합산
  const activities = [...(account.activity_history || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8)
  // Intel log (중복 제거)
  const intelEntries = intelLog.slice(0, 10)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* 패널 */}
      <div className="relative h-full w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* ── 헤더 ── */}
        <div className="px-5 pt-5 pb-4 bg-gradient-to-br from-indigo-700 to-indigo-500 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-indigo-300 mb-1 font-medium">{account.group || 'Account'}</p>
              <h2 className="text-lg font-bold text-white leading-tight">{account.key_account}</h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${healthBadge}`}>{healthLabel}</span>
                {account.amplitude_plan && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-400/40 text-indigo-100">{account.amplitude_plan}</span>
                )}
                {account.status === 'prospect' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">Prospect</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-indigo-300 hover:text-white hover:bg-indigo-600 transition-colors shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 핵심 지표 */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
              <p className="text-xs text-indigo-200">ARR</p>
              <p className="text-sm font-bold text-white">{arrNum > 0 ? fmt(account.arr) : '—'}</p>
            </div>
            <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
              <p className="text-xs text-indigo-200">만료일</p>
              <p className={`text-sm font-bold ${days !== null && days < 60 ? 'text-red-200' : 'text-white'}`}>
                {account.subscription_end?.slice(0, 7) || '—'}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
              <p className="text-xs text-indigo-200">D-day</p>
              <p className={`text-sm font-bold ${days !== null && days < 60 ? 'text-red-200' : 'text-white'}`}>
                {days !== null ? `D-${days}` : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* ── 스킬 배지 ── */}
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border-b border-indigo-100 shrink-0">
          <span className="text-base">💡</span>
          <span className="text-xs font-semibold text-indigo-700">Agent Analytics Audit</span>
          <span className="text-xs text-indigo-300 mx-1">·</span>
          <span className="text-xs text-indigo-400">가용 데이터 기반 표시 · Amplitude Analytics API 항목은 ✗ 표시</span>
        </div>

        {/* ── 스크롤 콘텐츠 ── */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">

          {/* 1. 현황 요약 */}
          {(account.notes_summary) && (
            <>
              <SectionHeader>현황 요약</SectionHeader>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-xs text-gray-700 leading-relaxed">{account.notes_summary}</p>
              </div>
            </>
          )}

          {/* 2. 딜 / 전략 */}
          {(account.deal_stage || account.strategy) && (
            <>
              <SectionHeader>딜 & 전략</SectionHeader>
              <div className="space-y-2">
                {account.deal_stage && (
                  <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-purple-400 mb-0.5">딜 스테이지</p>
                    <p className="text-xs font-semibold text-purple-800">{account.deal_stage}</p>
                    {account.deal_amount > 0 && (
                      <p className="text-xs text-purple-600 mt-0.5">목표 ARR: ${(account.deal_amount / 1000).toFixed(0)}K</p>
                    )}
                  </div>
                )}
                {account.strategy && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-blue-400 mb-0.5">전략 방향</p>
                    <p className="text-xs text-blue-800 leading-relaxed">{account.strategy}</p>
                  </div>
                )}
                {account.next_action && (
                  <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-green-500 mb-0.5">다음 액션</p>
                    <p className="text-xs text-green-800 font-medium">{account.next_action}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 3. 액션 아이템 */}
          {relatedActions.length > 0 && (
            <>
              <SectionHeader>액션 아이템 ({relatedActions.length})</SectionHeader>
              <div className="space-y-1.5">
                {relatedActions.map((item, i) => (
                  <div key={i} className={`rounded-xl px-3 py-2 border flex gap-2 ${item.priority === 'urgent' ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
                    <span className="text-sm shrink-0">{item.priority === 'urgent' ? '🚨' : '⚡'}</span>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-700 leading-snug">{item.action}</p>
                      {item.due && <p className="text-xs text-gray-400 mt-0.5">기한: {item.due}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 4. 리스크 */}
          {relatedRisks.length > 0 && (
            <>
              <SectionHeader>리스크 ({relatedRisks.length})</SectionHeader>
              <div className="space-y-1.5">
                {relatedRisks.map((risk, i) => (
                  <div key={i} className="rounded-xl px-3 py-2 bg-red-50 border border-red-100 flex gap-2">
                    <span className="text-sm shrink-0">⚠️</span>
                    <p className="text-xs text-red-700 leading-snug">{risk.risk || risk.description || JSON.stringify(risk)}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 5. 최근 활동 이력 */}
          {activities.length > 0 && (
            <>
              <SectionHeader>최근 활동 ({activities.length})</SectionHeader>
              <div className="space-y-1.5">
                {activities.map((act, i) => (
                  <div key={i} className="flex gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50">
                    <span className="text-sm shrink-0 mt-0.5">{typeIcon(act.type)}</span>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-600 leading-snug">{act.summary}</p>
                      <p className="text-xs text-gray-300 mt-0.5">{act.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 6. Intel 로그 */}
          {!loading && intelEntries.length > 0 && (
            <>
              <SectionHeader>Intel 로그 (최근 90일)</SectionHeader>
              <div className="space-y-1.5">
                {intelEntries.map((e, i) => (
                  <div key={i} className="flex gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50">
                    <span className="text-sm shrink-0 mt-0.5">{typeIcon(e.source)}</span>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-600 leading-snug">{e.summary}</p>
                      <p className="text-xs text-gray-300 mt-0.5">{e.date} · {e.source}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Amplitude Agent Analytics 섹션 (✗) ── */}
          <SectionHeader>Amplitude AI Agent 도입 현황</SectionHeader>
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-3 py-3 mb-1">
            <p className="text-xs text-gray-400 mb-2.5 text-center">아래 항목은 Amplitude Agent Analytics API 연결 시 표시됩니다</p>
            <div className="space-y-2">
              <UnavailableRow label="Global Chat 세션 수 · 사용자 수 · 평균 품질 점수" />
              <UnavailableRow label="사용자 도입 등급 (Power · Moderate · One-time)" />
              <UnavailableRow label="주요 Use Case 테마 분포" />
              <UnavailableRow label="에이전트별 사용량 분포" />
            </div>
          </div>

          <SectionHeader>실패 원인 분석</SectionHeader>
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-3 py-3 mb-1">
            <div className="space-y-2">
              <UnavailableRow label="Invalid chart definitions (잘못된 속성/타입)" />
              <UnavailableRow label="Tool timeout / 백엔드 오류" />
              <UnavailableRow label="Taxonomy 누락 속성 (사용자가 요청한 미수집 지표)" />
              <UnavailableRow label="Capability gap (지원 불가 기능 요청)" />
            </div>
          </div>

          <SectionHeader>AI Context 권장사항</SectionHeader>
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-3 py-3">
            <div className="space-y-2">
              <UnavailableRow label="Taxonomy 매핑 문서 (실패 세션 기반)" />
              <UnavailableRow label="KPI 정의 권장사항" />
              <UnavailableRow label="AI Context 설정 개선안" />
            </div>
          </div>

        </div>

        {/* ── 푸터 ── */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
          <p className="text-xs text-gray-400">✅ 가용 데이터 · ✗ Agent Analytics API 필요</p>
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

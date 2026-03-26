import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useState } from 'react'
import CompanyHeader from '../components/CompanyHeader'
import ExecutivesPanel from '../components/ExecutivesPanel'
import SubsidiariesPanel from '../components/SubsidiariesPanel'
import ServicesPanel from '../components/ServicesPanel'
import NewsPanel from '../components/NewsPanel'
import AIStrategyPanel from '../components/AIStrategyPanel'
import OrgChartPanel from '../components/OrgChartPanel'
import LoadingBlueprint from '../components/LoadingBlueprint'

const TABS = [
  { id: 'overview', label: '개요' },
  { id: 'orgchart', label: '그룹 조직도' },
  { id: 'executives', label: '임원진' },
  { id: 'services', label: '서비스' },
  { id: 'news', label: '최신 뉴스' },
  { id: 'strategy', label: 'AI 전략' },
]

export default function BlueprintPage({ companyName }) {
  const [activeTab, setActiveTab] = useState('overview')

  const { data, isLoading, error } = useQuery({
    queryKey: ['blueprint', companyName],
    queryFn: async () => {
      const res = await axios.get(
        `/api/company/blueprint/${encodeURIComponent(companyName)}`
      )
      return res.data
    },
    staleTime: 10 * 60 * 1000,
  })

  if (isLoading) return <LoadingBlueprint companyName={companyName} />

  if (error) {
    return (
      <div className="flex flex-col items-center pt-20">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <p className="text-red-600 font-medium mb-2">데이터 로드 실패</p>
          <p className="text-red-400 text-sm">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Company Header */}
      <CompanyHeader blueprint={data} />

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {TABS.map((tab) => {
            const count = getTabCount(tab.id, data)
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-amplitude-purple text-amplitude-purple bg-amplitude-light/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    activeTab === tab.id
                      ? 'bg-amplitude-purple text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && <OverviewTab blueprint={data} onTabChange={setActiveTab} />}
          {activeTab === 'orgchart' && <OrgChartPanel orgChart={data.org_chart} companyName={companyName} />}
          {activeTab === 'executives' && <ExecutivesPanel executives={data.executives} />}
          {activeTab === 'services' && <ServicesPanel services={data.web_services} apps={data.apps} />}
          {activeTab === 'news' && <NewsPanel news={data.recent_news} />}
          {activeTab === 'strategy' && (
            <AIStrategyPanel blueprint={data} companyName={companyName} />
          )}
        </div>
      </div>
    </div>
  )
}

function OverviewTab({ blueprint, onTabChange }) {
  return (
    <div className="space-y-6">
      {/* Business Description */}
      {blueprint.description && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">기업 소개</h3>
          <p className="text-gray-700 leading-relaxed">{blueprint.description}</p>
        </div>
      )}

      {/* Amplitude 현황 카드 */}
      {blueprint.amplitude_status && (
        <AmplitudeStatusCard blueprint={blueprint} onTabChange={onTabChange} />
      )}

      {/* Key Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '비즈니스 유형', value: blueprint.business_type || '-' },
          { label: '온/오프라인', value: blueprint.online_offline_ratio || '-' },
          { label: '임직원 수', value: blueprint.employees || '-' },
          { label: '설립연도', value: blueprint.founded ? blueprint.founded.slice(0, 4) + '년' : '-' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className="text-sm font-semibold text-gray-800">{value}</p>
          </div>
        ))}
      </div>

      {/* Quick Previews */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Executives Preview */}
        {blueprint.executives?.length > 0 && (
          <div className="border border-gray-100 rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-700">주요 임원</h3>
              <button onClick={() => onTabChange('executives')} className="text-xs text-amplitude-purple hover:underline">
                전체보기 ({blueprint.executives.length})
              </button>
            </div>
            <div className="space-y-2">
              {blueprint.executives.slice(0, 4).map((e, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="font-medium text-gray-800">{e.name}</span>
                  <span className="text-gray-400 text-xs">{e.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent News Preview */}
        {blueprint.recent_news?.length > 0 && (
          <div className="border border-gray-100 rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-700">최신 뉴스</h3>
              <button onClick={() => onTabChange('news')} className="text-xs text-amplitude-purple hover:underline">
                전체보기
              </button>
            </div>
            <div className="space-y-2">
              {blueprint.recent_news.slice(0, 3).map((n, i) => (
                <div key={i} className="text-sm">
                  <p className="text-gray-700 line-clamp-1">{n.title}</p>
                  <p className="text-xs text-gray-400">{n.date} · {n.source}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Analysis Preview */}
      {blueprint.ai_analysis && (
        <div className="bg-amplitude-light rounded-xl p-5 border border-purple-100">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-semibold text-amplitude-purple">AI 분석 요약</h3>
            <button onClick={() => onTabChange('strategy')} className="text-xs text-amplitude-purple hover:underline">
              전략 전체보기 →
            </button>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">
            {blueprint.ai_analysis}
          </p>
        </div>
      )}

      {/* Data Sources */}
      {blueprint.data_sources?.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>데이터 출처:</span>
          {blueprint.data_sources.map((s) => (
            <span key={s} className="bg-gray-100 px-2 py-0.5 rounded">{s}</span>
          ))}
          {blueprint.last_updated && (
            <span className="ml-auto">
              업데이트: {new Date(blueprint.last_updated).toLocaleString('ko-KR')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function AmplitudeStatusCard({ blueprint, onTabChange }) {
  const STATUS = {
    active:   { bg: 'bg-purple-50', border: 'border-purple-200', title: 'text-purple-700', icon: '🟣' },
    not_used: { bg: 'bg-gray-50',   border: 'border-gray-200',   title: 'text-gray-600',   icon: '⚪' },
    unknown:  { bg: 'bg-amber-50',  border: 'border-amber-200',  title: 'text-amber-700',  icon: '🟡' },
  }
  const s = STATUS[blueprint.amplitude_status] || STATUS.unknown
  const labels = { active: 'Amplitude 도입 완료', not_used: 'Amplitude 미도입', unknown: 'Amplitude 도입 여부 미확인' }

  return (
    <div className={`rounded-xl p-4 border ${s.border} ${s.bg}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className={`text-sm font-semibold flex items-center gap-2 ${s.title}`}>
          <span>{s.icon}</span>
          {labels[blueprint.amplitude_status]}
          {blueprint.amplitude_plan && (
            <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
              {blueprint.amplitude_plan} Plan
            </span>
          )}
        </h3>
        {blueprint.org_chart?.length > 0 && (
          <button onClick={() => onTabChange('orgchart')} className={`text-xs hover:underline ${s.title}`}>
            그룹 전체 현황 →
          </button>
        )}
      </div>
      {blueprint.amplitude_note && (
        <p className="text-sm text-gray-600">{blueprint.amplitude_note}</p>
      )}
    </div>
  )
}

function getTabCount(tabId, data) {
  if (!data) return 0
  const counts = {
    orgchart:  (data.org_chart?.length || 0) > 0 ? '조직도' : 0,
    executives: data.executives?.length || 0,
    services: (data.web_services?.length || 0) + (data.apps?.length || 0),
    news: data.recent_news?.length || 0,
  }
  return counts[tabId] || 0
}

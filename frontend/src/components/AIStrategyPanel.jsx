import { useState } from 'react'
import { Sparkles, Target, Mail, ChevronDown, ChevronUp, Send, Loader } from 'lucide-react'
import axios from 'axios'

export default function AIStrategyPanel({ blueprint, companyName }) {
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showRefine, setShowRefine] = useState(false)
  const [notes, setNotes] = useState('')
  const [refinedStrategy, setRefinedStrategy] = useState('')
  const [refineLoading, setRefineLoading] = useState(false)

  const handleRefine = async () => {
    if (!notes.trim()) return
    setRefineLoading(true)
    try {
      const res = await axios.post(
        `/api/company/blueprint/${encodeURIComponent(companyName)}/refine-strategy`,
        { notes }
      )
      setRefinedStrategy(res.data.refined_strategy)
    } catch {
      setRefinedStrategy('전략 보완 중 오류가 발생했습니다.')
    } finally {
      setRefineLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Full Analysis */}
      {blueprint.ai_analysis && (
        <Section title="기업 분석 요약" icon={<Sparkles size={16} className="text-amplitude-purple" />}>
          <FormattedText text={blueprint.ai_analysis} />
        </Section>
      )}

      {/* Amplitude Opportunity */}
      {blueprint.amplitude_opportunity && (
        <Section title="Amplitude 기회 분석" icon={<Target size={16} className="text-green-500" />} color="green">
          <FormattedText text={blueprint.amplitude_opportunity} />
        </Section>
      )}

      {/* Recommended Strategy */}
      {blueprint.recommended_strategy && (
        <Section title="추천 세일즈 전략" icon={<Target size={16} className="text-blue-500" />} color="blue">
          <FormattedText text={blueprint.recommended_strategy} />
        </Section>
      )}

      {/* Refine Strategy */}
      <div className="border border-dashed border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowRefine(!showRefine)}
          className="w-full flex items-center justify-between p-4 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Sparkles size={14} className="text-amplitude-purple" />
            내 전략 메모로 AI 보완하기
          </span>
          {showRefine ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showRefine && (
          <div className="p-4 border-t border-gray-100 space-y-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="현재 파악한 상황, 고객과 나눈 대화, 생각하는 전략 등을 자유롭게 입력하세요..."
              className="w-full p-3 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-amplitude-purple h-28"
            />
            <button
              onClick={handleRefine}
              disabled={refineLoading || !notes.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-amplitude-purple text-white text-sm rounded-xl disabled:opacity-50 hover:bg-purple-700 transition-colors"
            >
              {refineLoading ? (
                <Loader size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              전략 보완 요청
            </button>
            {refinedStrategy && (
              <div className="bg-amplitude-light rounded-xl p-4">
                <h4 className="text-xs font-semibold text-amplitude-purple mb-2">AI 보완 전략</h4>
                <FormattedText text={refinedStrategy} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Email Draft Button */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowEmailModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 border border-amplitude-purple text-amplitude-purple text-sm rounded-xl hover:bg-amplitude-light transition-colors"
        >
          <Mail size={14} />
          영업 이메일 초안 생성
        </button>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <EmailDraftModal
          companyName={companyName}
          executives={blueprint.executives || []}
          onClose={() => setShowEmailModal(false)}
        />
      )}
    </div>
  )
}

function Section({ title, icon, children, color = 'purple' }) {
  const colorMap = {
    purple: 'bg-amplitude-light border-purple-100',
    green: 'bg-green-50 border-green-100',
    blue: 'bg-blue-50 border-blue-100',
  }
  const titleColorMap = {
    purple: 'text-amplitude-purple',
    green: 'text-green-600',
    blue: 'text-blue-600',
  }
  return (
    <div className={`rounded-xl p-5 border ${colorMap[color]}`}>
      <h3 className={`flex items-center gap-2 text-sm font-semibold mb-3 ${titleColorMap[color]}`}>
        {icon}
        {title}
      </h3>
      {children}
    </div>
  )
}

function FormattedText({ text }) {
  return (
    <div className="text-sm text-gray-700 leading-relaxed space-y-1">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="font-semibold text-gray-800">{line.slice(2, -2)}</p>
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <p key={i} className="flex gap-2">
              <span className="text-gray-400 flex-shrink-0">·</span>
              <span>{line.slice(2)}</span>
            </p>
          )
        }
        if (line.match(/^\d+\./)) {
          return <p key={i} className="font-medium">{line}</p>
        }
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i}>{line}</p>
      })}
    </div>
  )
}

function EmailDraftModal({ companyName, executives, onClose }) {
  const [form, setForm] = useState({
    recipient_name: '',
    recipient_title: '',
    purpose: 'Amplitude 제품 소개 및 미팅 요청',
  })
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await axios.post(
        `/api/company/blueprint/${encodeURIComponent(companyName)}/email-draft`,
        form
      )
      setDraft(res.data.draft)
    } catch {
      setDraft('이메일 초안 생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-base font-semibold text-gray-800">영업 이메일 초안 생성</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          <div className="space-y-4">
            {/* Recipient from executives */}
            {executives.length > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">임원 선택</label>
                <select
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-sm"
                  onChange={(e) => {
                    const exec = executives.find(ex => ex.name === e.target.value)
                    if (exec) setForm(f => ({ ...f, recipient_name: exec.name, recipient_title: exec.title }))
                  }}
                >
                  <option value="">직접 입력 또는 선택</option>
                  {executives.slice(0, 10).map((e, i) => (
                    <option key={i} value={e.name}>{e.name} - {e.title}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">수신자 이름</label>
                <input
                  value={form.recipient_name}
                  onChange={(e) => setForm(f => ({ ...f, recipient_name: e.target.value }))}
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-sm"
                  placeholder="홍길동"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">직책</label>
                <input
                  value={form.recipient_title}
                  onChange={(e) => setForm(f => ({ ...f, recipient_title: e.target.value }))}
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-sm"
                  placeholder="부사장"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">이메일 목적</label>
              <input
                value={form.purpose}
                onChange={(e) => setForm(f => ({ ...f, purpose: e.target.value }))}
                className="w-full p-2.5 border border-gray-200 rounded-lg text-sm"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-amplitude-purple text-white text-sm rounded-xl disabled:opacity-50 hover:bg-purple-700 transition-colors"
            >
              {loading ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
              초안 생성
            </button>

            {draft && (
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-500 mb-1 block">생성된 이메일 초안</label>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none h-48 focus:outline-none focus:ring-2 focus:ring-amplitude-purple"
                />
                <button
                  onClick={() => { navigator.clipboard.writeText(draft) }}
                  className="mt-2 text-xs text-amplitude-purple hover:underline"
                >
                  클립보드에 복사
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

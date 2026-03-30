import { useState, useRef, useEffect } from 'react'

// 간단한 마크다운 → HTML 변환 (헤더, 볼드, 리스트, 코드블록)
function renderMarkdown(text) {
  const lines = text.split('\n')
  const html = []
  let inCode = false
  let codeLines = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('```')) {
      if (inCode) {
        html.push(`<pre class="bg-gray-900 text-green-300 rounded-lg p-3 text-xs overflow-x-auto my-2 font-mono">${codeLines.join('\n')}</pre>`)
        codeLines = []
        inCode = false
      } else {
        inCode = true
      }
      continue
    }
    if (inCode) { codeLines.push(line); continue }

    if (line.startsWith('### ')) {
      html.push(`<h3 class="text-sm font-bold text-gray-900 mt-5 mb-2 pb-1 border-b border-gray-200">${line.slice(4)}</h3>`)
    } else if (line.startsWith('## ')) {
      html.push(`<h2 class="text-base font-bold text-indigo-700 mt-6 mb-2">${line.slice(3)}</h2>`)
    } else if (line.startsWith('# ')) {
      html.push(`<h1 class="text-lg font-bold text-gray-900 mt-2 mb-3">${line.slice(2)}</h1>`)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const content = line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-xs font-mono">$1</code>')
      html.push(`<li class="text-sm text-gray-700 ml-4 mb-1 list-disc">${content}</li>`)
    } else if (/^\d+\.\s/.test(line)) {
      const content = line.replace(/^\d+\.\s/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-xs font-mono">$1</code>')
      html.push(`<li class="text-sm text-gray-700 ml-4 mb-1 list-decimal">${content}</li>`)
    } else if (line.trim() === '') {
      html.push(`<div class="mb-1"></div>`)
    } else {
      const content = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-xs font-mono">$1</code>')
      html.push(`<p class="text-sm text-gray-700 mb-1 leading-relaxed">${content}</p>`)
    }
  }

  return html.join('')
}

export default function AgentAuditModal({ account, onClose }) {
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [content, setContent] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const bottomRef = useRef(null)
  const abortRef = useRef(null)

  // 모달 열리면 자동 실행
  useEffect(() => {
    runAudit()
    return () => abortRef.current?.abort()
  }, [])

  // 스트리밍 중 자동 스크롤
  useEffect(() => {
    if (status === 'loading') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [content])

  async function runAudit() {
    setStatus('loading')
    setContent('')
    setErrorMsg('')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const encodedName = encodeURIComponent(account.key_account)
      const res = await fetch(`/api/intel/agent-audit/${encodedName}`, {
        method: 'POST',
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || 'API 오류')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') { setStatus('done'); break }
          try {
            const parsed = JSON.parse(raw)
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.text) setContent(prev => prev + parsed.text)
          } catch (e) {
            if (e.message !== 'Unexpected end of JSON input') throw e
          }
        }
      }
      setStatus('done')
    } catch (e) {
      if (e.name === 'AbortError') return
      setErrorMsg(e.message)
      setStatus('error')
    }
  }

  const healthColors = {
    red: 'bg-red-100 text-red-700',
    orange: 'bg-orange-100 text-orange-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    green: 'bg-green-100 text-green-700',
    gray: 'bg-gray-100 text-gray-600',
  }
  const hc = healthColors[account.health] || healthColors.gray
  const arrNum = parseInt(account.arr || '0')

  return (
    /* 배경 오버레이 */
    <div
      className="fixed inset-0 z-50 flex items-end justify-end"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* 패널 */}
      <div className="relative h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col">

        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-indigo-500">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white truncate">{account.key_account}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${hc}`}>{account.health?.toUpperCase()}</span>
            </div>
            <p className="text-xs text-indigo-200 mt-0.5">
              {account.amplitude_plan} · ARR ${arrNum >= 1000 ? (arrNum/1000).toFixed(0)+'K' : arrNum} · 만료 {account.subscription_end?.slice(0,7) || 'N/A'}
            </p>
          </div>
          {/* 재실행 버튼 */}
          {status !== 'loading' && (
            <button
              onClick={runAudit}
              title="다시 분석"
              className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-indigo-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 스킬 배지 */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 border-b border-indigo-100">
          <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center shrink-0">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-indigo-700">Agent Analytics Audit Skill</span>
          <span className="text-xs text-indigo-400 ml-auto">
            {status === 'loading' && '분석 중...'}
            {status === 'done' && '✓ 완료'}
            {status === 'error' && '⚠ 오류'}
          </span>
        </div>

        {/* 콘텐츠 영역 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* 로딩 상태 */}
          {status === 'loading' && content === '' && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Claude가 계정 데이터를 분석 중입니다...</p>
            </div>
          )}

          {/* 오류 */}
          {status === 'error' && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              <strong>오류:</strong> {errorMsg}
            </div>
          )}

          {/* 스트리밍 마크다운 */}
          {content && (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          )}

          {/* 스트리밍 커서 */}
          {status === 'loading' && content && (
            <span className="inline-block w-1.5 h-4 bg-indigo-500 rounded-sm animate-pulse ml-0.5 align-middle" />
          )}

          <div ref={bottomRef} />
        </div>

        {/* 푸터 */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Powered by Claude · {new Date().toLocaleDateString('ko-KR')}
          </p>
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

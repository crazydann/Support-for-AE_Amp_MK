import { useState, useEffect, useRef } from 'react'
import { useLang } from '../contexts/LanguageContext'
import AgentAuditModal from './AgentAuditModal'

const API = import.meta.env.VITE_API_URL || ''

function pick(obj, key, lang) {
  return (lang === 'en' && obj[`${key}_en`]) ? obj[`${key}_en`] : obj[key]
}

const healthDot = {
  red: 'bg-red-500', orange: 'bg-orange-500', yellow: 'bg-yellow-400',
  green: 'bg-green-500', gray: 'bg-gray-400',
}

export default function AccountSearch() {
  const { lang } = useLang()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [report, setReport] = useState(null)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const inputRef = useRef(null)
  const containerRef = useRef(null)

  // report 데이터 로드 (한 번만)
  useEffect(() => {
    fetch(`${API}/api/intel/report`)
      .then(r => r.json())
      .then(d => setReport(d))
      .catch(() => {})
  }, [])

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // 계정 필터링
  const accounts = report?.accounts || []
  const q = query.trim().toLowerCase()
  const results = q.length < 1 ? [] : accounts.filter(a =>
    a.key_account.toLowerCase().includes(q) ||
    (a.group || '').toLowerCase().includes(q) ||
    (a.notes_summary || '').toLowerCase().includes(q)
  ).slice(0, 8)

  function handleSelect(account) {
    setSelectedAccount(account)
    setQuery('')
    setOpen(false)
  }

  return (
    <>
      {/* 검색 인풋 */}
      <div ref={containerRef} className="relative flex-1 mx-2 max-w-[160px]">
        <div className="flex items-center bg-gray-100 rounded-lg px-2 py-1 gap-1.5">
          <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder={lang === 'en' ? 'Search account' : '계정 검색'}
            className="bg-transparent text-xs text-gray-700 placeholder-gray-400 outline-none w-full min-w-0"
          />
          {query && (
            <button onClick={() => { setQuery(''); setOpen(false) }} className="text-gray-400 hover:text-gray-600 shrink-0">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* 드롭다운 결과 */}
        {open && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50" style={{ minWidth: '240px' }}>
            {results.map((account, i) => {
              const arrNum = parseInt(account.arr || 0)
              return (
                <button
                  key={i}
                  onMouseDown={e => { e.preventDefault(); handleSelect(account) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${healthDot[account.health] || 'bg-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{account.key_account}</p>
                    <p className="text-xs text-gray-400 truncate">{account.group} · {account.amplitude_plan || (lang === 'en' ? 'Prospect' : 'Prospect')}</p>
                  </div>
                  {arrNum > 0 && (
                    <span className="text-xs font-bold text-gray-600 shrink-0">
                      ${arrNum >= 1000 ? (arrNum / 1000).toFixed(0) + 'K' : arrNum}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* 결과 없음 */}
        {open && q.length > 0 && results.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-3 z-50" style={{ minWidth: '200px' }}>
            <p className="text-xs text-gray-400 text-center">
              {lang === 'en' ? 'No accounts found' : '검색 결과 없음'}
            </p>
          </div>
        )}
      </div>

      {/* 계정 상세 팝업 */}
      {selectedAccount && report && (
        <AgentAuditModal
          account={selectedAccount}
          relatedActions={(report.action_items || []).filter(a => a.account === selectedAccount.key_account)}
          relatedRisks={(report.risks || []).filter(r => r.account === selectedAccount.key_account)}
          onClose={() => setSelectedAccount(null)}
        />
      )}
    </>
  )
}

import { useState, useRef, useEffect } from 'react'
import { Search, Building2, TrendingUp, Users, Globe } from 'lucide-react'
import axios from 'axios'

const RECENT_KEY = 'ae_recent_companies'

export default function SearchPage({ onSelectCompany }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [recentCompanies, setRecentCompanies] = useState([])
  const debounceRef = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem(RECENT_KEY)
    if (saved) setRecentCompanies(JSON.parse(saved))
  }, [])

  const handleQueryChange = (val) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.length < 2) {
      setSuggestions([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/company/search?q=${encodeURIComponent(val)}`)
        setSuggestions(res.data)
      } catch {
        setSuggestions([])
      }
    }, 300)
  }

  const handleSelect = (name) => {
    const updated = [name, ...recentCompanies.filter((c) => c !== name)].slice(0, 6)
    setRecentCompanies(updated)
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
    onSelectCompany(name)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (query.trim()) handleSelect(query.trim())
  }

  return (
    <div className="flex flex-col items-center pt-16">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-amplitude-light text-amplitude-purple text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          <TrendingUp size={14} />
          Amplitude AE 전용 고객 인텔리전스
        </div>
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          고객사 청사진을 <span className="text-amplitude-purple">AI로</span> 즉시 생성
        </h2>
        <p className="text-gray-500 text-lg max-w-xl">
          기업명만 입력하면 임원진, 계열사, 비즈니스 모델, 최신 뉴스까지<br />
          Amplitude 세일즈 전략까지 자동으로 분석합니다
        </p>
      </div>

      {/* Search Box */}
      <div className="w-full max-w-2xl relative mb-6">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="기업명 입력 (예: 삼성전자, 카카오, 현대자동차)"
              className="w-full pl-12 pr-32 py-4 text-base border border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-amplitude-purple focus:border-transparent bg-white"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-amplitude-purple text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              청사진 생성
            </button>
          </div>
        </form>

        {/* Suggestions Dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
            {suggestions.map((s) => (
              <button
                key={s.corp_code}
                onClick={() => handleSelect(s.corp_name)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
              >
                <Building2 size={16} className="text-gray-400 flex-shrink-0" />
                <div>
                  <span className="text-sm font-medium text-gray-800">{s.corp_name}</span>
                  {s.stock_code && (
                    <span className="ml-2 text-xs text-gray-400">KOSPI/KOSDAQ</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recent Companies */}
      {recentCompanies.length > 0 && (
        <div className="w-full max-w-2xl mb-10">
          <p className="text-xs text-gray-400 mb-2 font-medium">최근 검색</p>
          <div className="flex flex-wrap gap-2">
            {recentCompanies.map((c) => (
              <button
                key={c}
                onClick={() => handleSelect(c)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-amplitude-purple hover:text-amplitude-purple transition-colors"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feature Cards */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-2xl">
        {[
          { icon: Building2, title: '기업 청사진', desc: '임원진, 계열사, 비즈니스 모델 자동 수집' },
          { icon: Globe, title: '온라인 인텔리전스', desc: '웹/앱 서비스, 최신 뉴스 실시간 분석' },
          { icon: TrendingUp, title: 'AI 세일즈 전략', desc: 'Amplitude 기회 및 접근 전략 자동 생성' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <Icon size={20} className="text-amplitude-purple mb-2" />
            <h3 className="text-sm font-semibold text-gray-800 mb-1">{title}</h3>
            <p className="text-xs text-gray-500">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

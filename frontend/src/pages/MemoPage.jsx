import { useState, useEffect, useRef, useMemo } from 'react'
import { useLang } from '../contexts/LanguageContext'
import { useTranslations } from '../hooks/useTranslations'

const API = import.meta.env.VITE_API_URL || ''

// 클라이언트 측 키워드 매핑 (백엔드 account_keywords.py와 동기화)
const KEYWORD_MAP = {
  'TVING':              ['tving', '티빙', 'yb.lee10', 'cjons', '서비스플래닝'],
  'CJ Olive Young':     ['olive young', '올리브영', 'oliveyoung'],
  '하이마트':            ['하이마트', 'himart', 'maxonomy', '마소노미'],
  'Lotte Shopping':     ['롯데온', 'lotteon', 'martinee', '마티니', 'lotte shopping'],
  'Lotte Members':      ['롯데멤버스', 'lotte members', '롯데포인트'],
  'Starbucks Korea':    ['starbucks', '스타벅스', 'sbux'],
  'SSG.com':            ['ssg.com', 'ssg닷컴', '쓱닷컴', 'ssg커머스'],
  'Shinsegae Live Shopping': ['신세계라이브', 'shinsegae live', '쓱라이브'],
  'GS Retail':          ['gs retail', 'gs리테일', 'gs25', 'gs수퍼'],
  'LG Uplus (CTO)':     ['lg uplus', 'uplus', '유플러스'],
  'Golfzon County':     ['golfzon', '골프존'],
  'KT Alpha':           ['kt alpha', 'kt알파'],
  'SK Telecom (IFLAND)':['ifland', 'sk telecom', 'skt', 'sk adot'],
  'Samsung Next':       ['samsung next', '삼성넥스트'],
  'SPC (Secta9ine)':    ['spc', 'secta9ine', '섹나나인', '파리바게뜨', 'baskin'],
  '야놀자 (NOL Universe)':['야놀자', 'yanolja', 'nol universe', '놀유니버스'],
  '인터파크트리플':       ['인터파크', 'interpark', '트리플', 'triple'],
  '두나무 (Dunamu)':     ['두나무', 'dunamu', 'upbit', '업비트', '람다256'],
  '무신사 (Musinsa)':    ['무신사', 'musinsa'],
  'Naver Corp':         ['naver', '네이버'],
  'Hyundai Motor Group':['hyundai motor', '현대차', '현대자동차', 'genesis', '제네시스'],
  'Hyundai Department Store': ['현대백화점', 'hyundai department', 'hpoint'],
}

function detectAccount(text) {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const [account, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) return account
  }
  return null
}

export default function MemoPage() {
  const { t, lang } = useLang()
  const { tr } = useTranslations(lang)
  const [notes, setNotes] = useState([])
  const [text, setText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')
  const recognitionRef = useRef(null)
  const textareaRef = useRef(null)

  // 실시간 자동 감지 (계정 선택 UI 없음 - 내용 기반 자동)
  const autoDetected = useMemo(() => detectAccount(text), [text])

  useEffect(() => {
    setVoiceSupported('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
    loadNotes()
  }, [])

  async function loadNotes() {
    try {
      const res = await fetch(`${API}/api/intel/notes`)
      const data = await res.json()
      setNotes(data.notes || [])
    } catch (e) { console.error(e) }
  }

  function startVoice() {
    const SR = window.webkitSpeechRecognition || window.SpeechRecognition
    const recognition = new SR()
    recognitionRef.current = recognition
    recognition.lang = 'ko-KR'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onstart = () => setIsListening(true)
    recognition.onend   = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
    recognition.onresult = (e) => {
      let transcript = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript
      }
      setText(prev => prev ? prev + ' ' + transcript : transcript)
    }
    recognition.start()
  }

  function stopVoice() {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  async function saveNote() {
    if (!text.trim()) return
    setSaving(true)
    try {
      // account는 보내지 않음 → 백엔드가 내용 기반 자동 감지
      await fetch(`${API}/api/intel/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text.trim(),
          type: isListening ? 'voice' : 'text',
        }),
      })
      setText('')
      await loadNotes()
      textareaRef.current?.focus()
    } finally {
      setSaving(false)
    }
  }

  async function deleteNote(id) {
    await fetch(`${API}/api/intel/notes/${id}`, { method: 'DELETE' })
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  const accountsWithNotes = [...new Set(notes.map(n => n.account).filter(Boolean))]
  const filtered = filter === 'all' ? notes : notes.filter(n => n.account === filter)

  return (
    <div className="space-y-5 pb-28">
      {/* 입력 영역 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-900">{t('addMemo')}</h2>

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={isListening ? t('listeningPlaceholder') : t('memoPlaceholder')}
            rows={4}
            className={`w-full text-sm border rounded-xl px-3 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 transition-colors ${
              isListening ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
            } text-gray-800`}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveNote() }}
          />
          {isListening && (
            <div className="absolute top-2 right-2 flex items-center gap-1">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"/>
              <span className="text-xs text-red-500 font-medium">{t('recording')}</span>
            </div>
          )}
        </div>

        {/* 자동 계정 감지 미리보기 */}
        <div className="flex items-center gap-2 min-h-[20px]">
          {autoDetected ? (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {lang === 'en' ? 'Account detected:' : '계정 감지됨:'}
              <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">{autoDetected}</span>
            </span>
          ) : text.trim() ? (
            <span className="text-xs text-gray-400">{lang === 'en' ? 'No account detected (saved as general memo)' : '계정 미감지 (일반 메모로 저장)'}</span>
          ) : null}
        </div>

        <div className="flex gap-2">
          {voiceSupported && (
            <button
              onClick={isListening ? stopVoice : startVoice}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isListening
                  ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isListening ? (
                <><span className="w-3 h-3 bg-white rounded-sm"/> {t('stopVoice')}</>
              ) : (
                <><MicIcon /> {t('startVoice')}</>
              )}
            </button>
          )}
          <button
            onClick={saveNote}
            disabled={!text.trim() || saving}
            className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-purple-700 transition-colors active:scale-95"
          >
            {saving ? t('saving') : t('save')}
          </button>
        </div>

        {!voiceSupported && (
          <p className="text-xs text-gray-400 text-center">{t('voiceNotSupported')}</p>
        )}
      </div>

      {/* 메모 목록 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">
            {t('memoTitle')} <span className="text-gray-400 font-normal">({notes.length})</span>
          </h2>
          {accountsWithNotes.length > 0 && (
            <div className="flex gap-1 overflow-x-auto max-w-[60%]">
              <button
                onClick={() => setFilter('all')}
                className={`shrink-0 text-xs px-2.5 py-1 rounded-full ${
                  filter === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {t('filterAllMemo')}
              </button>
              {accountsWithNotes.map(a => (
                <button
                  key={a}
                  onClick={() => setFilter(a)}
                  className={`shrink-0 text-xs px-2.5 py-1 rounded-full whitespace-nowrap ${
                    filter === a ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">📝</p>
            <p className="text-sm">{t('noMemo')}</p>
            <p className="text-xs mt-1">{t('noMemoSub')}</p>
          </div>
        ) : (
          filtered.map(note => <NoteCard key={note.id} note={note} onDelete={deleteNote} t={t} lang={lang} tr={tr} />)
        )}
      </div>
    </div>
  )
}

function NoteCard({ note, onDelete, t, lang, tr }) {
  const [expanded, setExpanded] = useState(false)
  const displayContent = (lang === 'en' && tr) ? tr(note.content) : note.content
  const isLong = displayContent.length > 120

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {note.type === 'voice' && (
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full flex items-center gap-1">
              <MicIcon size={10} /> {t('voiceBadge')}
            </span>
          )}
          {note.account && (
            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full flex items-center gap-1">
              {note.auto_detected && (
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
              {note.account}
            </span>
          )}
        </div>
        <button onClick={() => onDelete(note.id)} className="text-gray-300 hover:text-red-400 transition-colors p-1">
          <TrashIcon />
        </button>
      </div>

      <p
        className={`text-sm text-gray-800 leading-relaxed ${!expanded && isLong ? 'line-clamp-3' : ''}`}
        onClick={() => isLong && setExpanded(!expanded)}
      >
        {displayContent}
      </p>
      {isLong && (
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-purple-500">
          {expanded ? t('collapse') : t('showMore')}
        </button>
      )}

      <p className="text-xs text-gray-400">{note.date} {note.time}</p>
    </div>
  )
}

function MicIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6M14 11v6"/>
    </svg>
  )
}

import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || ''

const ACCOUNT_LIST = [
  'CJ Olive Young', 'TVING', 'GS Retail', 'Starbucks Korea',
  'Shinsegae Live Shopping', 'Lotte Shopping', 'Lotte Members',
  'LG Uplus', 'Nolbal', 'Golfzon County', 'KT Alpha',
  'SK Telecom', 'Samsung Next', 'SPC', 'Naver', 'Hyundai Motors', 'Hyundai Department',
]

export default function MemoPage() {
  const [notes, setNotes] = useState([])
  const [text, setText] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')
  const recognitionRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    setVoiceSupported('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
    loadNotes()
  }, [])

  async function loadNotes() {
    try {
      const res = await fetch(`${API}/api/intel/notes`)
      const data = await res.json()
      setNotes(data.notes || [])
    } catch (e) {
      console.error(e)
    }
  }

  function startVoice() {
    const SR = window.webkitSpeechRecognition || window.SpeechRecognition
    const recognition = new SR()
    recognitionRef.current = recognition
    recognition.lang = 'ko-KR'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
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
      await fetch(`${API}/api/intel/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text.trim(),
          type: isListening ? 'voice' : 'text',
          account: selectedAccount || null,
          tags: selectedAccount ? [selectedAccount] : [],
        }),
      })
      setText('')
      setSelectedAccount('')
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

  const filtered = filter === 'all'
    ? notes
    : notes.filter(n => n.account === filter)

  const accountsWithNotes = [...new Set(notes.map(n => n.account).filter(Boolean))]

  return (
    <div className="space-y-5 pb-28">
      {/* 입력 영역 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-900">메모 추가</h2>

        {/* 계정 선택 */}
        <select
          value={selectedAccount}
          onChange={e => setSelectedAccount(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-300"
        >
          <option value="">계정 선택 (선택사항)</option>
          {ACCOUNT_LIST.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        {/* 텍스트 입력 */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={isListening ? '🎙️ 듣는 중...' : '미팅 내용, 전략, 메모를 자유롭게 입력하세요'}
            rows={4}
            className={`w-full text-sm border rounded-xl px-3 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 transition-colors ${
              isListening
                ? 'border-red-300 bg-red-50 text-gray-800'
                : 'border-gray-200 bg-gray-50 text-gray-800'
            }`}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveNote()
            }}
          />
          {isListening && (
            <div className="absolute top-2 right-2 flex items-center gap-1">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"/>
              <span className="text-xs text-red-500 font-medium">녹음중</span>
            </div>
          )}
        </div>

        {/* 버튼 */}
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
                <>
                  <span className="w-3 h-3 bg-white rounded-sm"/>
                  중지
                </>
              ) : (
                <>
                  <MicIcon />
                  음성
                </>
              )}
            </button>
          )}
          <button
            onClick={saveNote}
            disabled={!text.trim() || saving}
            className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-purple-700 transition-colors active:scale-95"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>

        {!voiceSupported && (
          <p className="text-xs text-gray-400 text-center">
            음성 인식은 Chrome/Safari에서 지원됩니다
          </p>
        )}
      </div>

      {/* 메모 목록 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">
            메모 <span className="text-gray-400 font-normal">({notes.length})</span>
          </h2>
          {accountsWithNotes.length > 0 && (
            <div className="flex gap-1 overflow-x-auto">
              <button
                onClick={() => setFilter('all')}
                className={`shrink-0 text-xs px-2.5 py-1 rounded-full ${
                  filter === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                전체
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
            <p className="text-sm">메모가 없습니다</p>
            <p className="text-xs mt-1">음성이나 텍스트로 메모를 추가하세요</p>
          </div>
        ) : (
          filtered.map(note => (
            <NoteCard key={note.id} note={note} onDelete={deleteNote} />
          ))
        )}
      </div>
    </div>
  )
}

function NoteCard({ note, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = note.content.length > 120

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {note.type === 'voice' && (
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full flex items-center gap-1">
              <MicIcon size={10} /> 음성
            </span>
          )}
          {note.account && (
            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
              {note.account}
            </span>
          )}
        </div>
        <button
          onClick={() => onDelete(note.id)}
          className="text-gray-300 hover:text-red-400 transition-colors shrink-0 p-1"
        >
          <TrashIcon />
        </button>
      </div>

      <p
        className={`text-sm text-gray-800 leading-relaxed ${!expanded && isLong ? 'line-clamp-3' : ''}`}
        onClick={() => isLong && setExpanded(!expanded)}
      >
        {note.content}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-purple-500"
        >
          {expanded ? '접기' : '더 보기'}
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

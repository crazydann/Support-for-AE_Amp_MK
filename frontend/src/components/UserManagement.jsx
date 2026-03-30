import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || ''

export default function UserManagement({ onClose }) {
  const [users, setUsers] = useState([])
  const [admin, setAdmin] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/auth/users`)
      const d = await r.json()
      setUsers(d.users || [])
      setAdmin(d.admin || '')
    } catch { setError('불러오기 실패') }
    finally { setLoading(false) }
  }

  async function addUser() {
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    if (!email.endsWith('@amplitude.com')) {
      setError('@amplitude.com 이메일만 추가할 수 있습니다')
      return
    }
    setSaving(true); setError('')
    try {
      const r = await fetch(`${API}/api/auth/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.detail || '추가 실패'); return }
      setUsers(d.users)
      setNewEmail('')
    } catch { setError('추가 실패') }
    finally { setSaving(false) }
  }

  async function removeUser(email) {
    setSaving(true); setError('')
    try {
      const r = await fetch(`${API}/api/auth/users/${encodeURIComponent(email)}`, { method: 'DELETE' })
      const d = await r.json()
      if (!r.ok) { setError(d.detail || '삭제 실패'); return }
      setUsers(d.users)
    } catch { setError('삭제 실패') }
    finally { setSaving(false) }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-purple-600 to-indigo-600">
          <div>
            <h2 className="text-base font-bold text-white">접근 권한 관리</h2>
            <p className="text-xs text-purple-200 mt-0.5">@amplitude.com 계정만 추가 가능</p>
          </div>
          <button onClick={onClose} className="text-purple-300 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* 관리자 */}
          <div className="bg-purple-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
            <span className="text-base">👑</span>
            <div>
              <p className="text-xs text-purple-400 leading-none">관리자</p>
              <p className="text-xs font-semibold text-purple-800 mt-0.5">{admin || '미설정'}</p>
            </div>
          </div>

          {/* 오류 */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-xs text-red-600">{error}</div>
          )}

          {/* 사용자 추가 */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">사용자 추가</p>
            <div className="flex gap-2">
              <input
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addUser()}
                placeholder="email@amplitude.com"
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-purple-400"
              />
              <button
                onClick={addUser}
                disabled={saving || !newEmail}
                className="text-xs font-semibold px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-colors"
              >
                추가
              </button>
            </div>
          </div>

          {/* 사용자 목록 */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">
              허용된 사용자 ({loading ? '…' : users.length}명)
            </p>
            {loading ? (
              <div className="text-xs text-gray-400 text-center py-4">불러오는 중...</div>
            ) : users.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-xl">
                추가된 사용자 없음
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {users.map(email => (
                  <div key={email} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                    <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs text-indigo-600 font-semibold">{email[0].toUpperCase()}</span>
                    </div>
                    <span className="text-xs text-gray-700 flex-1 truncate">{email}</span>
                    <button
                      onClick={() => removeUser(email)}
                      disabled={saving}
                      className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-4">
          <p className="text-xs text-gray-400 text-center">
            추가된 사용자는 Google 계정으로 로그인 후 접근 가능합니다
          </p>
        </div>
      </div>
    </div>
  )
}

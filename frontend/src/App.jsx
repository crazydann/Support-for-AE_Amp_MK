import { useState, useEffect } from 'react'
import { useLang } from './contexts/LanguageContext'
import DashboardPage from './pages/DashboardPage'
import SearchPage from './pages/SearchPage'
import BlueprintPage from './pages/BlueprintPage'
import MemoPage from './pages/MemoPage'
import LoginPage from './pages/LoginPage'
import AccountSearch from './components/AccountSearch'
import UserManagement from './components/UserManagement'

const API = import.meta.env.VITE_API_URL || ''

export default function App() {
  const { lang, setLang, t } = useLang()
  const [tab, setTab] = useState('dashboard')
  const [currentCompany, setCurrentCompany] = useState(null)
  const [dashView, setDashView] = useState('weekly')

  // Todo PIN 잠금
  const [todoUnlocked, setTodoUnlocked] = useState(() => sessionStorage.getItem('mk_todo_unlocked') === '1')
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)

  function handleTodoClick() {
    if (todoUnlocked) {
      setDashView('todo')
    } else {
      setShowPinModal(true)
      setPinInput('')
      setPinError(false)
    }
  }

  function handlePinKey(digit) {
    if (pinInput.length >= 4) return
    const next = pinInput + digit
    setPinInput(next)
    setPinError(false)
    if (next.length === 4) {
      const pin = localStorage.getItem('mk_todo_pin') || '0000'
      if (next === pin) {
        setTodoUnlocked(true)
        sessionStorage.setItem('mk_todo_unlocked', '1')
        setShowPinModal(false)
        setDashView('todo')
      } else {
        setPinError(true)
        setTimeout(() => setPinInput(''), 500)
      }
    }
  }

  // 인증 상태
  const [authState, setAuthState] = useState('loading') // loading | authenticated | unauthenticated
  const [currentUser, setCurrentUser] = useState(null)
  const [showUserMgmt, setShowUserMgmt] = useState(false)

  // URL에서 auth_error 파라미터 확인 후 즉시 제거
  const params = new URLSearchParams(window.location.search)
  const authError = params.get('auth_error')
  useEffect(() => {
    if (authError) {
      params.delete('auth_error')
      const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '')
      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  useEffect(() => {
    fetch(`${API}/api/auth/me`)
      .then(r => {
        if (r.status === 401) { setAuthState('unauthenticated'); return null }
        return r.json()
      })
      .then(d => {
        if (d) { setCurrentUser(d); setAuthState('authenticated') }
      })
      .catch(() => {
        // Google OAuth 미설정 시 → 인증 없이 허용
        setAuthState('authenticated')
      })
  }, [])

  async function handleLogout() {
    await fetch(`${API}/api/auth/logout`, { method: 'POST' })
    setCurrentUser(null)
    setAuthState('unauthenticated')
  }

  const TABS = [
    { id: 'dashboard', label: t('tabHome'),      icon: HomeIcon },
    { id: 'companies', label: t('tabCompanies'), icon: BuildingIcon },
    { id: 'memo',      label: t('tabMemo'),      icon: PencilIcon },
  ]

  function handleSelectCompany(name) {
    setCurrentCompany(name)
    setTab('companies')
  }

  const renderContent = () => {
    if (tab === 'dashboard') return <DashboardPage onSelectCompany={handleSelectCompany} dashView={dashView} />
    if (tab === 'companies') {
      return currentCompany
        ? <BlueprintPage companyName={currentCompany} onBack={() => setCurrentCompany(null)} />
        : <SearchPage onSelectCompany={handleSelectCompany} />
    }
    if (tab === 'memo') return <MemoPage />
    return null
  }

  // 로딩 중
  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // 미인증
  if (authState === 'unauthenticated') {
    return <LoginPage error={authError} />
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 사용자 관리 모달 */}
      {showUserMgmt && <UserManagement onClose={() => setShowUserMgmt(false)} />}

      {/* Todo PIN 모달 */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl">
            <p className="text-sm font-bold text-gray-800 text-center mb-1">🔒 Private View</p>
            <p className="text-xs text-gray-400 text-center mb-5">Enter PIN to access</p>
            {/* PIN dots */}
            <div className="flex justify-center gap-3 mb-5">
              {[0,1,2,3].map(i => (
                <div key={i} className={`w-3 h-3 rounded-full border-2 transition-all ${
                  i < pinInput.length
                    ? (pinError ? 'bg-red-400 border-red-400' : 'bg-purple-600 border-purple-600')
                    : 'border-gray-300'
                }`} />
              ))}
            </div>
            {pinError && <p className="text-xs text-red-500 text-center mb-3">Incorrect PIN</p>}
            {/* 숫자 키패드 */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
                <button
                  key={i}
                  onClick={() => k === '⌫' ? setPinInput(p => p.slice(0,-1)) : k !== '' && handlePinKey(k)}
                  disabled={k === ''}
                  className={`h-12 rounded-xl text-sm font-semibold transition-colors ${
                    k === '' ? '' :
                    k === '⌫' ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' :
                    'bg-gray-50 text-gray-800 hover:bg-purple-50 hover:text-purple-700 active:bg-purple-100'
                  }`}
                >{k}</button>
              ))}
            </div>
            <button
              onClick={() => { setShowPinModal(false); setPinInput('') }}
              className="w-full text-xs text-gray-400 py-2 hover:text-gray-600"
            >Cancel</button>
          </div>
        </div>
      )}

      {/* 상단 헤더 */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto flex items-center gap-2">
          {/* 왼쪽: 언어 토글 + 로고 */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setLang('ko')}
                className={`text-xs font-semibold px-2 py-1 rounded-md transition-all ${
                  lang === 'ko' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >KO</button>
              <button
                onClick={() => setLang('en')}
                className={`text-xs font-semibold px-2 py-1 rounded-md transition-all ${
                  lang === 'en' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >EN</button>
            </div>

            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => { setTab('dashboard'); setCurrentCompany(null) }}
            >
              <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center">
                {currentUser?.picture
                  ? <img src={currentUser.picture} className="w-7 h-7 rounded-lg object-cover" alt="" />
                  : <span className="text-white font-bold text-xs">A</span>
                }
              </div>
              <h1 className="text-sm font-bold text-gray-900 leading-none truncate max-w-[80px]">{t('appName')}</h1>
            </div>
          </div>

          {/* PC 전용: 탭 네비게이션 */}
          <div className="hidden lg:flex items-center gap-1 ml-4 shrink-0">
            {TABS.map(({ id, label }) => (
              <button key={id}
                onClick={() => { setTab(id); if (id !== 'companies') setCurrentCompany(null) }}
                className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-all ${
                  tab === id ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >{label}</button>
            ))}
          </div>

          {/* 가운데: 계정 검색 */}
          <div className="flex-1 min-w-0">
            {tab === 'dashboard' && <AccountSearch />}
          </div>

          {/* 오른쪽: 뷰 토글 + 유저 메뉴 */}
          <div className="flex items-center gap-1 shrink-0 ml-auto lg:ml-0">
            {tab === 'dashboard' && (
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setDashView('weekly')}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
                    dashView === 'weekly' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >{t('viewWeekly')}</button>
                <button
                  onClick={() => setDashView('account')}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
                    dashView === 'account' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >{t('viewAccount')}</button>
                <button
                  onClick={handleTodoClick}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                    dashView === 'todo' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {!todoUnlocked && <span className="text-xs">🔒</span>}
                  {t('viewTodo')}
                </button>
              </div>
            )}
            {tab === 'companies' && currentCompany && (
              <button
                onClick={() => setCurrentCompany(null)}
                className="text-sm text-gray-500 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100"
              >{t('backToList')}</button>
            )}

            {/* 유저 메뉴 (인증된 경우) */}
            {currentUser && (
              <UserMenu
                user={currentUser}
                onManageUsers={() => setShowUserMgmt(true)}
                onLogout={handleLogout}
              />
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 lg:px-8 pt-5 pb-24 lg:pb-8">
        {renderContent()}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10 lg:hidden">
        <div className="max-w-screen-2xl mx-auto grid grid-cols-3">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setTab(id); if (id !== 'companies') setCurrentCompany(null) }}
              className={`flex flex-col items-center justify-center py-2.5 gap-1 transition-colors ${
                tab === id ? 'text-purple-600' : 'text-gray-400'
              }`}
            >
              <Icon active={tab === id} />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

// ── 유저 드롭다운 메뉴 ────────────────────────────────────────────────────────
function UserMenu({ user, onManageUsers, onLogout }) {
  const [open, setOpen] = useState(false)
  const { lang } = useLang()
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-7 h-7 rounded-full overflow-hidden border-2 border-gray-200 hover:border-purple-400 transition-colors"
      >
        {user.picture
          ? <img src={user.picture} className="w-full h-full object-cover" alt="" />
          : <div className="w-full h-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-600">
              {user.name?.[0] || user.email?.[0] || 'U'}
            </div>
        }
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 bg-white rounded-xl shadow-lg border border-gray-100 w-52 z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-800 truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
            {user.is_admin && (
              <button
                onClick={() => { setOpen(false); onManageUsers() }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span>👥</span> {lang === 'en' ? 'Manage Access' : '접근 권한 관리'}
              </button>
            )}
            <button
              onClick={() => { setOpen(false); onLogout() }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-red-500 hover:bg-red-50 transition-colors border-t border-gray-50"
            >
              <span>🚪</span> {lang === 'en' ? 'Log out' : '로그아웃'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function HomeIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function BuildingIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2"/>
      <path d="M8 3v18M16 3v18M2 9h20M2 15h20"/>
    </svg>
  )
}

function PencilIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  )
}

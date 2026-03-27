import { useState } from 'react'
import DashboardPage from './pages/DashboardPage'
import SearchPage from './pages/SearchPage'
import BlueprintPage from './pages/BlueprintPage'
import MemoPage from './pages/MemoPage'

const TABS = [
  { id: 'dashboard', label: '홈', icon: HomeIcon },
  { id: 'companies', label: '기업', icon: BuildingIcon },
  { id: 'memo',      label: '메모', icon: PencilIcon },
]

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [currentCompany, setCurrentCompany] = useState(null)

  function handleSelectCompany(name) {
    setCurrentCompany(name)
    setTab('companies')
  }

  function handleBack() {
    setCurrentCompany(null)
  }

  const renderContent = () => {
    if (tab === 'dashboard') return <DashboardPage onSelectCompany={handleSelectCompany} />
    if (tab === 'companies') {
      return currentCompany
        ? <BlueprintPage companyName={currentCompany} onBack={handleBack} />
        : <SearchPage onSelectCompany={handleSelectCompany} />
    }
    if (tab === 'memo') return <MemoPage />
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 상단 헤더 */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => { setTab('dashboard'); setCurrentCompany(null) }}
          >
            <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">A</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 leading-none">AE Intelligence</h1>
              <p className="text-xs text-gray-400 leading-none mt-0.5">Korea Accounts</p>
            </div>
          </div>

          {tab === 'companies' && currentCompany && (
            <button
              onClick={handleBack}
              className="text-sm text-gray-500 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100"
            >
              ← 목록
            </button>
          )}
        </div>
      </header>

      {/* 콘텐츠 */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-5">
        {renderContent()}
      </main>

      {/* 하단 탭 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
        <div className="max-w-lg mx-auto grid grid-cols-3">
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

// 아이콘
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

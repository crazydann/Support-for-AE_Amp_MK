import { useState } from 'react'
import SearchPage from './pages/SearchPage'
import BlueprintPage from './pages/BlueprintPage'

export default function App() {
  const [currentCompany, setCurrentCompany] = useState(null)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentCompany(null)}>
            <div className="w-8 h-8 bg-amplitude-purple rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">AE Intelligence</h1>
              <p className="text-xs text-gray-500">Powered by Amplitude</p>
            </div>
          </div>
          {currentCompany && (
            <button
              onClick={() => setCurrentCompany(null)}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              ← 다른 기업 검색
            </button>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {currentCompany ? (
          <BlueprintPage companyName={currentCompany} />
        ) : (
          <SearchPage onSelectCompany={setCurrentCompany} />
        )}
      </main>
    </div>
  )
}

import { User, Linkedin } from 'lucide-react'

export default function ExecutivesPanel({ executives = [] }) {
  if (!executives.length) {
    return <EmptyState message="임원 정보를 찾을 수 없습니다." />
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">총 {executives.length}명의 임원 정보 (DART 공시 기준)</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {executives.map((exec, i) => (
          <div key={i} className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl hover:border-gray-200 hover:bg-gray-50 transition-colors">
            <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
              <User size={16} className="text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate">{exec.name}</p>
              <p className="text-xs text-gray-500 truncate">{exec.title}</p>
            </div>
            {exec.linkedin_url && (
              <a href={exec.linkedin_url} target="_blank" rel="noopener noreferrer">
                <Linkedin size={14} className="text-blue-500" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <User size={32} className="mx-auto mb-2 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

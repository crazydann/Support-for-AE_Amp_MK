import { Building2, ExternalLink } from 'lucide-react'

export default function SubsidiariesPanel({ subsidiaries = [] }) {
  if (!subsidiaries.length) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Building2 size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">계열사/자회사 정보를 찾을 수 없습니다.</p>
      </div>
    )
  }

  const grouped = subsidiaries.reduce((acc, sub) => {
    const key = sub.relation || '계열사'
    if (!acc[key]) acc[key] = []
    acc[key].push(sub)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">총 {subsidiaries.length}개 계열사/자회사 (DART 공시 기준)</p>
      {Object.entries(grouped).map(([relation, items]) => (
        <div key={relation}>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            {relation} ({items.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {items.map((sub, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:border-amplitude-purple/30 hover:bg-amplitude-light/30 transition-colors cursor-default"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-gray-500">
                    {sub.name.slice(0, 1)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{sub.name}</p>
                  {sub.business_type && (
                    <p className="text-xs text-gray-400 truncate">{sub.business_type}</p>
                  )}
                </div>
                {sub.website && (
                  <a
                    href={sub.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-300 hover:text-amplitude-purple"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

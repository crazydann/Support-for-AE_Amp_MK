import { Building2, Globe, MapPin, Users, ExternalLink } from 'lucide-react'

export default function CompanyHeader({ blueprint }) {
  const initials = blueprint.company_name.slice(0, 2)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start gap-5">
        {/* Logo Placeholder */}
        <div className="w-16 h-16 bg-gradient-to-br from-amplitude-purple to-blue-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-white font-bold text-xl">{initials}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{blueprint.company_name}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                {blueprint.industry && (
                  <span className="text-sm text-gray-500">{blueprint.industry}</span>
                )}
                {blueprint.stock_code && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-medium">
                    상장사 · {blueprint.stock_code}
                  </span>
                )}
                {blueprint.business_type && (
                  <span className="text-xs bg-purple-50 text-amplitude-purple px-2 py-0.5 rounded font-medium">
                    {blueprint.business_type}
                  </span>
                )}
              </div>
            </div>

            {blueprint.website && (
              <a
                href={blueprint.website.startsWith('http') ? blueprint.website : `https://${blueprint.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-amplitude-purple hover:underline flex-shrink-0"
              >
                <Globe size={14} />
                공식 홈페이지
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          {/* Meta Info */}
          <div className="flex flex-wrap gap-4 mt-3">
            {blueprint.ceo && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Users size={14} className="text-gray-400" />
                <span>대표이사: <strong>{blueprint.ceo}</strong></span>
              </div>
            )}
            {blueprint.employees && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Users size={14} className="text-gray-400" />
                <span>임직원: <strong>{blueprint.employees}명</strong></span>
              </div>
            )}
            {blueprint.address && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <MapPin size={14} className="text-gray-400" />
                <span className="truncate max-w-xs">{blueprint.address}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="flex gap-6 mt-5 pt-5 border-t border-gray-100">
        <Stat label="계열사" value={blueprint.subsidiaries?.length || 0} unit="개" />
        <Stat label="임원진" value={blueprint.executives?.length || 0} unit="명" />
        <Stat label="웹 서비스" value={blueprint.web_services?.length || 0} unit="개" />
        <Stat label="앱 서비스" value={blueprint.apps?.length || 0} unit="개" />
        <Stat label="최근 뉴스" value={blueprint.recent_news?.length || 0} unit="건" />
      </div>
    </div>
  )
}

function Stat({ label, value, unit }) {
  return (
    <div className="text-center">
      <p className="text-xl font-bold text-gray-900">
        {value}<span className="text-sm font-normal text-gray-400 ml-0.5">{unit}</span>
      </p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

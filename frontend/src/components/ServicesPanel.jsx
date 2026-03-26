import { Globe, Smartphone, ExternalLink, Star } from 'lucide-react'

export default function ServicesPanel({ services = [], apps = [] }) {
  const hasServices = services.length > 0
  const hasApps = apps.length > 0

  if (!hasServices && !hasApps) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Globe size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">서비스 정보를 찾을 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Web Services */}
      {hasServices && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4">
            <Globe size={16} className="text-amplitude-purple" />
            웹 서비스 ({services.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {services.map((svc, i) => (
              <a
                key={i}
                href={svc.url?.startsWith('http') ? svc.url : svc.url ? `https://${svc.url}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 border border-gray-100 rounded-xl hover:border-amplitude-purple/50 hover:bg-amplitude-light/30 transition-colors group"
              >
                <div className="w-8 h-8 bg-amplitude-light rounded-lg flex items-center justify-center flex-shrink-0">
                  <Globe size={14} className="text-amplitude-purple" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{svc.name}</p>
                  {svc.description && (
                    <p className="text-xs text-gray-400 truncate">{svc.description}</p>
                  )}
                </div>
                <ExternalLink size={12} className="text-gray-300 group-hover:text-amplitude-purple flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Apps */}
      {hasApps && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4">
            <Smartphone size={16} className="text-amplitude-purple" />
            앱 서비스 ({apps.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {apps.map((app, i) => (
              <a
                key={i}
                href={app.store_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 border border-gray-100 rounded-xl hover:border-amplitude-purple/50 hover:bg-amplitude-light/30 transition-colors"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Smartphone size={20} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{app.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded font-medium">
                      {app.platform}
                    </span>
                    {app.category && (
                      <span className="text-xs text-gray-400">{app.category}</span>
                    )}
                    {app.rating && (
                      <span className="text-xs text-amber-500 flex items-center gap-0.5">
                        <Star size={10} fill="currentColor" />
                        {app.rating}
                      </span>
                    )}
                  </div>
                  {app.downloads && (
                    <p className="text-xs text-gray-400 mt-0.5">다운로드: {app.downloads}</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

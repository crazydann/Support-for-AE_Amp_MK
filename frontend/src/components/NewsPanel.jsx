import { Newspaper, ExternalLink, Calendar } from 'lucide-react'

export default function NewsPanel({ news = [] }) {
  if (!news.length) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Newspaper size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">최신 뉴스를 찾을 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {news.map((item, i) => (
        <a
          key={i}
          href={item.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex gap-4 p-4 border border-gray-100 rounded-xl hover:border-gray-200 hover:bg-gray-50 transition-colors group"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 group-hover:text-amplitude-purple transition-colors line-clamp-2">
              {item.title}
            </p>
            {item.summary && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.summary}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              {item.source && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {item.source}
                </span>
              )}
              {item.date && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar size={10} />
                  {item.date}
                </span>
              )}
            </div>
          </div>
          <ExternalLink size={14} className="text-gray-300 group-hover:text-amplitude-purple flex-shrink-0 mt-1" />
        </a>
      ))}
    </div>
  )
}

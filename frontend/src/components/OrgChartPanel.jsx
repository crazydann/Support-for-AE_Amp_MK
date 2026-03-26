import { useState } from 'react'
import { Globe, Smartphone, ChevronDown, ChevronRight, Users } from 'lucide-react'

// Amplitude 상태별 스타일
const AMP_STYLE = {
  active:   { border: 'border-purple-400', bg: 'bg-purple-50',  badge: 'bg-purple-600 text-white',   label: 'Amplitude 고객', dot: 'bg-purple-500' },
  not_used: { border: 'border-gray-300',   bg: 'bg-gray-50',    badge: 'bg-gray-400 text-white',     label: '미도입',         dot: 'bg-gray-400'   },
  unknown:  { border: 'border-amber-300',  bg: 'bg-amber-50',   badge: 'bg-amber-400 text-white',    label: '확인 필요',      dot: 'bg-amber-400'  },
}

function ServiceChip({ service }) {
  const isApp = service.type.startsWith('app')
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600 whitespace-nowrap">
      {isApp ? <Smartphone size={10} className="text-blue-400" /> : <Globe size={10} className="text-green-500" />}
      {service.name}
      {service.mau && <span className="text-gray-400">·{service.mau}</span>}
    </span>
  )
}

function OrgNode({ node, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 1)
  const hasChildren = node.children && node.children.length > 0
  const style = AMP_STYLE[node.amplitude_status] || AMP_STYLE.unknown

  return (
    <div className="flex flex-col items-center">
      {/* 카드 */}
      <div className={`relative border-2 ${style.border} ${style.bg} rounded-xl p-3 w-64 shadow-sm hover:shadow-md transition-shadow`}>
        {/* Amplitude 상태 뱃지 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${style.dot}`} />
            <span className="text-sm font-semibold text-gray-800 truncate max-w-[120px]">{node.name}</span>
          </div>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${style.badge}`}>
            {style.label}
          </span>
        </div>

        {/* 관계 + MAU */}
        <div className="flex items-center gap-2 mb-2">
          {node.relation && (
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{node.relation}</span>
          )}
          {node.mau && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Users size={10} />
              MAU {node.mau}
            </span>
          )}
        </div>

        {/* 서비스 목록 */}
        {node.services && node.services.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {node.services.slice(0, 3).map((s, i) => (
              <ServiceChip key={i} service={s} />
            ))}
            {node.services.length > 3 && (
              <span className="text-xs text-gray-400">+{node.services.length - 3}</span>
            )}
          </div>
        )}

        {/* Amplitude 메모 */}
        {node.amplitude_note && (
          <p className="text-xs text-gray-500 leading-relaxed border-t border-gray-200 pt-1.5 mt-1">
            {node.amplitude_note}
          </p>
        )}

        {/* Amplitude 플랜 */}
        {node.amplitude_plan && (
          <span className="mt-1 inline-block text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">
            {node.amplitude_plan} Plan
          </span>
        )}

        {/* 자식 노드 토글 */}
        {hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center shadow-sm hover:border-amplitude-purple hover:text-amplitude-purple transition-colors z-10"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        )}
      </div>

      {/* 자식 노드 연결선 + 자식들 */}
      {hasChildren && expanded && (
        <div className="flex flex-col items-center mt-6 w-full">
          {/* 수직선 */}
          <div className="w-px h-4 bg-gray-300" />

          {/* 자식 노드들 */}
          <div className="flex gap-4 items-start relative">
            {/* 수평 연결선 */}
            {node.children.length > 1 && (
              <div
                className="absolute top-0 h-px bg-gray-300"
                style={{
                  left: '50%',
                  right: '50%',
                  width: `calc(100% - 128px)`,
                  transform: 'translateX(-50%)',
                }}
              />
            )}
            {node.children.map((child, i) => (
              <div key={i} className="flex flex-col items-center">
                {/* 수직선 (자식으로 내려가는) */}
                <div className="w-px h-4 bg-gray-300" />
                <OrgNode node={child} depth={depth + 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function OrgChartPanel({ orgChart = [], companyName }) {
  if (!orgChart || orgChart.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-sm">조직도 데이터가 없습니다.</p>
      </div>
    )
  }

  // Amplitude 현황 요약
  const allNodes = flattenNodes(orgChart)
  const summary = {
    active:   allNodes.filter(n => n.amplitude_status === 'active').length,
    not_used: allNodes.filter(n => n.amplitude_status === 'not_used').length,
    unknown:  allNodes.filter(n => n.amplitude_status === 'unknown').length,
  }

  return (
    <div>
      {/* 요약 바 */}
      <div className="flex gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
        <div className="text-sm font-medium text-gray-500">그룹 Amplitude 현황</div>
        <div className="flex gap-3 ml-auto">
          <span className="flex items-center gap-1.5 text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span className="font-semibold text-purple-700">{summary.active}</span>
            <span className="text-gray-500">도입 완료</span>
          </span>
          <span className="flex items-center gap-1.5 text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
            <span className="font-semibold text-gray-600">{summary.not_used}</span>
            <span className="text-gray-500">미도입</span>
          </span>
          <span className="flex items-center gap-1.5 text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="font-semibold text-amber-600">{summary.unknown}</span>
            <span className="text-gray-500">확인 필요</span>
          </span>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex gap-4 mb-6 text-xs text-gray-400 flex-wrap">
        {Object.entries(AMP_STYLE).map(([key, s]) => (
          <span key={key} className={`flex items-center gap-1.5 px-2 py-1 border ${s.border} ${s.bg} rounded-lg`}>
            <span className={`w-2 h-2 rounded-full ${s.dot}`} />
            {s.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 ml-auto">
          <Globe size={10} className="text-green-500" /> 웹
          <Smartphone size={10} className="text-blue-400 ml-2" /> 앱
        </span>
      </div>

      {/* 조직도 */}
      <div className="overflow-x-auto pb-8">
        <div className="flex justify-center min-w-max px-8">
          <div className="flex gap-8">
            {orgChart.map((rootNode, i) => (
              <OrgNode key={i} node={rootNode} depth={0} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function flattenNodes(nodes) {
  const result = []
  function traverse(node) {
    result.push(node)
    if (node.children) node.children.forEach(traverse)
  }
  nodes.forEach(traverse)
  return result
}

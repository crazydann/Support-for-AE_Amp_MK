import { Loader } from 'lucide-react'

const STEPS = [
  { label: 'DART 공시 데이터 수집 중...', duration: 3 },
  { label: '임원진 정보 조회 중...', duration: 3 },
  { label: '계열사 현황 확인 중...', duration: 3 },
  { label: '공식 홈페이지 분석 중...', duration: 4 },
  { label: '최신 뉴스 수집 중...', duration: 3 },
  { label: 'AI 전략 분석 중...', duration: 5 },
]

export default function LoadingBlueprint({ companyName }) {
  return (
    <div className="flex flex-col items-center pt-20">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-amplitude-purple to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
          <span className="text-white font-bold text-2xl">{companyName.slice(0, 1)}</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">
          {companyName} 청사진 생성 중
        </h3>
        <p className="text-sm text-gray-500 mb-8">
          온라인의 모든 공개 데이터를 수집하고 있습니다
        </p>

        <div className="space-y-3 text-left">
          {STEPS.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                <Loader size={14} className="text-amplitude-purple animate-spin" style={{ animationDelay: `${i * 0.2}s` }} />
              </div>
              <p className="text-sm text-gray-600">{step.label}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-8">
          처음 조회 시 30-60초 소요될 수 있습니다
        </p>
      </div>
    </div>
  )
}

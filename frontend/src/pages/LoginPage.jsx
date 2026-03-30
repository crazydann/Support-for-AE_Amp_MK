import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || ''

// iOS 홈화면 추가(standalone) 모드 감지
const isIosStandalone = () =>
  typeof window !== 'undefined' &&
  window.navigator.standalone === true

export default function LoginPage({ error, onAuthSuccess }) {
  const [checking, setChecking] = useState(false)
  const isStandalone = isIosStandalone()

  const errMsg = {
    domain: '@amplitude.com 계정으로 다시 로그인해 주세요.',
    not_allowed: '접근 권한이 없습니다. 관리자에게 문의하세요.',
  }[error]

  // 로그인 완료 후 돌아왔을 때 인증 상태 재확인
  async function checkAuth() {
    setChecking(true)
    try {
      const r = await fetch(`${API}/api/auth/me`)
      if (r.ok) {
        // 인증 성공 → 앱 새로고침
        window.location.replace('/')
      } else {
        alert('아직 로그인이 완료되지 않았습니다. Safari에서 Google 로그인을 완료해 주세요.')
      }
    } catch {
      alert('서버에 연결할 수 없습니다.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">

        {/* 로고 */}
        <div className="w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-bold text-2xl">A</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">AE Intel · MK</h1>
        <p className="text-sm text-gray-400 mb-6">Amplitude Account Intelligence</p>

        {/* 오류 메시지 */}
        {errMsg && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4 text-xs text-red-600">
            {errMsg}
          </div>
        )}

        {/* iOS 홈 추가 모드 안내 */}
        {isStandalone && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5 text-left">
            <p className="text-xs font-semibold text-blue-700 mb-1">📱 홈 화면 앱 로그인 방법</p>
            <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
              <li>아래 버튼을 탭 → Safari에서 Google 로그인</li>
              <li><strong>@amplitude.com</strong> 계정 선택</li>
              <li>로그인 완료 후 이 앱으로 돌아오기</li>
              <li>아래 <strong>"로그인 완료"</strong> 버튼 탭</li>
            </ol>
          </div>
        )}

        {/* Google 로그인 버튼 */}
        <a
          href="/api/auth/login"
          target={isStandalone ? '_blank' : '_self'}
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm mb-3"
        >
          <GoogleIcon />
          Google 계정으로 로그인
        </a>

        {/* iOS standalone 전용: 로그인 완료 확인 버튼 */}
        {isStandalone && (
          <button
            onClick={checkAuth}
            disabled={checking}
            className="w-full bg-purple-600 text-white rounded-xl px-4 py-3 text-sm font-medium hover:bg-purple-700 transition-all disabled:opacity-50"
          >
            {checking ? '확인 중...' : '✓ 로그인 완료 — 앱 열기'}
          </button>
        )}

        <p className="text-xs text-gray-300 mt-5">@amplitude.com 계정만 접근 가능합니다</p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.347 2.825.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}

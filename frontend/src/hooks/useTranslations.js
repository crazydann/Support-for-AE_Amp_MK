/**
 * useTranslations — 한국어 텍스트를 영어로 자동 번역하는 훅
 *
 * 사용법:
 *   const { tr } = useTranslations(lang)
 *   <p>{tr(koreanText)}</p>
 *
 * - lang !== 'en' 이면 원문 그대로 반환
 * - 한국어 문자가 없으면 그대로 반환
 * - 모듈 레벨 캐시(globalCache) + sessionStorage 캐시로 재요청 방지
 * - 150ms 디바운스로 배치 처리
 */

import { useState, useEffect, useRef, useCallback } from 'react'

const API = import.meta.env.VITE_API_URL || ''

// 모듈 레벨 캐시 (페이지 새로고침 전까지 유지)
const globalCache = (() => {
  try {
    const stored = sessionStorage.getItem('_tr_cache')
    return stored ? JSON.parse(stored) : {}
  } catch { return {} }
})()

function saveGlobalCache() {
  try {
    sessionStorage.setItem('_tr_cache', JSON.stringify(globalCache))
  } catch {}
}

function hasKorean(text) {
  return text && /[\uAC00-\uD7A3]/.test(text)
}

// pending 배치 (전역으로 디바운스 공유)
let pendingTexts = new Set()
let debounceTimer = null
const subscribers = new Set()

async function flushBatch() {
  if (pendingTexts.size === 0) return
  const batch = [...pendingTexts]
  pendingTexts = new Set()

  try {
    const res = await fetch(`${API}/api/intel/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: batch }),
    })
    const data = await res.json()
    const translations = data.translations || {}
    Object.assign(globalCache, translations)
    saveGlobalCache()
    // 구독자들에게 캐시 업데이트 알림
    subscribers.forEach(cb => cb(translations))
  } catch {}
}

function requestTranslation(text) {
  if (!text || !hasKorean(text) || globalCache[text]) return
  pendingTexts.add(text)
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(flushBatch, 150)
}

export function useTranslations(lang) {
  const [, forceUpdate] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const cb = () => { if (mountedRef.current) forceUpdate(n => n + 1) }
    subscribers.add(cb)
    return () => {
      mountedRef.current = false
      subscribers.delete(cb)
    }
  }, [])

  // lang 변경 시 pending 강제 flush
  useEffect(() => {
    if (lang === 'en' && pendingTexts.size > 0) flushBatch()
  }, [lang])

  const tr = useCallback((text) => {
    if (!text || lang !== 'en') return text
    if (!hasKorean(text)) return text
    if (globalCache[text]) return globalCache[text]
    requestTranslation(text)
    return text  // 번역 도착 전엔 원문 표시
  }, [lang])

  // 여러 텍스트를 미리 등록해두는 함수 (렌더링 전 prefetch용)
  const prefetch = useCallback((texts) => {
    if (lang !== 'en') return
    texts.forEach(t => t && hasKorean(t) && !globalCache[t] && requestTranslation(t))
  }, [lang])

  return { tr, prefetch }
}

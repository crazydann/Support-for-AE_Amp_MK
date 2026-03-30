/**
 * useTranslations — 한국어 텍스트를 영어로 자동 번역하는 훅
 *
 * 브라우저에서 직접 Google Translate 비공식 API 호출 (백엔드 불필요).
 * - 150ms 디바운스로 배치 처리 (Promise.allSettled 병렬)
 * - 모듈 레벨 globalCache + sessionStorage 캐시
 */

import { useState, useEffect, useRef, useCallback } from 'react'

// 모듈 레벨 캐시
const globalCache = (() => {
  try {
    const s = sessionStorage.getItem('_tr_cache_v2')
    return s ? JSON.parse(s) : {}
  } catch { return {} }
})()

function saveCache() {
  try { sessionStorage.setItem('_tr_cache_v2', JSON.stringify(globalCache)) } catch {}
}

function hasKorean(text) {
  return text && /[\uAC00-\uD7A3]/.test(text)
}

async function googleTranslateOne(text) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t&q=${encodeURIComponent(text.slice(0, 500))}`
    const res = await fetch(url)
    const data = await res.json()
    return data[0].map(seg => seg[0] || '').join('').trim() || text
  } catch {
    return text
  }
}

// 전역 pending + 구독자
let pendingTexts = new Set()
let debounceTimer = null
const subscribers = new Set()

async function flushBatch() {
  if (!pendingTexts.size) return
  const batch = [...pendingTexts]
  pendingTexts = new Set()

  const results = await Promise.allSettled(batch.map(t => googleTranslateOne(t)))
  let changed = false
  results.forEach((r, i) => {
    const translated = r.status === 'fulfilled' ? r.value : batch[i]
    if (translated && translated !== batch[i]) {
      globalCache[batch[i]] = translated
      changed = true
    }
  })
  if (changed) {
    saveCache()
    subscribers.forEach(cb => cb())
  }
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
    return () => { mountedRef.current = false; subscribers.delete(cb) }
  }, [])

  useEffect(() => {
    if (lang === 'en' && pendingTexts.size > 0) flushBatch()
  }, [lang])

  /** 단일 텍스트 번역 (캐시 히트 즉시 반환, 없으면 요청 후 원문) */
  const tr = useCallback((text) => {
    if (!text || lang !== 'en') return text
    if (!hasKorean(text)) return text
    if (globalCache[text]) return globalCache[text]
    requestTranslation(text)
    return text
  }, [lang])

  /** 여러 텍스트 미리 요청 (prefetch) */
  const prefetch = useCallback((texts) => {
    if (lang !== 'en') return
    texts.forEach(t => { if (t && hasKorean(t) && !globalCache[t]) requestTranslation(t) })
  }, [lang])

  return { tr, prefetch }
}

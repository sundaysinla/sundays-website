'use client'

import { useEffect } from 'react'

// URLs must match the ones GLTFLoader / RGBELoader will eventually call in
// components/Logo3D.tsx — THREE.Cache is keyed by exact URL string.
const ASSETS = [
  '/sundays_metallic_logo_only.min.gltf',
  '/environment/modern_bathroom_1k.hdr',
] as const

/**
 * Runs right after hydration and pre-fills THREE.Cache with the raw bytes of
 * the homepage's 3D logo assets while the loading screen is visible.
 */
export default function AssetPreloader() {
  useEffect(() => {
    let cancelled = false

    void (async () => {
      const { Cache } = await import('three')
      Cache.enabled = true

      await Promise.all(
        ASSETS.map(async (url) => {
          if (cancelled || Cache.get(url)) return
          try {
            const res = await fetch(url, { credentials: 'same-origin' })
            if (!res.ok || cancelled) return
            const buf = await res.arrayBuffer()
            if (cancelled) return
            Cache.add(url, buf)
          } catch {
            // Network blip — Logo3D will fall back to its own fetch.
          }
        })
      )
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <link rel="preconnect" href="https://www.gstatic.com" crossOrigin="anonymous" />
      {ASSETS.map(url => <link key={url} rel="preload" href={url} as="fetch" crossOrigin="anonymous" />)}
    </>
  )
}

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
 * the 3D logo assets. The HTML <link rel="preload"> tags in app/layout.tsx
 * have already kicked the bytes into the browser's HTTP cache, so this fetch()
 * resolves almost instantly. Putting the ArrayBuffer into THREE.Cache means
 * when Logo3D's GLTFLoader / RGBELoader run later (after their dynamic chunk
 * mounts), they short-circuit cache.get(url) and skip any fetch entirely —
 * killing the "preloaded but not used" double-fetch warning and shaving off
 * the network round-trip Three.js would otherwise re-issue.
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

  return null
}

'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { Texture, Object3D, Mesh } from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js'

// Add type safety
type GLTFResult = GLTF & {
  nodes: {
    [key: string]: THREE.Mesh
  }
}

interface Logo3DProps {
  onReady?: () => void
}

export default function Logo3D({ onReady }: Logo3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    let model: THREE.Group | null = null
    const el = containerRef.current
    const getW = () => el.clientWidth || window.innerWidth
    const getH = () => el.clientHeight || 300
    const camera = new THREE.PerspectiveCamera(30, getW() / getH(), 0.1, 1000)

    camera.position.set(0, 0, 10)

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: "high-performance",
      precision: "highp"
    })
    renderer.setSize(getW(), getH())
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.setClearColor(0x000000, 0)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    el.appendChild(renderer.domElement)

    // Lighting - less saturated, cooler colors
    const ambientLight = new THREE.AmbientLight(0xf0f0f5, 0.8)     // more neutral
    const frontLight = new THREE.DirectionalLight(0xffffff, 80)     // less saturated blue-white
    // const frontPointLight = new THREE.PointLight(0xe0e0e8, 100)     // neutral grey with slight cool tint
    const pointLight = new THREE.PointLight(0xf2f2f5, 50)           // very subtle cool tint
    // const directionalLight = new THREE.DirectionalLight(0xe5e5e8, 100)  // neutral grey
    // const spotLight = new THREE.SpotLight(0xf5f5f8, 100)             // almost white
    // const backLight = new THREE.DirectionalLight(0xe8e8ec, 100)      // subtle cool backlight

    frontLight.position.set(-5, 10, 10)
    // frontPointLight.position.set(0, 0, 60)
    // pointLight.position.set(2, 100, 5)
    // directionalLight.position.set(-5, 5, -5)
    // spotLight.position.set(10, 10, 0)
    // backLight.position.set(0, 0, -10)

    // spotLight.angle = 0.5
    // spotLight.penumbra = 1

    scene.add(ambientLight, frontLight)

    // Environment map setup - enhanced for PBR materials
    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    pmremGenerator.compileEquirectangularShader()

    // Default environment so the model is renderable as soon as it loads.
    // The shiny HDR env swaps in place once it finishes downloading.
    const defaultScene = new THREE.Scene()
    defaultScene.background = new THREE.Color(0xffffff)
    const defaultLight = new THREE.AmbientLight(0xffffff, 2)
    defaultScene.add(defaultLight)
    const defaultEnvMap = pmremGenerator.fromScene(defaultScene).texture
    scene.environment = defaultEnvMap

    // Fire ready as soon as the model is in scene with the default env. HDR
    // arrives later and swaps in place on the existing material (no reload,
    // smooth dull→shiny transition), so we don't gate the loader lift on it.
    let activeEnvMap: THREE.Texture = defaultEnvMap
    let hasFiredReady = false

    function fireReady() {
      if (hasFiredReady) return
      hasFiredReady = true
      setIsLoading(false)
      onReadyRef.current?.()
    }

    function buildMaterial(envMap: THREE.Texture) {
      return new THREE.MeshPhysicalMaterial({
        metalness: 1.0,
        roughness: 0.1,
        envMap,
        envMapIntensity: 0.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        transmission: 0.0,
        reflectivity: 0.8,
        opacity: 1,
      })
    }

    function applyEnvMapToModel(envMap: THREE.Texture) {
      activeEnvMap = envMap
      if (!model) return
      model.traverse((child: THREE.Object3D) => {
        if (!(child instanceof THREE.Mesh)) return
        const existing = child.material as THREE.MeshPhysicalMaterial | undefined
        if (existing && 'envMap' in existing) {
          existing.envMap = envMap
          existing.needsUpdate = true
        } else {
          child.material = buildMaterial(envMap)
        }
      })
    }

    loadModel()

    // Try to load HDR environment map in parallel; swap in place when ready.
    // Loader has already lifted by the time this arrives — the swap is a
    // smooth material property update on the existing meshes.
    new RGBELoader()
      .setDataType(THREE.HalfFloatType)
      .load('/environment/modern_bathroom_1k.hdr',
        (hdrEquirect) => {
          const envMap = pmremGenerator.fromEquirectangular(hdrEquirect).texture
          scene.environment = envMap
          scene.background = null
          applyEnvMapToModel(envMap)
          hdrEquirect.dispose()
          pmremGenerator.dispose()
        },
        undefined,
        (err: unknown) => {
          console.warn('HDR load failed, using default environment', err)
        }
      )

    // Cleanup function to remove only the model
    function cleanScene() {
      if (model) {
        scene.remove(model)
        model = null
      }
    }

    // Function to adjust model scale and position based on window width
    function adjustModelScale() {
      if (!model) return
      model.scale.set(1, 1, 0.6)
      
      const box = new THREE.Box3().setFromObject(model as Object3D)
      const center = box.getCenter(new THREE.Vector3())
      model.position.set(-center.x, -center.y, -center.z)
    }

    // Load the (Draco-compressed) GLTF once. Materials get their env map from
    // applyEnvMapToModel so HDR can swap in later without a reload.
    function loadModel() {
      const dracoLoader = new DRACOLoader()
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/')
      dracoLoader.setDecoderConfig({ type: 'js' })

      const loader = new GLTFLoader()
      loader.setDRACOLoader(dracoLoader)
      loader.load(
        '/sundays_metallic_logo_only.min.gltf',
        (gltf) => {
          cleanScene()
          model = gltf.scene
          adjustModelScale()
          applyEnvMapToModel(activeEnvMap)
          adjustModelScale()
          scene.add(model)
          dracoLoader.dispose()
          fireReady()
        },
        undefined,
        (error) => {
          console.error('Error loading model:', error)
          dracoLoader.dispose()
        }
      )
    }

    // Mouse movement
    const mouseTolerance = 0.1
    const handleMouseMove = (e: MouseEvent) => {
      if (model && window.innerWidth >= 950) {  // Only enable on md breakpoint and up
        const centerX = window.innerWidth * 0.5
        const centerY = window.innerHeight * 0.5
        model.rotation.y = (e.clientX - centerX) / centerX * mouseTolerance
        model.rotation.x = (e.clientY - centerY) / centerY * mouseTolerance
      }
    }
    document.addEventListener('mousemove', handleMouseMove)

    // Animation
    function animate() {
      requestAnimationFrame(animate)
      if (model) {
        renderer.render(scene, camera)
      }
    }
    animate()

    function adjustCamera() {
      const w = getW()
      const h = getH()
      const baseWidth = 1200
      const minZ = 6
      const maxZ = 18
      
      const ratio = Math.max(0, 1 - (w / baseWidth))
      const z = minZ + (ratio * (maxZ - minZ))
      
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      camera.position.set(0, 0, Math.max(minZ, Math.min(maxZ, z)))
    }

    // Initial camera setup
    adjustCamera()

    // Update resize handler
    function handleResize() {
      renderer.setSize(getW(), getH())
      adjustModelScale()
      adjustCamera()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('mousemove', handleMouseMove)
      cleanScene()
      renderer.dispose()
      el.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full overflow-visible relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-black rounded-full animate-spin border-t-transparent" />
        </div>
      )}
    </div>
  )
} 
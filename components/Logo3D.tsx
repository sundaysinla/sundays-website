'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Texture, Object3D, Mesh } from 'three'

// Add type safety
type GLTFResult = GLTF & {
  nodes: {
    [key: string]: THREE.Mesh
  }
}

export default function Logo3D() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    let model: THREE.Group | null = null
    const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 1000)

    // Fixed camera position
    camera.position.z = 10
    camera.position.x = 0
    camera.position.y = 0

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: "high-performance",
      precision: "mediump"  // Use medium precision for better mobile performance
    })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // Limit pixel ratio for performance
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.setClearColor(0x000000, 0)

    containerRef.current.appendChild(renderer.domElement)

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

    // Load model immediately with basic environment
    const defaultEnvMap = pmremGenerator.fromScene(new THREE.Scene()).texture
    loadModel(defaultEnvMap)

    // Try to load HDR environment map
    new RGBELoader()
      .setDataType(THREE.HalfFloatType)
      .load('/environment/modern_bathroom_4k.hdr',
        (hdrEquirect) => {
          const envMap = pmremGenerator.fromEquirectangular(hdrEquirect).texture
          scene.environment = envMap
          scene.background = null
          loadModel(envMap)
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
      const scale = 1
      
      // Scale z-axis less to make model thinner in depth
      model.scale.set(scale, scale, scale * 0.6)
      
      // Adjust position after scaling
      if (model) {
        const box = new THREE.Box3().setFromObject(model as Object3D)
        const center = box.getCenter(new THREE.Vector3())
        model.position.set(-center.x, 0, -center.z)
      }
    }

    // Separate model loading function
    function loadModel(envMap: THREE.Texture) {
      const loader = new GLTFLoader()
      loader.load(
        '/sundays_metallic_logo_only.gltf',
        (gltf) => {
          setIsLoading(false)
          cleanScene()
          model = gltf.scene
          
          // Center the model once
          adjustModelScale()
          
          model.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
              const material = new THREE.MeshPhysicalMaterial({
                metalness: 1.0,
                roughness: 0.0,
                envMap: envMap,
                envMapIntensity: 0.5,    // significantly reduced from 0.4
                clearcoat: 1.0,
                clearcoatRoughness: 0.0,
                transmission: 0.0,
                reflectivity: 1.0,       // reduced further
                opacity: 1
              })
              child.material = material
            }
          })
          adjustModelScale()
          scene.add(model)
        },
        (progress) => {
          console.log(`Loading model: ${(progress.loaded / progress.total * 100).toFixed(2)}%`)
        },
        (error) => {
          console.error('Error loading model:', error)
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
      // Calculate camera distance based on screen width
      const baseWidth = 1200
      const minZ = 10   // Closest camera position for large screens
      const maxZ = 40   // Furthest camera position for small screens
      
      // Invert the ratio so smaller screens get larger z values
      const ratio = 1 - (window.innerWidth / baseWidth)
      const z = minZ + (ratio * (maxZ - minZ))
      
      // Calculate y position - subtle decrease as screen gets smaller
      const minY = -1.15  // Starting y position for large screens
      const maxY = -3.3  // Lowest y position for small screens
      const y = minY + (ratio * (maxY - minY))
      
      camera.position.z = Math.max(minZ, Math.min(maxZ, z))
      camera.position.x = 0
      camera.position.y = y
    }

    // Initial camera setup
    adjustCamera()

    // Update resize handler
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      adjustModelScale()
      adjustCamera()  // Add camera adjustment on resize
    })

    // Enhanced cleanup
    return () => {
      window.removeEventListener('resize', adjustModelScale)
      document.removeEventListener('mousemove', handleMouseMove)
      cleanScene()
      renderer.dispose()
      containerRef.current?.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full overflow-visible">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-black rounded-full animate-spin border-t-transparent" />
        </div>
      )}
    </div>
  )
} 
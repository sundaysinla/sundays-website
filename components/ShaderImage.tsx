import { useRef, useEffect } from 'react'
import * as THREE from 'three'

const vertexShader = `
  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec2 uCursor;
  uniform float uScrollVelocity;
  uniform vec2 uTextureSize;
  uniform vec2 uQuadSize;
  uniform float uBorderRadius;
  uniform float uMouseEnter;
  uniform vec2 uMouseOverPos;

  varying vec2 vUv;
  varying vec2 vUvCover;

  vec2 getCoverUvVert(vec2 uv, vec2 textureSize, vec2 quadSize) {
    vec2 ratio = vec2(
      min((quadSize.x / quadSize.y) / (textureSize.x / textureSize.y), 1.0),
      min((quadSize.y / quadSize.x) / (textureSize.y / textureSize.x), 1.0)
    );
    
    return vec2(
      uv.x * ratio.x + (1.0 - ratio.x) * 0.5,
      uv.y * ratio.y + (1.0 - ratio.y) * 0.5
    );
  }

  void main() {
    vUv = uv;
    vUvCover = getCoverUvVert(uv, uTextureSize, uQuadSize);
    
    vec3 pos = position;
    float wave = sin(uv.x * 6.0 + uTime) * 0.05 * uMouseEnter;
    pos.z += wave;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uMouseEnter;
  uniform float uTime;
  
  varying vec2 vUv;
  varying vec2 vUvCover;
  
  void main() {
    vec2 uv = vUvCover;
    
    // Add distortion
    float distortion = sin(uv.y * 10.0 + uTime) * 0.02 * uMouseEnter;
    uv.x += distortion;
    
    vec4 texture = texture2D(uTexture, uv);
    gl_FragColor = texture;
  }
`

interface ShaderImageProps {
  src: string
  alt: string
}

export default function ShaderImage({ src, alt }: ShaderImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mouseEnter = useRef(0)
  const time = useRef(0)

  useEffect(() => {
    if (!containerRef.current) return

    // Setup
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    
    const container = containerRef.current
    const { width, height } = container.getBoundingClientRect()
    
    renderer.setSize(width, height)
    container.appendChild(renderer.domElement)
    
    // Create mesh with shader material
    const loader = new THREE.TextureLoader()
    const texture = loader.load(src)
    
    const geometry = new THREE.PlaneGeometry(1, 1, 32, 32)
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uResolution: { value: new THREE.Vector2(width, height) },
        uTime: { value: 0 },
        uCursor: { value: new THREE.Vector2(0, 0) },
        uScrollVelocity: { value: 0 },
        uTexture: { value: texture },
        uTextureSize: { value: new THREE.Vector2(width, height) },
        uQuadSize: { value: new THREE.Vector2(width, height) },
        uBorderRadius: { value: 32 },
        uMouseEnter: { value: 0 },
        uMouseOverPos: { value: new THREE.Vector2(0, 0) }
      }
    })
    
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)
    
    camera.position.z = 1

    // Animation
    const animate = () => {
      requestAnimationFrame(animate)
      time.current += 0.01
      material.uniforms.uTime.value = time.current
      material.uniforms.uMouseEnter.value = mouseEnter.current
      renderer.render(scene, camera)
    }
    
    // Events
    const handleMouseEnter = () => {
      mouseEnter.current = 1
    }
    
    const handleMouseLeave = () => {
      mouseEnter.current = 0
    }
    
    container.addEventListener('mouseenter', handleMouseEnter)
    container.addEventListener('mouseleave', handleMouseLeave)
    
    animate()
    
    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter)
      container.removeEventListener('mouseleave', handleMouseLeave)
      container.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [src])

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative"
      style={{ aspectRatio: '1.8/1' }}
    />
  )
} 
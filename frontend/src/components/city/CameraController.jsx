import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { gsap } from 'gsap'
import { useCityStore } from '../../store/cityStore'

export function CameraController() {
  const { camera } = useThree()
  const orbitRef = useRef()
  const selectedBuilding = useCityStore(s => s.selectedBuilding)
  const buildings = useCityStore(s => s.buildings)
  const cameraMode = useCityStore(s => s.cameraMode)
  const setCameraMode = useCityStore(s => s.setCameraMode)
  const velocity = useRef({ x: 0, z: 0 })
  const keysPressed = useRef({})

  // Fly to selected building
  useEffect(() => {
    if (!selectedBuilding || cameraMode !== 'orbit') return
    const b = buildings.find(b => b.id === selectedBuilding)
    if (!b || !orbitRef.current) return
    gsap.to(camera.position, {
      x: b.position_x + 30,
      y: (b.height || 10) + 20,
      z: b.position_z + 40,
      duration: 0.6,
      ease: 'power2.inOut',
      onUpdate: () => {
        if (orbitRef.current) {
          orbitRef.current.target.set(b.position_x, (b.height || 10) / 2, b.position_z)
        }
      }
    })
  }, [selectedBuilding, buildings, camera, cameraMode])

  // Drive mode: animate camera to street level
  useEffect(() => {
    if (cameraMode === 'drive') {
      gsap.to(camera.position, { y: 3, duration: 0.6, ease: 'power2.inOut' })
    } else {
      gsap.to(camera.position, {
        x: 0, y: 120, z: 180,
        duration: 0.8, ease: 'power2.inOut'
      })
    }
  }, [cameraMode, camera])

  // Drive mode WASD controls
  useEffect(() => {
    if (cameraMode !== 'drive') return
    const down = (e) => { keysPressed.current[e.key.toLowerCase()] = true }
    const up = (e) => { keysPressed.current[e.key.toLowerCase()] = false }
    const escape = (e) => {
      if (e.key === 'Escape' || e.key.toLowerCase() === 'b') {
        setCameraMode('orbit')
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('keydown', escape)
    }
  }, [cameraMode, setCameraMode])

  useFrame((_, delta) => {
    if (cameraMode !== 'drive') return
    const speed = 40
    const friction = 0.88
    const forward = new THREE.Vector3(-Math.sin(camera.rotation.y), 0, -Math.cos(camera.rotation.y))
    const right = new THREE.Vector3(Math.cos(camera.rotation.y), 0, -Math.sin(camera.rotation.y))

    if (keysPressed.current['w']) { velocity.current.x += forward.x * speed * delta; velocity.current.z += forward.z * speed * delta }
    if (keysPressed.current['s']) { velocity.current.x -= forward.x * speed * delta; velocity.current.z -= forward.z * speed * delta }
    if (keysPressed.current['a']) { velocity.current.x -= right.x * speed * delta; velocity.current.z -= right.z * speed * delta }
    if (keysPressed.current['d']) { velocity.current.x += right.x * speed * delta; velocity.current.z += right.z * speed * delta }

    velocity.current.x *= friction
    velocity.current.z *= friction
    camera.position.x += velocity.current.x
    camera.position.z += velocity.current.z
    camera.position.y = 3
  })

  // Orbit mode
  if (cameraMode === 'orbit') {
    return <OrbitControls ref={orbitRef} maxPolarAngle={Math.PI / 2.2} minDistance={20} maxDistance={400} />
  }

  // Drive mode — no orbit controls
  return null
}

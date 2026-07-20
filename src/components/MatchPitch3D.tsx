/**
 * ต้นแบบสนาม 3D (Three.js) — แยกจาก MatchPitch 2D
 * เป้าจาก React · เลื่อนจริงใน RAF ทุกเฟรม (ไม่วาร์ป)
 */
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { PitchSpot } from '@/game/types'
import type { PitchPlayerMarker } from '@/components/MatchPitch'
import { cn } from '@/lib/cn'

const PITCH_LEN = 105
const PITCH_WID = 68

/** ความเร็วไล่เป้า (หน่วยโลก / วินาที) — กันกระชากเมื่อซิมกระโดด */
const PLAYER_MAX_SPEED = 28
const BALL_MAX_SPEED = 55
/** exponential follow — ยิ่งสูงยิ่งติดเป้า */
const PLAYER_FOLLOW = 7.5
const BALL_FOLLOW = 11

function spotToWorld(spot: PitchSpot, y = 0): THREE.Vector3 {
  const x = ((spot.y - 50) / 50) * (PITCH_WID * 0.5)
  const z = ((50 - spot.x) / 50) * (PITCH_LEN * 0.5)
  return new THREE.Vector3(x, y, z)
}

function approach(curr: number, target: number, follow: number, maxSpeed: number, dt: number): number {
  const alpha = 1 - Math.exp(-follow * dt)
  let next = curr + (target - curr) * alpha
  const maxStep = maxSpeed * dt
  const d = next - curr
  if (Math.abs(d) > maxStep) next = curr + Math.sign(d) * maxStep
  return next
}

function makePitchMesh(): THREE.Group {
  const g = new THREE.Group()
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(PITCH_WID + 4, PITCH_LEN + 4),
    new THREE.MeshLambertMaterial({ color: 0x1a5c32 }),
  )
  grass.rotation.x = -Math.PI / 2
  grass.receiveShadow = true
  g.add(grass)

  for (let i = 0; i < 8; i++) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(PITCH_WID, PITCH_LEN / 8),
      new THREE.MeshLambertMaterial({
        color: i % 2 === 0 ? 0x1f6b3a : 0x176033,
        transparent: true,
        opacity: 0.55,
      }),
    )
    stripe.rotation.x = -Math.PI / 2
    stripe.position.y = 0.02
    stripe.position.z = -PITCH_LEN / 2 + PITCH_LEN / 16 + (i * PITCH_LEN) / 8
    g.add(stripe)
  }

  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff })
  const addRect = (w: number, d: number, cx: number, cz: number) => {
    const hw = w / 2
    const hd = d / 2
    const pts = [
      new THREE.Vector3(cx - hw, 0.05, cz - hd),
      new THREE.Vector3(cx + hw, 0.05, cz - hd),
      new THREE.Vector3(cx + hw, 0.05, cz + hd),
      new THREE.Vector3(cx - hw, 0.05, cz + hd),
      new THREE.Vector3(cx - hw, 0.05, cz - hd),
    ]
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat))
  }

  addRect(PITCH_WID, PITCH_LEN, 0, 0)
  g.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-PITCH_WID / 2, 0.05, 0),
        new THREE.Vector3(PITCH_WID / 2, 0.05, 0),
      ]),
      lineMat,
    ),
  )
  {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a) * 9.15, 0.05, Math.sin(a) * 9.15))
    }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat))
  }
  addRect(40.32, 16.5, 0, -PITCH_LEN / 2 + 8.25)
  addRect(18.32, 5.5, 0, -PITCH_LEN / 2 + 2.75)
  addRect(40.32, 16.5, 0, PITCH_LEN / 2 - 8.25)
  addRect(18.32, 5.5, 0, PITCH_LEN / 2 - 2.75)

  const goalMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 0.2 })
  for (const z of [-PITCH_LEN / 2, PITCH_LEN / 2]) {
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 8), goalMat)
    postL.position.set(-3.66, 1.2, z)
    const postR = postL.clone()
    postR.position.x = 3.66
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 7.32, 8), goalMat)
    bar.rotation.z = Math.PI / 2
    bar.position.set(0, 2.4, z)
    g.add(postL, postR, bar)
  }

  return g
}

type PlayerHandle = {
  root: THREE.Group
  bodyMat: THREE.MeshStandardMaterial
  ring: THREE.Mesh
  target: THREE.Vector3
  active: boolean
}

function makePlayerHandle(color: string): PlayerHandle {
  const root = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.55,
    metalness: 0.05,
    emissive: new THREE.Color(0x000000),
  })
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.1, 4, 8), bodyMat)
  body.position.y = 1.0
  body.castShadow = true
  root.add(body)

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.7 }),
  )
  head.position.y = 2.05
  head.castShadow = true
  root.add(head)

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 0.95, 24),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.08
  ring.visible = false
  root.add(ring)

  return {
    root,
    bodyMat,
    ring,
    target: new THREE.Vector3(),
    active: false,
  }
}

interface MatchPitch3DProps {
  spot: PitchSpot
  players: PitchPlayerMarker[]
  homeColor: string
  awayColor: string
  className?: string
}

export function MatchPitch3D({
  spot,
  players,
  homeColor,
  awayColor,
  className,
}: MatchPitch3DProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const targetsRef = useRef<{
    players: Map<string, { spot: PitchSpot; side: 'home' | 'away'; active: boolean }>
    ball: PitchSpot
    homeColor: string
    awayColor: string
  }>({
    players: new Map(),
    ball: { x: 50, y: 50 },
    homeColor,
    awayColor,
  })

  const apiRef = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    controls: OrbitControls
    players: Map<string, PlayerHandle>
    ball: THREE.Mesh
    ballTarget: THREE.Vector3
    frame: number
    lastTs: number
  } | null>(null)

  // อัปเดตเป้าเท่านั้น — ไม่ขยับ mesh ที่นี่
  targetsRef.current.ball = spot
  targetsRef.current.homeColor = homeColor
  targetsRef.current.awayColor = awayColor
  const nextMap = new Map<string, { spot: PitchSpot; side: 'home' | 'away'; active: boolean }>()
  for (const p of players) {
    nextMap.set(p.id, { spot: p.spot, side: p.side, active: Boolean(p.active) })
  }
  targetsRef.current.players = nextMap

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b1220)
    scene.fog = new THREE.Fog(0x0b1220, 80, 220)

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500)
    camera.position.set(0, 48, 62)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    host.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0, 0)
    controls.enableDamping = true
    controls.maxPolarAngle = Math.PI * 0.48
    controls.minDistance = 28
    controls.maxDistance = 120

    scene.add(new THREE.HemisphereLight(0xb8d4ff, 0x3d5c3a, 0.85))
    const sun = new THREE.DirectionalLight(0xfff2d6, 1.15)
    sun.position.set(30, 55, 20)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -60
    sun.shadow.camera.right = 60
    sun.shadow.camera.top = 60
    sun.shadow.camera.bottom = -60
    scene.add(sun)

    scene.add(makePitchMesh())

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 }),
    )
    ball.castShadow = true
    const kick = spotToWorld({ x: 50, y: 50 }, 0.42)
    ball.position.copy(kick)
    scene.add(ball)

    const resize = () => {
      const w = host.clientWidth || 640
      const h = host.clientHeight || 400
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    const playerMap = new Map<string, PlayerHandle>()
    const ballTarget = kick.clone()

    let raf = 0
    let lastTs = performance.now()

    const ensurePlayers = () => {
      const tg = targetsRef.current
      const seen = new Set<string>()
      for (const [id, info] of tg.players) {
        seen.add(id)
        let h = playerMap.get(id)
        const color = info.side === 'home' ? tg.homeColor : tg.awayColor
        if (!h) {
          h = makePlayerHandle(color)
          const w = spotToWorld(info.spot, 0)
          h.root.position.copy(w)
          h.target.copy(w)
          scene.add(h.root)
          playerMap.set(id, h)
        }
        h.bodyMat.color.set(color)
        h.target.copy(spotToWorld(info.spot, 0))
        if (h.active !== info.active) {
          h.active = info.active
          h.ring.visible = info.active
          h.bodyMat.emissive.set(info.active ? 0x332200 : 0x000000)
        }
      }
      for (const [id, h] of playerMap) {
        if (!seen.has(id)) {
          scene.remove(h.root)
          playerMap.delete(id)
        }
      }
      ballTarget.copy(spotToWorld(tg.ball, 0.42))
    }

    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000))
      lastTs = ts

      ensurePlayers()

      for (const h of playerMap.values()) {
        const follow = h.active ? PLAYER_FOLLOW * 1.35 : PLAYER_FOLLOW
        const maxSp = h.active ? PLAYER_MAX_SPEED * 1.4 : PLAYER_MAX_SPEED
        h.root.position.x = approach(h.root.position.x, h.target.x, follow, maxSp, dt)
        h.root.position.z = approach(h.root.position.z, h.target.z, follow, maxSp, dt)
        h.root.position.y = 0
        // หันไปทางที่วิ่ง
        const dx = h.target.x - h.root.position.x
        const dz = h.target.z - h.root.position.z
        if (dx * dx + dz * dz > 0.04) {
          const yaw = Math.atan2(dx, dz)
          let cur = h.root.rotation.y
          let diff = yaw - cur
          while (diff > Math.PI) diff -= Math.PI * 2
          while (diff < -Math.PI) diff += Math.PI * 2
          h.root.rotation.y = cur + diff * Math.min(1, 10 * dt)
        }
      }

      ball.position.x = approach(ball.position.x, ballTarget.x, BALL_FOLLOW, BALL_MAX_SPEED, dt)
      ball.position.z = approach(ball.position.z, ballTarget.z, BALL_FOLLOW, BALL_MAX_SPEED, dt)
      ball.position.y = 0.42

      controls.update()
      renderer.render(scene, camera)
      if (apiRef.current) apiRef.current.frame = raf
    }
    raf = requestAnimationFrame(tick)

    apiRef.current = {
      renderer,
      scene,
      camera,
      controls,
      players: playerMap,
      ball,
      ballTarget,
      frame: raf,
      lastTs,
    }

    return () => {
      cancelAnimationFrame(apiRef.current?.frame ?? raf)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      if (host.contains(renderer.domElement)) host.removeChild(renderer.domElement)
      apiRef.current = null
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className={cn(
        'relative min-h-[420px] w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-950',
        className,
      )}
      role="img"
      aria-label="Football pitch 3D"
    />
  )
}

import { useState, useRef, useCallback, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, Sky, Text, Float, ContactShadows, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

// Game state types
interface GameState {
  playerScore: number
  opponentScore: number
  playerGames: number
  opponentGames: number
  serving: 'player' | 'opponent'
  gameActive: boolean
  rally: number
}

interface BallState {
  position: THREE.Vector3
  velocity: THREE.Vector3
  inPlay: boolean
  lastHitBy: 'player' | 'opponent' | null
}

// Tennis Court Component
function TennisCourt() {
  return (
    <group position={[0, 0, 0]}>
      {/* Grass surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[28, 14]} />
        <meshStandardMaterial color="#2d5a27" roughness={0.9} />
      </mesh>

      {/* Court playing area - lighter grass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[23.77, 10.97]} />
        <meshStandardMaterial color="#3d7a37" roughness={0.85} />
      </mesh>

      {/* White court lines */}
      <CourtLines />

      {/* Net */}
      <TennisNet />

      {/* Court surroundings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[50, 30]} />
        <meshStandardMaterial color="#1a4015" roughness={1} />
      </mesh>
    </group>
  )
}

function CourtLines() {
  const lineColor = "#ffffff"
  const lineHeight = 0.02

  return (
    <group position={[0, lineHeight, 0]}>
      {/* Baseline - player side */}
      <mesh position={[0, 0, 5.485]}>
        <boxGeometry args={[10.97, 0.02, 0.05]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>
      {/* Baseline - opponent side */}
      <mesh position={[0, 0, -5.485]}>
        <boxGeometry args={[10.97, 0.02, 0.05]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>

      {/* Singles sidelines */}
      <mesh position={[4.115, 0, 0]}>
        <boxGeometry args={[0.05, 0.02, 10.97]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>
      <mesh position={[-4.115, 0, 0]}>
        <boxGeometry args={[0.05, 0.02, 10.97]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>

      {/* Doubles sidelines */}
      <mesh position={[5.485, 0, 0]}>
        <boxGeometry args={[0.05, 0.02, 10.97]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>
      <mesh position={[-5.485, 0, 0]}>
        <boxGeometry args={[0.05, 0.02, 10.97]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>

      {/* Service lines */}
      <mesh position={[0, 0, 1.98]}>
        <boxGeometry args={[8.23, 0.02, 0.05]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>
      <mesh position={[0, 0, -1.98]}>
        <boxGeometry args={[8.23, 0.02, 0.05]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>

      {/* Center service line */}
      <mesh position={[0, 0, 3.735]}>
        <boxGeometry args={[0.05, 0.02, 3.51]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>
      <mesh position={[0, 0, -3.735]}>
        <boxGeometry args={[0.05, 0.02, 3.51]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>

      {/* Center mark - player side */}
      <mesh position={[0, 0, 5.6]}>
        <boxGeometry args={[0.05, 0.02, 0.2]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>
      {/* Center mark - opponent side */}
      <mesh position={[0, 0, -5.6]}>
        <boxGeometry args={[0.05, 0.02, 0.2]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>
    </group>
  )
}

function TennisNet() {
  return (
    <group position={[0, 0, 0]}>
      {/* Net posts */}
      <mesh position={[-6.4, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 1.1, 16]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[6.4, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 1.1, 16]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Net top bar */}
      <mesh position={[0, 1.07, 0]} castShadow>
        <boxGeometry args={[12.8, 0.05, 0.02]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Net mesh - using a thin box with transparency simulation */}
      <mesh position={[0, 0.53, 0]}>
        <boxGeometry args={[12.8, 1.0, 0.02]} />
        <meshStandardMaterial color="#f5f5f5" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>

      {/* Center strap */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.05, 0.9, 0.03]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

// Tennis Ball
function TennisBall({
  ballState,
  setBallState,
  gameState,
  setGameState,
  playerPaddleX
}: {
  ballState: BallState
  setBallState: React.Dispatch<React.SetStateAction<BallState>>
  gameState: GameState
  setGameState: React.Dispatch<React.SetStateAction<GameState>>
  playerPaddleX: number
}) {
  const ref = useRef<THREE.Mesh>(null!)
  const trailRef = useRef<THREE.Points>(null!)
  const trailPositions = useRef<number[]>([])

  useFrame((_, delta) => {
    if (!ballState.inPlay) return

    const gravity = -15
    const dampening = 0.85
    const airResistance = 0.995

    // Update velocity
    const newVelocity = ballState.velocity.clone()
    newVelocity.y += gravity * delta
    newVelocity.multiplyScalar(airResistance)

    // Update position
    const newPosition = ballState.position.clone()
    newPosition.add(newVelocity.clone().multiplyScalar(delta))

    // Ground bounce
    if (newPosition.y <= 0.1) {
      newPosition.y = 0.1
      newVelocity.y = Math.abs(newVelocity.y) * dampening

      // Check if ball landed in bounds
      const inBounds = Math.abs(newPosition.x) < 4.1 && Math.abs(newPosition.z) < 5.5

      if (!inBounds || newVelocity.length() < 0.5) {
        // Point over
        const scoringPlayer = ballState.lastHitBy === 'player' && inBounds ? 'player' :
                              ballState.lastHitBy === 'opponent' && inBounds ? 'opponent' :
                              ballState.lastHitBy === 'player' ? 'opponent' : 'player'

        setGameState(prev => ({
          ...prev,
          playerScore: scoringPlayer === 'player' ? prev.playerScore + 1 : prev.playerScore,
          opponentScore: scoringPlayer === 'opponent' ? prev.opponentScore + 1 : prev.opponentScore,
          rally: 0
        }))

        setBallState(prev => ({ ...prev, inPlay: false }))
        return
      }
    }

    // Net collision
    if (Math.abs(newPosition.z) < 0.1 && newPosition.y < 1.07) {
      // Hit the net
      newVelocity.z *= -0.3
      newVelocity.y *= 0.5
    }

    // Player paddle collision (at z = 5)
    if (newPosition.z > 4.5 && newPosition.z < 5.5 &&
        ballState.lastHitBy !== 'player' && newPosition.y < 2) {
      const paddleHitX = Math.abs(newPosition.x - playerPaddleX) < 1.5

      if (paddleHitX) {
        // Hit by player
        const hitAngle = (newPosition.x - playerPaddleX) * 0.3
        newVelocity.z = -12 - Math.random() * 4
        newVelocity.y = 4 + Math.random() * 3
        newVelocity.x = hitAngle * 8

        setBallState(prev => ({ ...prev, lastHitBy: 'player' }))
        setGameState(prev => ({ ...prev, rally: prev.rally + 1 }))
      }
    }

    // Opponent AI paddle collision (at z = -5)
    if (newPosition.z < -4 && newPosition.z > -5.5 &&
        ballState.lastHitBy !== 'opponent' && newPosition.y < 2) {
      // AI always hits
      newVelocity.z = 10 + Math.random() * 5
      newVelocity.y = 3 + Math.random() * 4
      newVelocity.x = (Math.random() - 0.5) * 8

      setBallState(prev => ({ ...prev, lastHitBy: 'opponent' }))
      setGameState(prev => ({ ...prev, rally: prev.rally + 1 }))
    }

    // Out of bounds
    if (Math.abs(newPosition.z) > 12 || Math.abs(newPosition.x) > 10) {
      const scoringPlayer = newPosition.z > 0 ? 'opponent' : 'player'
      setGameState(prev => ({
        ...prev,
        playerScore: scoringPlayer === 'player' ? prev.playerScore + 1 : prev.playerScore,
        opponentScore: scoringPlayer === 'opponent' ? prev.opponentScore + 1 : prev.opponentScore,
        rally: 0
      }))
      setBallState(prev => ({ ...prev, inPlay: false }))
      return
    }

    // Update ball mesh position
    if (ref.current) {
      ref.current.position.copy(newPosition)
      ref.current.rotation.x += delta * 10
      ref.current.rotation.z += delta * 5
    }

    // Update trail
    trailPositions.current.unshift(newPosition.x, newPosition.y, newPosition.z)
    if (trailPositions.current.length > 30) {
      trailPositions.current = trailPositions.current.slice(0, 30)
    }

    if (trailRef.current) {
      const geometry = trailRef.current.geometry as THREE.BufferGeometry
      const positions = new Float32Array(trailPositions.current)
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    }

    setBallState(prev => ({
      ...prev,
      position: newPosition,
      velocity: newVelocity
    }))
  })

  if (!ballState.inPlay) return null

  return (
    <group>
      <mesh ref={ref} position={ballState.position.toArray()} castShadow>
        <sphereGeometry args={[0.1, 32, 32]} />
        <meshStandardMaterial
          color="#c8e300"
          roughness={0.8}
          emissive="#c8e300"
          emissiveIntensity={0.1}
        />
      </mesh>
      <points ref={trailRef}>
        <bufferGeometry />
        <pointsMaterial color="#c8e300" size={0.05} transparent opacity={0.4} />
      </points>
    </group>
  )
}

// Tennis Racket (Player's paddle)
function PlayerPaddle({ x, setX }: { x: number; setX: (x: number) => void }) {
  const ref = useRef<THREE.Group>(null!)
  const { camera, gl } = useThree()
  const targetX = useRef(0)

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect()
      const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1
      targetX.current = mouseX * 5
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        const rect = gl.domElement.getBoundingClientRect()
        const touchX = ((event.touches[0].clientX - rect.left) / rect.width) * 2 - 1
        targetX.current = touchX * 5
      }
    }

    gl.domElement.addEventListener('mousemove', handleMouseMove)
    gl.domElement.addEventListener('touchmove', handleTouchMove)

    return () => {
      gl.domElement.removeEventListener('mousemove', handleMouseMove)
      gl.domElement.removeEventListener('touchmove', handleTouchMove)
    }
  }, [camera, gl])

  useFrame((_, delta) => {
    const smoothing = 0.15
    const newX = THREE.MathUtils.lerp(ref.current.position.x, targetX.current, smoothing)
    ref.current.position.x = THREE.MathUtils.clamp(newX, -4, 4)
    setX(ref.current.position.x)
  })

  return (
    <group ref={ref} position={[0, 0.8, 5.5]}>
      {/* Racket head */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.4, 0.03, 16, 32]} />
        <meshStandardMaterial color="#2c1810" metalness={0.3} roughness={0.6} />
      </mesh>
      {/* Racket strings */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.38, 32]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Racket handle */}
      <mesh position={[0, -0.6, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.8, 16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>
      {/* Grip */}
      <mesh position={[0, -0.7, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.4, 16]} />
        <meshStandardMaterial color="#333366" roughness={0.95} />
      </mesh>
    </group>
  )
}

// Opponent AI Paddle
function OpponentPaddle({ ballPosition }: { ballPosition: THREE.Vector3 }) {
  const ref = useRef<THREE.Group>(null!)

  useFrame((_, delta) => {
    if (ref.current) {
      const targetX = THREE.MathUtils.clamp(ballPosition.x, -4, 4)
      ref.current.position.x = THREE.MathUtils.lerp(
        ref.current.position.x,
        targetX,
        0.05
      )
    }
  })

  return (
    <group ref={ref} position={[0, 0.8, -5.5]}>
      {/* Racket head */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.4, 0.03, 16, 32]} />
        <meshStandardMaterial color="#8b0000" metalness={0.3} roughness={0.6} />
      </mesh>
      {/* Racket strings */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.38, 32]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Racket handle */}
      <mesh position={[0, -0.6, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.8, 16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>
    </group>
  )
}

// Scoreboard
function Scoreboard3D({ gameState }: { gameState: GameState }) {
  const scoreToTennis = (score: number) => {
    const scores = ['0', '15', '30', '40']
    return score < 4 ? scores[score] : 'AD'
  }

  return (
    <Float speed={1} rotationIntensity={0.1} floatIntensity={0.3}>
      <group position={[-8, 4, 0]}>
        <RoundedBox args={[3, 2, 0.2]} radius={0.1} smoothness={4}>
          <meshStandardMaterial color="#1a2f1a" metalness={0.1} roughness={0.8} />
        </RoundedBox>
        <Text
          position={[0, 0.5, 0.15]}
          fontSize={0.3}
          color="#c8e300"
          font="https://fonts.gstatic.com/s/playfairdisplay/v36/nuFiD-vYSZviVYUb_rj3ij__anPXDTzYgA.woff2"
          anchorX="center"
          anchorY="middle"
        >
          {`YOU: ${scoreToTennis(gameState.playerScore)}`}
        </Text>
        <Text
          position={[0, 0, 0.15]}
          fontSize={0.3}
          color="#ffffff"
          font="https://fonts.gstatic.com/s/playfairdisplay/v36/nuFiD-vYSZviVYUb_rj3ij__anPXDTzYgA.woff2"
          anchorX="center"
          anchorY="middle"
        >
          {`OPP: ${scoreToTennis(gameState.opponentScore)}`}
        </Text>
        <Text
          position={[0, -0.5, 0.15]}
          fontSize={0.2}
          color="#88aa88"
          font="https://fonts.gstatic.com/s/playfairdisplay/v36/nuFiD-vYSZviVYUb_rj3ij__anPXDTzYgA.woff2"
          anchorX="center"
          anchorY="middle"
        >
          {`Games: ${gameState.playerGames} - ${gameState.opponentGames}`}
        </Text>
      </group>
    </Float>
  )
}

// Main Game Scene
function GameScene({
  gameState,
  setGameState,
  ballState,
  setBallState,
  serveBall
}: {
  gameState: GameState
  setGameState: React.Dispatch<React.SetStateAction<GameState>>
  ballState: BallState
  setBallState: React.Dispatch<React.SetStateAction<BallState>>
  serveBall: () => void
}) {
  const [playerPaddleX, setPlayerPaddleX] = useState(0)

  return (
    <>
      <TennisCourt />
      <PlayerPaddle x={playerPaddleX} setX={setPlayerPaddleX} />
      <OpponentPaddle ballPosition={ballState.position} />
      <TennisBall
        ballState={ballState}
        setBallState={setBallState}
        gameState={gameState}
        setGameState={setGameState}
        playerPaddleX={playerPaddleX}
      />
      <Scoreboard3D gameState={gameState} />

      {/* Stadium elements */}
      <StadiumElements />

      {/* Ambient particles */}
      <GrassParticles />
    </>
  )
}

// Stadium decorations
function StadiumElements() {
  return (
    <group>
      {/* Hedges around court */}
      {[-8, 8].map((x) => (
        <mesh key={x} position={[x, 0.5, 0]} castShadow>
          <boxGeometry args={[0.8, 1, 16]} />
          <meshStandardMaterial color="#1a4a15" roughness={1} />
        </mesh>
      ))}

      {/* Umpire chair */}
      <group position={[7, 0, 0]}>
        <mesh position={[0, 1.5, 0]} castShadow>
          <boxGeometry args={[0.8, 0.1, 0.8]} />
          <meshStandardMaterial color="#2c1810" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.75, 0]} castShadow>
          <boxGeometry args={[0.1, 1.5, 0.1]} />
          <meshStandardMaterial color="#2c1810" roughness={0.7} />
        </mesh>
        <mesh position={[0.3, 0.75, 0]} castShadow>
          <boxGeometry args={[0.1, 1.5, 0.1]} />
          <meshStandardMaterial color="#2c1810" roughness={0.7} />
        </mesh>
        <mesh position={[-0.3, 0.75, 0]} castShadow>
          <boxGeometry args={[0.1, 1.5, 0.1]} />
          <meshStandardMaterial color="#2c1810" roughness={0.7} />
        </mesh>
      </group>

      {/* Benches */}
      {[-9, 9].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[4, 0.1, 0.5]} />
            <meshStandardMaterial color="#2c1810" roughness={0.7} />
          </mesh>
          <mesh position={[-1.8, 0.15, 0]} castShadow>
            <boxGeometry args={[0.1, 0.3, 0.5]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.5} />
          </mesh>
          <mesh position={[1.8, 0.15, 0]} castShadow>
            <boxGeometry args={[0.1, 0.3, 0.5]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Grass particle effect
function GrassParticles() {
  const ref = useRef<THREE.Points>(null!)
  const count = 200

  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 30
    positions[i * 3 + 1] = Math.random() * 0.5
    positions[i * 3 + 2] = (Math.random() - 0.5) * 20
  }

  useFrame((state) => {
    if (ref.current) {
      const positions = ref.current.geometry.attributes.position.array as Float32Array
      for (let i = 0; i < count; i++) {
        positions[i * 3 + 1] = Math.sin(state.clock.elapsedTime * 2 + i) * 0.1 + 0.2
      }
      ref.current.geometry.attributes.position.needsUpdate = true
    }
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#4a7a44" size={0.05} transparent opacity={0.6} />
    </points>
  )
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    playerScore: 0,
    opponentScore: 0,
    playerGames: 0,
    opponentGames: 0,
    serving: 'player',
    gameActive: false,
    rally: 0
  })

  const [ballState, setBallState] = useState<BallState>({
    position: new THREE.Vector3(0, 1, 4),
    velocity: new THREE.Vector3(0, 0, 0),
    inPlay: false,
    lastHitBy: null
  })

  const [showInstructions, setShowInstructions] = useState(true)

  const serveBall = useCallback(() => {
    const serveVelocity = gameState.serving === 'player'
      ? new THREE.Vector3((Math.random() - 0.5) * 3, 5, -10)
      : new THREE.Vector3((Math.random() - 0.5) * 3, 5, 10)

    const servePosition = gameState.serving === 'player'
      ? new THREE.Vector3(0, 1.5, 4)
      : new THREE.Vector3(0, 1.5, -4)

    setBallState({
      position: servePosition,
      velocity: serveVelocity,
      inPlay: true,
      lastHitBy: gameState.serving
    })

    setGameState(prev => ({ ...prev, gameActive: true }))
    setShowInstructions(false)
  }, [gameState.serving])

  // Check for game win
  useEffect(() => {
    if (gameState.playerScore >= 4 && gameState.playerScore - gameState.opponentScore >= 2) {
      setGameState(prev => ({
        ...prev,
        playerGames: prev.playerGames + 1,
        playerScore: 0,
        opponentScore: 0,
        serving: prev.serving === 'player' ? 'opponent' : 'player'
      }))
    } else if (gameState.opponentScore >= 4 && gameState.opponentScore - gameState.playerScore >= 2) {
      setGameState(prev => ({
        ...prev,
        opponentGames: prev.opponentGames + 1,
        playerScore: 0,
        opponentScore: 0,
        serving: prev.serving === 'player' ? 'opponent' : 'player'
      }))
    }
  }, [gameState.playerScore, gameState.opponentScore])

  const scoreToTennis = (score: number) => {
    const scores = ['0', '15', '30', '40']
    return score < 4 ? scores[score] : 'AD'
  }

  return (
    <div className="w-screen h-screen bg-gradient-to-b from-[#0a1f0a] to-[#1a3a1a] overflow-hidden relative">
      {/* Main 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 8, 14], fov: 50 }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[10, 15, 10]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-far={50}
            shadow-camera-left={-15}
            shadow-camera-right={15}
            shadow-camera-top={15}
            shadow-camera-bottom={-15}
          />
          <pointLight position={[-10, 10, -10]} intensity={0.3} color="#ffd700" />

          <Sky
            sunPosition={[100, 50, 100]}
            turbidity={8}
            rayleigh={2}
            mieCoefficient={0.005}
            mieDirectionalG={0.8}
          />

          <GameScene
            gameState={gameState}
            setGameState={setGameState}
            ballState={ballState}
            setBallState={setBallState}
            serveBall={serveBall}
          />

          <ContactShadows
            position={[0, 0, 0]}
            opacity={0.4}
            scale={40}
            blur={2}
            far={10}
          />

          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.5}
            minDistance={8}
            maxDistance={25}
            enablePan={false}
          />
        </Suspense>
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 right-0 p-4 md:p-6 pointer-events-none">
        <div className="flex justify-between items-start">
          {/* Title */}
          <div className="pointer-events-auto">
            <h1
              className="text-2xl md:text-4xl font-bold tracking-wider"
              style={{
                fontFamily: "'Playfair Display', serif",
                color: '#c8e300',
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
              }}
            >
              LAWN TENNIS
            </h1>
            <p
              className="text-xs md:text-sm tracking-widest mt-1"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                color: '#88aa88'
              }}
            >
              CHAMPIONSHIP EDITION
            </p>
          </div>

          {/* Score Display */}
          <div
            className="bg-[#1a2f1a]/90 backdrop-blur-sm rounded-lg px-4 py-3 md:px-6 md:py-4 border border-[#3d5a3d]/50 pointer-events-auto"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            <div className="flex gap-6 md:gap-10 items-center">
              <div className="text-center">
                <p className="text-[#88aa88] text-xs tracking-widest mb-1">YOU</p>
                <p className="text-[#c8e300] text-2xl md:text-4xl font-bold">{scoreToTennis(gameState.playerScore)}</p>
                <p className="text-[#667766] text-xs mt-1">Games: {gameState.playerGames}</p>
              </div>
              <div className="w-px h-12 bg-[#3d5a3d]" />
              <div className="text-center">
                <p className="text-[#88aa88] text-xs tracking-widest mb-1">OPP</p>
                <p className="text-white text-2xl md:text-4xl font-bold">{scoreToTennis(gameState.opponentScore)}</p>
                <p className="text-[#667766] text-xs mt-1">Games: {gameState.opponentGames}</p>
              </div>
            </div>
            {gameState.rally > 2 && (
              <p className="text-center text-[#c8e300] text-xs mt-2 animate-pulse">
                Rally: {gameState.rally}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Instructions / Serve Button */}
      {!ballState.inPlay && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto text-center">
            {showInstructions && (
              <div
                className="bg-[#1a2f1a]/95 backdrop-blur-md rounded-2xl px-6 py-6 md:px-10 md:py-8 mb-4 border border-[#3d5a3d]/50 max-w-[90vw] md:max-w-md"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                <h2
                  className="text-xl md:text-2xl mb-4 tracking-wide"
                  style={{ fontFamily: "'Playfair Display', serif", color: '#c8e300' }}
                >
                  How to Play
                </h2>
                <ul className="text-[#aaccaa] text-sm md:text-base space-y-2 text-left">
                  <li>• Move your racket with the mouse or touch</li>
                  <li>• Return the ball to score points</li>
                  <li>• First to win 4 points wins the game</li>
                  <li>• Use orbit controls to adjust camera view</li>
                </ul>
              </div>
            )}
            <button
              onClick={serveBall}
              className="group relative px-8 py-4 md:px-12 md:py-5 rounded-full transition-all duration-300 transform hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #c8e300 0%, #9ab800 100%)',
                boxShadow: '0 4px 20px rgba(200, 227, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
                fontFamily: "'Playfair Display', serif"
              }}
            >
              <span className="text-[#1a2f1a] font-bold text-base md:text-lg tracking-wider">
                {gameState.serving === 'player' ? 'SERVE' : 'RECEIVE'}
              </span>
              <div
                className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%)'
                }}
              />
            </button>
          </div>
        </div>
      )}

      {/* Rally indicator */}
      {ballState.inPlay && gameState.rally > 0 && (
        <div
          className="absolute left-1/2 top-20 -translate-x-1/2 bg-[#1a2f1a]/80 backdrop-blur-sm px-4 py-2 rounded-full border border-[#3d5a3d]/50"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          <span className="text-[#c8e300] text-sm">Rally {gameState.rally}</span>
        </div>
      )}

      {/* Mobile touch hint */}
      <div className="absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none md:hidden">
        {ballState.inPlay && (
          <p
            className="text-[#667766] text-xs bg-[#1a2f1a]/60 px-4 py-2 rounded-full"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Drag to move racket
          </p>
        )}
      </div>

      {/* Footer */}
      <footer
        className="absolute bottom-0 left-0 right-0 py-3 px-4 text-center"
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          background: 'linear-gradient(to top, rgba(10,31,10,0.9) 0%, transparent 100%)'
        }}
      >
        <p className="text-[#556655] text-xs tracking-wide">
          Requested by @Nishant293 · Built by @clonkbot
        </p>
      </footer>
    </div>
  )
}

import { Stage } from '../../core/Stage'
import { SoftClusterScene } from '../../core/soft/SoftCluster'

export default function SoftCluster() {
  return (
    <>
      <Stage renderer="webgl" camera={{ position: [0, 3.4, 3.9], fov: 34 }}>
        <SoftClusterScene />
      </Stage>
      <div data-chrome style={hint}>
        press · hold · let go · several fingers make chords
      </div>
    </>
  )
}

const hint: React.CSSProperties = {
  position: 'absolute',
  bottom: 20,
  width: '100%',
  textAlign: 'center',
  fontSize: 12,
  letterSpacing: 1.2,
  color: '#8a8078',
  pointerEvents: 'none',
}

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const LINE_COLOR = "#58585e";
const LINE_WIDTH = 1.2;

function makeStripeTexture(opacity = 0.35) {
  const size = 64;
  const spacing = 4;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = `rgba(88, 88, 94, ${opacity})`;
  ctx.lineWidth = 1;
  for (let y = 0; y < size; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(size, y + 0.5);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

function StripeFace({
  position,
  rotation,
  args,
  opacity,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  args: [number, number];
  opacity: number;
}) {
  const texture = useMemo(() => makeStripeTexture(opacity), [opacity]);

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={args} />
      <meshBasicMaterial
        map={texture}
        transparent
        side={THREE.FrontSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function StripedBox({
  width,
  height,
  depth,
  opacity,
}: {
  width: number;
  height: number;
  depth: number;
  opacity: number;
}) {
  const hx = width / 2 + 0.01;
  const hy = height / 2 + 0.01;
  const hz = depth / 2 + 0.01;
  const faces: Array<{
    pos: [number, number, number];
    rot: [number, number, number];
    args: [number, number];
  }> = [
    { pos: [0, 0, hz], rot: [0, 0, 0], args: [width, height] },
    { pos: [0, 0, -hz], rot: [0, Math.PI, 0], args: [width, height] },
    { pos: [hx, 0, 0], rot: [0, Math.PI / 2, 0], args: [depth, height] },
    { pos: [-hx, 0, 0], rot: [0, -Math.PI / 2, 0], args: [depth, height] },
    { pos: [0, hy, 0], rot: [-Math.PI / 2, 0, 0], args: [width, depth] },
    { pos: [0, -hy, 0], rot: [Math.PI / 2, 0, 0], args: [width, depth] },
  ];

  return (
    <>
      {faces.map((face, index) => (
        <StripeFace
          key={index}
          position={face.pos}
          rotation={face.rot}
          args={face.args}
          opacity={opacity}
        />
      ))}
    </>
  );
}

function SlowSpin({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.3;
    }
  });

  return <group ref={ref}>{children}</group>;
}

function StackedCubes() {
  return (
    <SlowSpin>
      <group rotation={[Math.PI * 0.15, Math.PI * 0.25, 0]}>
        {[0.5, 0, -0.5].map((y, index) => (
          <group key={index} position={[index * 0.12, y, -index * 0.12]}>
            <mesh>
              <boxGeometry args={[0.7, 0.35, 0.7]} />
              <meshBasicMaterial color="#0e0e10" toneMapped={false} />
              <Edges lineWidth={LINE_WIDTH} color={LINE_COLOR} />
            </mesh>
            <StripedBox width={0.7} height={0.35} depth={0.7} opacity={0.24} />
          </group>
        ))}
      </group>
    </SlowSpin>
  );
}

function CameraZoomController({ zoom }: { zoom: number }) {
  const { camera } = useThree();

  useEffect(() => {
    const orthographic = camera as THREE.OrthographicCamera;
    orthographic.zoom = zoom;
    orthographic.updateProjectionMatrix();
  }, [camera, zoom]);

  return null;
}

export default function LandingLogo3D({
  size = 760,
  zoom = 340,
}: {
  size?: number;
  zoom?: number;
}) {
  return (
    <div className="shrink-0" style={{ width: size, height: size }}>
      <Canvas
        flat
        orthographic
        dpr={[1.5, 2.5]}
        camera={{ position: [0, 0, 4], zoom }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <CameraZoomController zoom={zoom} />
        <StackedCubes />
      </Canvas>
    </div>
  );
}

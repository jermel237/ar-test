import React, { useRef, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

const ARPage1 = ({ data = [10, 20, 30, 40], capacity = 6, spacing = 2.0 }) => {
  const originalRef = useRef(data.slice());

  const boxes = useMemo(() => {
    const arr = originalRef.current;
    const n = capacity;
    const mid = (n - 1) / 2;
    return Array.from({ length: n }).map((_, i) => ({
      id: `b${i}`,
      value: i < arr.length ? arr[i] : null,
      x: (i - mid) * spacing,
      opacity: i < arr.length ? 1 : 0.2,
      isExtra: i >= arr.length,
    }));
  }, [capacity, spacing]);

  return (
    <div className="w-full h-screen">
      <Canvas
        camera={{ position: [0, 2, 6], fov: 50 }}
        gl={{ alpha: true }}
        shadows
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          if (navigator.xr) {
            navigator.xr
              .requestSession("immersive-ar", {
                requiredFeatures: ["hit-test", "local-floor"],
              })
              .then((session) => {
                gl.xr.setSession(session);
              })
              .catch((err) => console.error("❌ AR Session failed:", err));
          }
        }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={1} castShadow />

        <Reticle>
          {boxes.map((b, i) => (
            <Box
              key={b.id}
              value={b.value}
              index={i}
              position={[b.x, 0, 0]}
              opacity={b.opacity}
            />
          ))}
        </Reticle>
      </Canvas>
    </div>
  );
};

function Reticle({ children }) {
  const { gl } = useThree();
  const reticleRef = useRef();
  const [hitTestSource, setHitTestSource] = useState(null);
  const [hitTestSourceRequested, setHitTestSourceRequested] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [targetPos, setTargetPos] = useState(null);
  const [progress, setProgress] = useState(0);

  useFrame((_, delta) => {
    const session = gl.xr.getSession();
    if (!session) return;
    const frame = gl.xr.getFrame();
    if (!frame) return;

    if (!hitTestSourceRequested) {
      session.requestReferenceSpace("viewer").then((refSpace) => {
        session.requestHitTestSource({ space: refSpace }).then((source) => {
          setHitTestSource(source);
        });
      });
      setHitTestSourceRequested(true);
    }

    if (hitTestSource && !placed) {
      const referenceSpace = gl.xr.getReferenceSpace();
      const hits = frame.getHitTestResults(hitTestSource);

      if (hits.length > 0) {
        const hit = hits[0];
        const pose = hit.getPose(referenceSpace);

        reticleRef.current.visible = true;
        reticleRef.current.position.set(
          pose.transform.position.x,
          pose.transform.position.y,
          pose.transform.position.z
        );
        reticleRef.current.updateMatrixWorld(true);

        // ⏳ accumulate progress (2 seconds hold)
        setProgress((prev) => {
          const next = Math.min(prev + delta / 2, 1); // delta/2 = 2s fill
          if (next >= 1 && !placed) {
            setPlaced(true);
            setTargetPos(pose.transform.position);
          }
          return next;
        });
      } else {
        reticleRef.current.visible = false;
        setProgress(0);
      }
    }
  });

  return (
    <group>
      {/* Reticle ring */}
      <mesh ref={reticleRef} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.07, 0.1, 32]} />
        <meshBasicMaterial color="yellow" />
      </mesh>

      {/* Progress indicator (fills while holding on surface) */}
      {reticleRef.current && !placed && (
        <mesh position={reticleRef.current.position} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.05, 0.09, 32, 1, 0, Math.PI * 2 * progress]} />
          <meshBasicMaterial color="lime" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Place children after hold is complete */}
      {placed && targetPos && (
        <group
          position={[targetPos.x, targetPos.y, targetPos.z]}
          scale={[0.1, 0.1, 0.1]}
        >
          {children}
        </group>
      )}
    </group>
  );
}

const Box = ({ value, index, position, opacity = 1 }) => {
  const size = [1.6, 1.2, 1];
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#60a5fa" transparent opacity={opacity} />
      </mesh>
      {value !== null && (
        <>
          <Text
            position={[0, size[1] / 2 + 0.15, size[2] / 2 + 0.01]}
            fontSize={0.35}
            anchorX="center"
            anchorY="middle"
            color="#ffffff"
          >
            {value}
          </Text>
          <Text
            position={[0, size[1] / 2 - 0.35, size[2] / 2 + 0.01]}
            fontSize={0.2}
            anchorX="center"
            anchorY="middle"
            color="#ffffff"
          >
            [{index}]
          </Text>
        </>
      )}
    </group>
  );
};

export default ARPage1;

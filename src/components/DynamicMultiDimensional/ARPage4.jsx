import React, { useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";

// ---------- Reticle for AR placement ----------
function Reticle({ children }) {
  const { gl } = useThree();
  const reticleRef = useRef();
  const [hitTestSource, setHitTestSource] = useState(null);
  const [hitTestSourceRequested, setHitTestSourceRequested] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [targetPos, setTargetPos] = useState(null);
  const [progress, setProgress] = useState(0);

  useFrame((_, delta) => {
    if (placed) return;

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

    if (hitTestSource) {
      const referenceSpace = gl.xr.getReferenceSpace();
      const hits = frame.getHitTestResults(hitTestSource);

      if (hits.length > 0) {
        const hit = hits[0];
        const pose = hit.getPose(referenceSpace);

        if (reticleRef.current) {
          reticleRef.current.visible = true;
          reticleRef.current.position.set(
            pose.transform.position.x,
            pose.transform.position.y,
            pose.transform.position.z
          );
          reticleRef.current.updateMatrixWorld(true);
        }

        setProgress((prev) => {
          const next = Math.min(prev + delta / 2, 1); // ~2s hold
          if (next >= 1 && !placed) {
            setPlaced(true);
            setTargetPos(pose.transform.position);
            if (reticleRef.current) reticleRef.current.visible = false; // hide reticle
          }
          return next;
        });
      } else if (reticleRef.current) {
        reticleRef.current.visible = false;
        setProgress(0);
      }
    }
  });

  return (
    <group>
      {/* Reticle & progress indicator */}
      {!placed && (
        <>
          <mesh ref={reticleRef} rotation-x={-Math.PI / 2} visible={false}>
            <ringGeometry args={[0.07, 0.1, 32]} />
            <meshBasicMaterial color="yellow" />
          </mesh>
          {reticleRef.current && (
            <mesh
              position={reticleRef.current.position}
              rotation-x={-Math.PI / 2}
            >
              <ringGeometry
                args={[0.05, 0.09, 32, 1, 0, Math.PI * 2 * progress]}
              />
              <meshBasicMaterial color="lime" transparent opacity={0.8} />
            </mesh>
          )}
        </>
      )}

      {/* Placed content */}
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

// ---------- Main Component ----------
const ARPage4 = ({ rows = 3, cols = 3, depth = 3, spacing = 2.0 }) => {
  const initialCube = useRef(
    Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) =>
        Array.from(
          { length: depth },
          (_, d) => r * cols * depth + c * depth + d + 1
        )
      )
    )
  );

  const [cubes] = useState(() => create3DCubes(initialCube.current, spacing));

  function create3DCubes(cubeArray, spacingVal) {
    const midX = (cols - 1) / 2;
    const midY = (rows - 1) / 2;
    const midZ = (depth - 1) / 2;

    return cubeArray.flatMap((row, r) =>
      row.flatMap((col, c) =>
        col.map((value, z) => ({
          id: `cube-${r}-${c}-${z}`,
          value,
          position: [
            (c - midX) * spacingVal,
            (midY - r) * spacingVal,
            (z - midZ) * spacingVal,
          ],
        }))
      )
    );
  }

  return (
    <div className="w-full h-screen">
      <Canvas
        camera={{ position: [8, 8, 8], fov: 50 }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          if (navigator.xr) {
            navigator.xr
              .requestSession("immersive-ar", {
                requiredFeatures: ["hit-test", "local-floor"],
              })
              .then((session) => {
                gl.xr.setSession(session);
              });
          }
        }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />

        <Reticle>
          {cubes.map((b) => (
            <Box key={b.id} value={b.value} position={b.position} />
          ))}

          {/* Dimensional labels */}
          <Text
            position={[0, (rows / 2) * spacing + 2, 0]}
            fontSize={0.7}
            color="white"
            anchorX="center"
            anchorY="middle"
          >
            1st Dimensional
          </Text>
          <Text
            position={[-(cols / 2) * spacing - 2, 0, 0]}
            fontSize={0.7}
            color="white"
            anchorX="center"
            anchorY="middle"
            rotation={[0, 0, Math.PI / 2]}
          >
            2nd Dimensional
          </Text>
          <Text
            position={[(cols / 2) * spacing + 2, 0, 0]}
            fontSize={0.7}
            color="white"
            anchorX="center"
            anchorY="middle"
            rotation={[0, -Math.PI / 2, 0]}
            scale={[-1, 1, 1]}
          >
            3rd Dimensional
          </Text>
        </Reticle>
      </Canvas>
    </div>
  );
};

// ---------- Cube Box ----------
const Box = ({ value, position }) => {
  const size = [1.6, 1.2, 1];
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#60a5fa" />
      </mesh>
      <Text
        position={[0, size[1] / 2 + 0.15, size[2] / 2 + 0.01]}
        fontSize={0.25}
        anchorX="center"
        anchorY="middle"
        color="#ffffff"
      >
        {value}
      </Text>
    </group>
  );
};

export default ARPage4;

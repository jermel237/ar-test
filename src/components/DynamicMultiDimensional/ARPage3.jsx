import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

const ARVisualPage3 = ({
  rows = 3,
  cols = 4,
  spacing = 2.0,
  stepDuration = 1000,
}) => {
  const initialMatrix = useRef(
    Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => r * cols + c + 1)
    )
  );
  const [boxes, setBoxes] = useState(
    createGridBoxes(initialMatrix.current, spacing)
  );
  const [status, setStatus] = useState("");
  const [loopTrigger, setLoopTrigger] = useState(0);

  function createGridBoxes(matrix, spacingVal) {
    const nRows = matrix.length;
    const nCols = matrix[0].length;
    const midY = (nRows - 1) / 2;
    const midX = (nCols - 1) / 2;

    return matrix.flatMap((row, r) =>
      row.map((value, c) => ({
        id: `b${r}-${c}`,
        value,
        row: r,
        col: c,
        position: [(c - midX) * spacingVal, (midY - r) * spacingVal, 0],
        highlight: false,
      }))
    );
  }

  useEffect(() => {
    let cancelled = false;

    const runSequence = async () => {
      const matrix = initialMatrix.current;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (cancelled) return;

          setBoxes((prev) =>
            prev.map((b) => ({
              ...b,
              highlight: b.row === r && b.col === c,
            }))
          );
          setStatus(`Highlighting element at [${r}][${c}] → ${matrix[r][c]}`);

          await wait(stepDuration);
        }
      }

      setStatus("Resetting...");
      await wait(2000);

      if (!cancelled) {
        setBoxes(createGridBoxes(initialMatrix.current, spacing));
        setLoopTrigger((t) => t + 1); // restart loop
      }
    };

    runSequence();

    return () => {
      cancelled = true;
    };
  }, [loopTrigger, rows, cols, spacing, stepDuration]);

  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  return (
    <div className="w-full h-screen">
      <Canvas
        camera={{ position: [8, 0, 12], fov: 50 }}
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
        <directionalLight position={[5, 10, 5]} intensity={0.8} />

        <Reticle>
          {/* Status text above grid */}
          <Text
            position={[0, rows * spacing * 0.6, 0]}
            fontSize={0.35}
            anchorX="center"
            anchorY="middle"
            color="yellow"
          >
            {status}
          </Text>

          {/* Boxes */}
          {boxes.map((b) => (
            <Box
              key={b.id}
              value={b.value}
              position={b.position}
              highlight={b.highlight}
            />
          ))}

          {/* Row labels */}
          {Array.from({ length: rows }).map((_, r) => (
            <Text
              key={`row-label-${r}`}
              position={[
                -spacing * (cols / 2 + 0.8),
                ((rows - 1) / 2) * spacing - r * spacing,
                0,
              ]}
              fontSize={0.3}
              anchorX="center"
              anchorY="middle"
              color="#ffffff"
            >
              Row {r}
            </Text>
          ))}

          {/* Column labels */}
          {Array.from({ length: cols }).map((_, c) => (
            <Text
              key={`col-label-${c}`}
              position={[
                (c - (cols - 1) / 2) * spacing,
                spacing * (rows / 2 + 1.2),
                0,
              ]}
              fontSize={0.3}
              anchorX="center"
              anchorY="middle"
              color="#ffffff"
            >
              Col {c}
            </Text>
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
    if (placed) return; // ✅ Stop updating once placed

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
          const next = Math.min(prev + delta / 2, 1); // 2s hold
          if (next >= 1 && !placed) {
            setPlaced(true);
            setTargetPos(pose.transform.position);

            // ✅ Hide reticle permanently after placement
            if (reticleRef.current) reticleRef.current.visible = false;
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
      {/* Reticle ring (visible only before placement) */}
      {!placed && (
        <>
          <mesh ref={reticleRef} rotation-x={-Math.PI / 2} visible={false}>
            <ringGeometry args={[0.07, 0.1, 32]} />
            <meshBasicMaterial color="yellow" />
          </mesh>

          {/* Progress indicator */}
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

      {/* Placed children */}
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

const Box = ({ value, position, highlight }) => {
  const size = [1.6, 1.2, 1];
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={highlight ? "#f59e0b" : "#60a5fa"}
          transparent
          opacity={1}
        />
      </mesh>
      <Text
        position={[0, size[1] / 2 + 0.15, size[2] / 2 + 0.01]}
        fontSize={0.35}
        anchorX="center"
        anchorY="middle"
        color="#ffffff"
      >
        {value}
      </Text>
    </group>
  );
};

export default ARVisualPage3;

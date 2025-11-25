import React, { useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

const ARPage2 = ({
  data = [10, 20, 30, 40],
  spacing = 2.0,
  stepDuration = 1200, // ms per step
  extraSpace = 2,
}) => {
  const initialData = useRef(data.slice());
  const [boxes, setBoxes] = useState([]);
  const [status, setStatus] = useState("");
  const [loopTrigger, setLoopTrigger] = useState(0); // para ma-reset loop

  // Create boxes helper
  const createBoxes = (arr, capacityVal, spacingVal) => {
    const n = capacityVal;
    const mid = (n - 1) / 2;
    return Array.from({ length: n }).map((_, i) => ({
      id: `b${i}`,
      value: i < arr.length ? arr[i] : null,
      x: (i - mid) * spacingVal,
      opacity: i < arr.length ? 1 : 0.2,
    }));
  };

  // Animation loop (runs after placement)
  useEffect(() => {
    let cancelled = false;
    let currentArr = initialData.current.slice();
    const runAnimation = async () => {
      setBoxes(
        createBoxes(currentArr, currentArr.length + extraSpace, spacing)
      );
      setStatus("Appending values...");

      const valuesToAdd = [50, 60];
      for (let v = 0; v < valuesToAdd.length; v++) {
        if (cancelled) return;
        currentArr.push(valuesToAdd[v]);
        setBoxes(
          createBoxes(currentArr, currentArr.length + extraSpace, spacing)
        );
        setStatus(`Added ${valuesToAdd[v]} at index ${currentArr.length - 1}`);
        await new Promise((res) => setTimeout(res, stepDuration));
      }

      setStatus("Done!");
      await new Promise((res) => setTimeout(res, 2000));

      if (!cancelled) {
        setStatus("");
        setLoopTrigger((t) => t + 1); // restart loop
      }
    };

    runAnimation();
    return () => {
      cancelled = true;
    };
  }, [loopTrigger]);

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
          {/* Status text above array */}
          <Text
            position={[0, 2.5, 0]}
            fontSize={0.4}
            anchorX="center"
            anchorY="middle"
            color="yellow"
          >
            {status}
          </Text>

          {/* Boxes */}
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

        setProgress((prev) => {
          const next = Math.min(prev + delta / 2, 1); // 2s hold
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

      {/* Progress indicator */}
      {reticleRef.current && !placed && (
        <mesh position={reticleRef.current.position} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.05, 0.09, 32, 1, 0, Math.PI * 2 * progress]} />
          <meshBasicMaterial color="lime" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Place children */}
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

export default ARPage2;

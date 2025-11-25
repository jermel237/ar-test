// ARPage5.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Text, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const ARPage5 = ({
  data = [10, 20, 30, 40, 50],
  spacing = 2.0,
  deleteIndex = 2,
  loopDelay = 3000,
}) => {
  const [boxes, setBoxes] = useState(data);
  const [status, setStatus] = useState("Idle");
  const [highlightIndex, setHighlightIndex] = useState(null);
  const [phase, setPhase] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Structure position (whole structure moves together)
  const [structurePos, setStructurePos] = useState([0, 1, -2]);
  const [isDragging, setIsDragging] = useState(false);

  const structureRef = useRef();

  // positions update based on count
  const positions = useMemo(() => {
    const mid = (boxes.length - 1) / 2;
    return boxes.map((_, i) => [(i - mid) * spacing, 0, 0]);
  }, [boxes, spacing]);

  // Drag whole structure
  const onDragStart = () => {
    setIsDragging(true);
  };

  const onDragMove = (newPos) => {
    setStructurePos(newPos);
  };

  const onDragEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    // Don't run animation while dragging
    if (isDragging) return;

    const runSequence = async () => {
      setIsAnimating(true);
      setBoxes(data);
      setStatus(
        `Deleting value ${data[deleteIndex]} at index ${deleteIndex}...`
      );
      setHighlightIndex(deleteIndex);

      await delay(2000);

      if (isDragging) return; // Check if dragging started

      setHighlightIndex(null);
      setStatus(`Removing value ${data[deleteIndex]}...`);
      await delay(1000);

      if (isDragging) return;

      const newArr = data.filter((_, i) => i !== deleteIndex);
      setBoxes(newArr);

      setStatus("Shifting elements...");
      await delay(2000);

      if (isDragging) return;

      setStatus("✅ Deletion complete!");
      setIsAnimating(false);
      await delay(loopDelay);

      if (!isDragging) {
        setPhase((p) => p + 1); // restart loop
      }
    };

    runSequence();
  }, [phase, data, deleteIndex, loopDelay, isDragging]);

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
                requiredFeatures: ["local-floor"],
              })
              .then((session) => gl.xr.setSession(session))
              .catch((err) => console.error("❌ AR session failed:", err));
          }
        }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />

        {/* Whole structure group - moves together when dragging */}
        <group position={structurePos} scale={[0.1, 0.1, 0.1]} ref={structureRef}>
          {/* Status text floating above */}
          <Text
            position={[0, 3, 0]}
            fontSize={0.5}
            anchorX="center"
            anchorY="middle"
            color={isDragging ? "#f97316" : "white"}
          >
            {isDragging ? "✋ Moving Structure..." : status}
          </Text>

          {/* Boxes */}
          {boxes.map((value, i) => (
            <Box
              key={i}
              index={i}
              value={value}
              position={positions[i]}
              highlight={highlightIndex === i && !isDragging}
              isDragging={isDragging}
            />
          ))}

          {/* Ground plane */}
          <mesh rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[10, 10]} />
            <shadowMaterial opacity={isDragging ? 0.5 : 0.3} />
          </mesh>
        </group>

        <ARInteractionManager
          structureRef={structureRef}
          isDragging={isDragging}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />

        <OrbitControls makeDefault enabled={!isDragging} />
      </Canvas>
    </div>
  );
};

// === AR Interaction Manager with Drag and Drop ===
const ARInteractionManager = ({
  structureRef,
  isDragging,
  onDragStart,
  onDragMove,
  onDragEnd,
}) => {
  const { gl } = useThree();
  const longPressTimer = useRef(null);
  const touchedStructure = useRef(false);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    const onSessionStart = () => {
      const session = gl.xr.getSession();
      if (!session) return;

      // Get camera ray (center of phone screen)
      const getCameraRay = () => {
        const xrCamera = gl.xr.getCamera();
        const cam = xrCamera.cameras ? xrCamera.cameras[0] : xrCamera;
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
        const origin = cam.getWorldPosition(new THREE.Vector3());
        return { origin, dir };
      };

      // Check if pointing at structure
      const isPointingAtStructure = () => {
        const { origin, dir } = getCameraRay();
        const raycaster = new THREE.Raycaster();
        raycaster.set(origin, dir);

        if (structureRef.current) {
          const allMeshes = [];
          structureRef.current.traverse((child) => {
            if (child.isMesh) {
              allMeshes.push(child);
            }
          });
          const intersects = raycaster.intersectObjects(allMeshes, true);
          return intersects.length > 0;
        }
        return false;
      };

      // Calculate 3D position where phone is pointing
      const getPointPosition = () => {
        const { origin, dir } = getCameraRay();
        
        // Project ray to a distance (2 units in front, scaled)
        const distance = 2;
        const x = origin.x + dir.x * distance;
        const y = origin.y + dir.y * distance;
        const z = origin.z + dir.z * distance;
        
        return [x, y, z];
      };

      // Touch start
      const onSelectStart = () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
        }

        const hitStructure = isPointingAtStructure();
        touchedStructure.current = hitStructure;

        // If touching structure, start long press for drag
        if (hitStructure) {
          longPressTimer.current = setTimeout(() => {
            onDragStart();
            longPressTimer.current = null;
          }, 500);
        }
      };

      // Touch end
      const onSelectEnd = () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }

        if (isDraggingRef.current) {
          // Drop structure at current position
          onDragEnd();
        }

        touchedStructure.current = false;
      };

      session.addEventListener("selectstart", onSelectStart);
      session.addEventListener("selectend", onSelectEnd);

      // Frame loop - move structure while dragging
      const onFrame = (time, frame) => {
        if (isDraggingRef.current) {
          const newPos = getPointPosition();
          onDragMove(newPos);
        }
        session.requestAnimationFrame(onFrame);
      };
      session.requestAnimationFrame(onFrame);

      session.addEventListener("end", () => {
        session.removeEventListener("selectstart", onSelectStart);
        session.removeEventListener("selectend", onSelectEnd);
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
        }
      });
    };

    gl.xr.addEventListener("sessionstart", onSessionStart);

    return () => {
      gl.xr.removeEventListener("sessionstart", onSessionStart);
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, [gl, structureRef, onDragStart, onDragMove, onDragEnd]);

  return null;
};

const Box = ({ index, value, position, highlight, isDragging }) => {
  const size = [1.6, 1.2, 1];
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={isDragging ? "#94a3b8" : highlight ? "#f87171" : "#60a5fa"}
          emissive={highlight && !isDragging ? "#facc15" : isDragging ? "#f97316" : "#000000"}
          emissiveIntensity={highlight && !isDragging ? 0.9 : isDragging ? 0.2 : 0}
        />
      </mesh>

      <Text
        position={[0, size[1] / 2 + 0.15, size[2] / 2 + 0.01]}
        fontSize={0.35}
        anchorX="center"
        anchorY="middle"
        color="white"
      >
        {String(value)}
      </Text>

      <Text
        position={[0, size[1] / 2 - 0.35, size[2] / 2 + 0.01]}
        fontSize={0.2}
        anchorX="center"
        anchorY="middle"
        color="#e0e0e0"
      >
        {`[${index}]`}
      </Text>
    </group>
  );
};

// small delay utility
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default ARPage5;

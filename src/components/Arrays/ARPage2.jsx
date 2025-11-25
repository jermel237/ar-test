import React, { useMemo, useState, useRef, useEffect, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const ARPage2 = ({ data = [10, 20, 30, 40, 50], spacing = 2.0 }) => {
  const [selectedBox, setSelectedBox] = useState(null);
  
  // Structure position (whole array moves together)
  const [structurePos, setStructurePos] = useState([0, 0, -8]);
  const [isDragging, setIsDragging] = useState(false);

  // === Compute box positions ===
  const positions = useMemo(() => {
    const mid = (data.length - 1) / 2;
    return data.map((_, i) => [(i - mid) * spacing, 0, 0]);
  }, [data, spacing]);

  // === Box references for AR raycasting ===
  const boxRefs = useRef([]);
  const structureRef = useRef();
  
  const addBoxRef = (r) => {
    if (r && !boxRefs.current.includes(r)) boxRefs.current.push(r);
  };

  // === Generate pseudo code when a box is tapped ===
  const generateCode = (index, value) => {
    return [
      "📘 Pseudo Code Example:",
      "",
      "array = [10, 20, 30, 40, 50]",
      `index = ${index}`,
      "",
      "value = array[index]",
      "print('Accessed Value:', value)",
      "",
      `// Result: ${value}`,
    ].join("\n");
  };

  // Drag whole structure
  const onDragStart = () => {
    setIsDragging(true);
    setSelectedBox(null);
  };

  const onDragMove = (newPos) => {
    setStructurePos(newPos);
  };

  const onDragEnd = () => {
    setIsDragging(false);
  };

  // === Auto-start AR session ===
  const startAR = (gl) => {
    if (navigator.xr) {
      navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
        if (supported) {
          navigator.xr
            .requestSession("immersive-ar", {
              requiredFeatures: ["hit-test", "local-floor"],
            })
            .then((session) => {
              gl.xr.setSession(session);
            })
            .catch((err) => console.error("AR session failed:", err));
        } else {
          console.warn("AR not supported on this device.");
        }
      });
    }
  };

  return (
    <div className="w-full h-[300px]">
      <Canvas
        camera={{ position: [0, 4, 12], fov: 50 }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          startAR(gl);
        }}
      >
        {/* === Lights === */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />

        {/* === Scene Content - Whole structure moves together === */}
        <group position={structurePos} ref={structureRef}>
          <FadeText
            text="Array Access Operation (O(1))"
            position={[0, 4, -2]}
            fontSize={0.6}
            color="#facc15"
          />
          <FadeText
            text={isDragging ? "✋ Moving Structure..." : "Tap a box to view its value and pseudo code"}
            position={[0, 3.2, -2]}
            fontSize={0.35}
            color={isDragging ? "#f97316" : "white"}
          />

          {/* NO ArrayBackground - REMOVED */}

          {data.map((value, i) => (
            <Box
              key={i}
              index={i}
              value={value}
              position={positions[i]}
              selected={selectedBox === i}
              onClick={() => {
                if (!isDragging) {
                  setSelectedBox((prev) => (prev === i ? null : i));
                }
              }}
              ref={(r) => addBoxRef(r)}
            />
          ))}

          {selectedBox !== null && !isDragging && (
            <CodePanel
              code={generateCode(selectedBox, data[selectedBox])}
              position={[8, 1, 0]}
            />
          )}
        </group>

        <ARInteractionManager
          boxRefs={boxRefs}
          structureRef={structureRef}
          setSelectedBox={setSelectedBox}
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

// === AR Interaction Manager ===
const ARInteractionManager = ({
  boxRefs,
  structureRef,
  setSelectedBox,
  isDragging,
  onDragStart,
  onDragMove,
  onDragEnd
}) => {
  const { gl } = useThree();
  const longPressTimer = useRef(null);
  const touchedBox = useRef(null);
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

      // Check if pointing at any box
      const getHitBox = () => {
        const { origin, dir } = getCameraRay();
        const raycaster = new THREE.Raycaster();
        raycaster.set(origin, dir);

        const allMeshes = [];
        boxRefs.current.forEach((group) => {
          if (group && group.children) {
            group.children.forEach((child) => {
              allMeshes.push(child);
            });
          }
        });

        const hits = raycaster.intersectObjects(allMeshes, true);
        if (hits.length > 0) {
          let obj = hits[0].object;
          while (obj) {
            if (obj.userData?.boxIndex !== undefined) {
              return obj.userData.boxIndex;
            }
            obj = obj.parent;
          }
          return -1; // Hit structure but not specific box
        }
        return null;
      };

      // Calculate 3D position where phone is pointing
      const getPointPosition = () => {
        const { origin, dir } = getCameraRay();
        
        // Project ray to a distance (8 units in front)
        const distance = 8;
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

        const hitBox = getHitBox();
        touchedBox.current = hitBox;

        // If touching any part of structure, start long press for drag
        if (hitBox !== null) {
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
        } else if (touchedBox.current !== null && touchedBox.current >= 0) {
          // Short tap on box - select it
          setSelectedBox((prev) => (prev === touchedBox.current ? null : touchedBox.current));
        }

        touchedBox.current = null;
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
  }, [gl, boxRefs, structureRef, setSelectedBox, onDragStart, onDragMove, onDragEnd]);

  return null;
};

// === Box Component ===
const Box = forwardRef(({ index, value, position, selected, onClick }, ref) => {
  const size = [1.6, 1.2, 1];
  const color = selected ? "#f87171" : index % 2 === 0 ? "#60a5fa" : "#34d399";
  const groupRef = useRef();

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.userData = { boxIndex: index };
    }
  }, [index]);

  return (
    <group
      position={position}
      ref={(g) => {
        groupRef.current = g;
        if (typeof ref === "function") ref(g);
        else if (ref) ref.current = g;
      }}
    >
      <mesh
        castShadow
        receiveShadow
        position={[0, size[1] / 2, 0]}
        onClick={onClick}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? "#fbbf24" : "#000000"}
          emissiveIntensity={selected ? 0.6 : 0}
        />
      </mesh>

      <Text
        position={[0, size[1] / 2 + 0.1, size[2] / 2 + 0.01]}
        fontSize={0.4}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {String(value)}
      </Text>

      <Text
        position={[0, size[1] / 2 - 0.35, size[2] / 2 + 0.02]}
        fontSize={0.25}
        color="#fde68a"
        anchorX="center"
        anchorY="middle"
      >
        [{index}]
      </Text>

      {selected && (
        <Text
          position={[0, size[1] + 0.8, 0]}
          fontSize={0.32}
          color="#fde68a"
          anchorX="center"
          anchorY="middle"
        >
          Value {value} at index {index}
        </Text>
      )}
    </group>
  );
});

// === Code Panel ===
const CodePanel = ({ code, position }) => (
  <FadeText text={code} position={position} fontSize={0.3} color="#c7d2fe" />
);

// === Fade-in Text ===
const FadeText = ({ text, position, fontSize = 0.5, color = "white" }) => {
  const [opacity, setOpacity] = useState(0);
  useEffect(() => {
    let frame;
    let start;
    const duration = 1000;
    const animate = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setOpacity(progress);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <Text
      position={position}
      fontSize={fontSize}
      color={color}
      anchorX="center"
      anchorY="middle"
      fillOpacity={opacity}
      maxWidth={10}
      textAlign="left"
    >
      {text}
    </Text>
  );
};

export default ARPage2;

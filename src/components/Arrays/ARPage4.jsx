// ARPage4.jsx (WITH DRAG AND DROP)

import React, { useMemo, useState, useRef, useEffect, forwardRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Text, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import useSound from "use-sound";
import dingSfx from "/sounds/ding.mp3";

const MAX_INDEX = 6;

const ARPage4 = ({ spacing = 2.2 }) => {
  const [data, setData] = useState([23, 46, 13]);
  const [pseudoCode, setPseudoCode] = useState([]);
  const [highlightIndex, setHighlightIndex] = useState(null);
  const boxRefs = useRef([]);
  const structureRef = useRef();
  const [play] = useSound(dingSfx, { volume: 0.5 });

  // Structure position (whole structure moves together)
  const [structurePos, setStructurePos] = useState([0, 0, -8]);
  const [isDragging, setIsDragging] = useState(false);

  const addBoxRef = (r) => {
    if (r && !boxRefs.current.includes(r)) boxRefs.current.push(r);
  };

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

  const handleAppend = () => {
    if (data.length >= MAX_INDEX || isDragging) return;

    const newValue = Math.floor(Math.random() * 90) + 10;

    setData((prev) => {
      const newArray = [...prev, newValue];
      const insertIndex = newArray.length - 1;
      setHighlightIndex(insertIndex);
      setTimeout(() => setHighlightIndex(null), 1000);

      const pseudo = [
        "📘 PSEUDOCODE",
        "",
        `array = [${newArray.join(", ")}]`,
        `index = ${insertIndex}`,
        "",
        `value = array[index]`,
        `print("Inserted Value:", value)`,
        "",
        `// Result: ${newValue}`,
      ];
      setPseudoCode(pseudo);

      return newArray;
    });

    play();
  };

  const positions = useMemo(() => {
    const mid = (data.length - 1) / 2;
    return data.map((_, i) => [(i - mid) * spacing, 0, 0]);
  }, [data, spacing]);

  const startAR = (gl) => {
    if (!navigator.xr) return;
    navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
      if (supported) {
        navigator.xr
          .requestSession("immersive-ar", { requiredFeatures: ["hit-test", "local-floor"] })
          .then((session) => gl.xr.setSession(session))
          .catch((err) => console.error("AR session failed:", err));
      }
    });
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
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />

        {/* Whole structure group - moves together when dragging */}
        <group position={structurePos} ref={structureRef}>
          <FadeText 
            text="Insertion Operation" 
            position={[0, 3, -2]} 
            fontSize={0.6} 
            color="#eeeeeeff" 
          />

          {/* Dragging indicator */}
          {isDragging && (
            <FadeText
              text="✋ Moving Structure..."
              position={[0, 2.3, -2]}
              fontSize={0.4}
              color="#f97316"
            />
          )}

          {data.map((value, i) => (
            <Box
              key={i}
              index={i}
              value={value}
              position={positions[i]}
              highlight={highlightIndex === i}
              ref={(r) => addBoxRef(r)}
            />
          ))}

          {data.length < MAX_INDEX && !isDragging && (
            <AppendBox
              index={data.length}
              position={[((data.length - 1) / 2) * spacing + spacing, 0, 0]}
              onAppend={handleAppend}
              ref={(r) => addBoxRef(r)}
            />
          )}

          {pseudoCode.length > 0 && !isDragging &&
            pseudoCode.map((line, i) => (
              <FadeText
                key={i}
                text={line}
                position={[0, -1.5 - i * 0.35, -2]}
                fontSize={0.28}
                color={line.startsWith("//")
                  ? "#8ef5b8"
                  : line.startsWith("array") ||
                    line.startsWith("index") ||
                    line.startsWith("value") ||
                    line.startsWith("print")
                  ? "#ffeb99"
                  : "#9be7a2"
                }
              />
            ))}
        </group>

        <ARInteractionManager 
          boxRefs={boxRefs} 
          structureRef={structureRef}
          handleAppend={handleAppend}
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

/* ---------------- AR Interaction Manager ---------------- */
const ARInteractionManager = ({ 
  boxRefs, 
  structureRef,
  handleAppend,
  isDragging,
  onDragStart,
  onDragMove,
  onDragEnd
}) => {
  const { gl } = useThree();
  const longPressTimer = useRef(null);
  const touchedAppend = useRef(false);
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

      // Check what we hit
      const getHitInfo = () => {
        const { origin, dir } = getCameraRay();
        const raycaster = new THREE.Raycaster();
        raycaster.set(origin, dir);

        const candidates = (boxRefs.current || []).map((group) => group?.children || []).flat();
        const intersects = raycaster.intersectObjects(candidates, true);
        
        if (intersects.length > 0) {
          const target = intersects[0].object.parent;
          if (target?.userData?.isAppend) {
            return { type: 'append' };
          }
          if (target?.userData?.boxIndex !== undefined) {
            return { type: 'box', index: target.userData.boxIndex };
          }
          return { type: 'structure' };
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

        const hitInfo = getHitInfo();
        touchedAppend.current = hitInfo?.type === 'append';
        touchedStructure.current = hitInfo !== null;

        // If touching any part of structure, start long press for drag
        if (hitInfo !== null) {
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
        } else if (touchedAppend.current) {
          // Short tap on append button
          handleAppend();
        }

        touchedAppend.current = false;
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
  }, [gl, boxRefs, structureRef, handleAppend, onDragStart, onDragMove, onDragEnd]);

  return null;
};

/* ---------------- Append Box ---------------- */
const AppendBox = forwardRef(({ position, onAppend }, ref) => {
  const groupRef = useRef();
  useEffect(() => { if (groupRef.current) groupRef.current.userData = { isAppend: true }; }, []);

  return (
    <group
      position={position}
      ref={(g) => { groupRef.current = g; if (typeof ref === "function") ref(g); else if (ref) ref.current = g; }}
    >
      <mesh onClick={onAppend}>
        <boxGeometry args={[1.6, 1.2, 1]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>
      <Text position={[0, 0.1, 0.6]} fontSize={0.35} color="white">Append</Text>
    </group>
  );
});

/* ---------------- Value Box (Numbers in Front) ---------------- */
const Box = forwardRef(({ index, value, position, highlight }, ref) => {
  const groupRef = useRef();
  const size = [1.6, 1.2, 1];

  useEffect(() => { if (groupRef.current) groupRef.current.userData = { boxIndex: index }; }, [index]);

  useFrame(() => {
    if (!groupRef.current) return;
    const mesh = groupRef.current.children[0];
    if (!mesh) return;
    const baseColor = index % 2 === 0 ? "#60a5fa" : "#34d399";
    const targetColor = highlight ? new THREE.Color("#f87171") : new THREE.Color(baseColor);
    mesh.material.color.lerp(targetColor, 0.15);
    mesh.material.emissive = mesh.material.emissive || new THREE.Color(0x000000);
    mesh.material.emissive.lerp(targetColor, 0.1);
    mesh.material.emissiveIntensity = highlight ? 0.6 : 0;
  });

  return (
    <group position={position} ref={(g) => { groupRef.current = g; if (typeof ref === "function") ref(g); else if (ref) ref.current = g; }}>
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial color={index % 2 === 0 ? "#60a5fa" : "#34d399"} />
      </mesh>

      {/* Value Text in FRONT */}
      <Text position={[0, size[1] / 2 - 0.35, size[2] / 2 + 0.01]} fontSize={0.4} color="white" anchorX="center" anchorY="middle">
        {String(value)}
      </Text>

      {/* Index Text in FRONT */}
      <Text position={[0, -size[1] / 2 + 0.15, size[2] / 2 + 0.05]} fontSize={0.22} color="#e0e0e0" anchorX="center" anchorY="middle">
        [{index}]
      </Text>
    </group>
  );
});

/* ---------------- Fade Text ---------------- */
const FadeText = ({ text, position, fontSize = 0.5, color = "white" }) => (
  <Text position={position} fontSize={fontSize} color={color} anchorX="center" anchorY="middle">{text}</Text>
);

export default ARPage4;

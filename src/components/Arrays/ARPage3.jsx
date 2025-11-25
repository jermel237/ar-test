// ARPage3.jsx
import React, { useMemo, useState, useRef, useEffect, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import useSound from "use-sound";
import dingSfx from "/sounds/ding.mp3";

const ARPage3 = ({ data = [5, 10, 15, 20, 25], spacing = 2.0 }) => {
  // Search state
  const [searching, setSearching] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(null);
  const [foundIndex, setFoundIndex] = useState(null);
  const [statusText, setStatusText] = useState("");
  const [infoText, setInfoText] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [pseudoCode, setPseudoCode] = useState([]);
  const [play] = useSound(dingSfx, { volume: 0.5 });

  // Structure position (whole structure moves together)
  const [structurePos, setStructurePos] = useState([0, 0, -10]);
  const [isDragging, setIsDragging] = useState(false);

  // Positions computed once
  const positions = useMemo(() => {
    const mid = (data.length - 1) / 2;
    return data.map((_, i) => [(i - mid) * spacing, 0, 0]);
  }, [data, spacing]);

  // refs for AR raycasting (groups)
  const boxRefs = useRef([]);
  const structureRef = useRef();
  
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

  // === Linear search animation ===
  const startSearch = (targetIndex) => {
    if (searching || isDragging) return;
    setSearching(true);
    setHighlightIndex(null);
    setFoundIndex(null);
    setStatusText("");
    setInfoText("");
    setShowCode(false);

    let i = 0;
    setStatusText("🔍 Starting linear search...");

    const interval = setInterval(() => {
      setHighlightIndex(i);
      setStatusText(`Checking index ${i} → value ${data[i]}`);

      if (i === targetIndex) {
        clearInterval(interval);
        setTimeout(() => {
          setFoundIndex(i);
          play();
          setStatusText(`✅ Found value ${data[i]} at index ${i}`);
          setInfoText(`Value ${data[i]} located after ${i + 1} comparisons`);
          setPseudoCode([
            "📘 Pseudo Code Example:",
            "",
            "for i = 0 to n-1:",
            "   if array[i] == key:",
            "       return i",
            "",
            `// Found at index ${i}`,
          ]);
          setShowCode(true);
          setSearching(false);
        }, 900);
      } else {
        i++;
        if (i >= data.length) {
          clearInterval(interval);
          setTimeout(() => {
            setStatusText("❌ Value not found in array");
            setInfoText("Search completed — no match found.");
            setPseudoCode([
              "📘 Pseudo Code Example:",
              "",
              "for i = 0 to n-1:",
              "   if array[i] == key:",
              "       return i",
              "",
              "return -1  // not found",
            ]);
            setShowCode(true);
            setSearching(false);
          }, 800);
        }
      }
    }, 900);
  };

  // Auto-start WebXR AR session when possible
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
        camera={{ position: [0, 4, 10], fov: 50 }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          startAR(gl);
        }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={0.8} />

        {/* Whole structure group - moves together when dragging */}
        <group position={structurePos} ref={structureRef}>
          {/* Title */}
          <FadeText 
            text="Search Operation (Linear Search)" 
            position={[0, 3, 2]} 
            fontSize={0.55} 
            color="white" 
          />

          {/* Instruction or Dragging indicator */}
          <FadeText
            text={
              isDragging 
                ? "✋ Moving Structure..." 
                : !searching && !foundIndex && !infoText 
                  ? "Tap any box to start searching..." 
                  : ""
            }
            position={[0, 2.4, 2]}
            fontSize={0.3}
            color={isDragging ? "#f97316" : "#ffd166"}
          />

          {/* Transition label */}
          <FadeText 
            showText={!!statusText && !isDragging} 
            text={statusText} 
            position={[0, 2, 2]} 
            fontSize={0.32} 
            color="#ffd166" 
          />

          {/* Boxes */}
          {data.map((value, i) => (
            <Box
              key={i}
              index={i}
              value={value}
              position={positions[i]}
              highlight={highlightIndex === i}
              found={foundIndex === i}
              disabled={searching || isDragging}
              onClick={() => startSearch(i)}
              ref={(r) => addBoxRef(r)}
            />
          ))}

          {/* Info / pseudo code to the right when search finishes */}
          {showCode && !isDragging && (
            <group position={[8, 1.2, 0]}>
              <FadeText text={infoText} position={[0, 0.8, 0]} fontSize={0.35} color="#9be7a2" />
              {pseudoCode.map((line, idx) => (
                <FadeText 
                  key={idx} 
                  text={line} 
                  position={[0, 0.4 - idx * 0.35, 0]} 
                  fontSize={0.28} 
                  color={line.startsWith("//") ? "#9be7a2" : "#ffeb99"} 
                />
              ))}
            </group>
          )}
        </group>

        {/* AR Interaction Manager handles XR select events */}
        <ARInteractionManager 
          boxRefs={boxRefs} 
          structureRef={structureRef}
          startSearch={startSearch}
          isDragging={isDragging}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          searching={searching}
        />
        <OrbitControls makeDefault enabled={!isDragging} />
      </Canvas>
    </div>
  );
};

// === ARInteractionManager ===
const ARInteractionManager = ({ 
  boxRefs, 
  structureRef,
  startSearch,
  isDragging,
  onDragStart,
  onDragMove,
  onDragEnd,
  searching
}) => {
  const { gl } = useThree();
  const longPressTimer = useRef(null);
  const touchedBox = useRef(null);
  const isDraggingRef = useRef(false);
  const searchingRef = useRef(false);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    searchingRef.current = searching;
  }, [searching]);

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
        
        // Project ray to a distance (10 units in front)
        const distance = 10;
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

        // If touching any part of structure and not searching, start long press for drag
        if (hitBox !== null && !searchingRef.current) {
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
        } else if (touchedBox.current !== null && touchedBox.current >= 0 && !searchingRef.current) {
          // Short tap on box - start search
          startSearch(touchedBox.current);
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
  }, [gl, boxRefs, structureRef, startSearch, onDragStart, onDragMove, onDragEnd]);

  return null;
};

// === Box ===
const Box = forwardRef(({ index, value, position, highlight, found, disabled, onClick }, ref) => {
  const meshRef = useRef();
  const groupRef = useRef();
  const size = [1.6, 1.2, 1];

  useEffect(() => {
    // attach index to group for raycasting detection
    if (groupRef.current) {
      groupRef.current.userData = { boxIndex: index };
    }
  }, [index]);

  useFrame(() => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material;
    const baseColor = new THREE.Color(index % 2 === 0 ? "#60a5fa" : "#34d399");
    const targetColor = found ? new THREE.Color("#fbbf24") : highlight ? new THREE.Color("#f87171") : baseColor;
    const targetEmissive = highlight || found ? 0.9 : 0;
    mat.color.lerp(targetColor, 0.12);
    mat.emissive = mat.emissive || new THREE.Color(0x000000);
    mat.emissive.lerp(targetColor, 0.12);
    mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity || 0, targetEmissive, 0.12);
  });

  return (
    <group
      position={position}
      ref={(g) => {
        groupRef.current = g;
        if (typeof ref === "function") ref(g);
        else if (ref) ref.current = g;
      }}
      onClick={!disabled ? onClick : undefined}
    >
      <mesh ref={meshRef} castShadow receiveShadow position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={"#60a5fa"} emissive={"#000"} />
      </mesh>

      <Text position={[0, size[1] / 2 + 0.1, size[2] / 2 + 0.01]} fontSize={0.35} anchorX="center" anchorY="middle">
        {String(value)}
      </Text>

      <Text position={[0, size[1] / 2 - 0.35, size[2] / 2 + 0.01]} fontSize={0.22} anchorX="center" anchorY="middle" color="#e0e0e0">
        [{index}]
      </Text>
    </group>
  );
});

// === FadeText (simple fade-in for AR scene) ===
const FadeText = ({ text = "", position = [0, 0, 0], fontSize = 0.5, color = "white", showText = true }) => {
  const [opacity, setOpacity] = useState(0);
  useEffect(() => {
    let frame;
    let start;
    const duration = 800;
    const animate = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setOpacity(progress);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    if (showText) frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [showText]);

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

export default ARPage3;

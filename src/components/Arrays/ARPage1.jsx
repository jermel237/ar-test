import React, { useMemo, useState, useRef, useEffect, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

const VisualPageAR = ({ data = [10, 20, 30, 40], spacing = 2.0 }) => {
  const [showPanel, setShowPanel] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedBox, setSelectedBox] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedBox, setDraggedBox] = useState(null);
  const boxRefs = useRef([]);
  const [boxPositions, setBoxPositions] = useState(null);

  // --- Helper to collect box refs ---
  const addBoxRef = (index, r) => {
    if (r) {
      boxRefs.current[index] = r;
    }
  };

  // Initialize box positions
  const initialPositions = useMemo(() => {
    const mid = (data.length - 1) / 2;
    return data.map((_, i) => [(i - mid) * spacing, 0, 0]);
  }, [data, spacing]);

  useEffect(() => {
    if (!boxPositions) {
      setBoxPositions([...initialPositions]);
    }
  }, [initialPositions, boxPositions]);

  const handleClick = (i) => {
    if (!isDragging) {
      setSelectedBox(i);
      setShowPanel(true);
      setPage(0);
    }
  };

  const handleNextClick = () => {
    if (page < 2) setPage(page + 1);
    else setShowPanel(false);
  };

  // === Automatically start AR session ===
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

  // Update box position
  const updateBoxPosition = (index, newPos) => {
    setBoxPositions((prev) => {
      if (!prev) return prev;
      const updated = [...prev];
      updated[index] = newPos;
      return updated;
    });
  };

  const currentPositions = boxPositions || initialPositions;

  return (
    <div className="w-full h-[300px] relative">
      {/* Crosshair UI */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 100,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: isDragging ? "30px" : "20px",
            height: isDragging ? "30px" : "20px",
            border: isDragging ? "3px solid #ff6b6b" : "2px solid white",
            borderRadius: "50%",
            backgroundColor: isDragging ? "rgba(255,107,107,0.3)" : "transparent",
            transition: "all 0.2s ease",
          }}
        />
      </div>

      {/* Drag instruction */}
      {isDragging && (
        <div
          style={{
            position: "absolute",
            top: "60%",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
            color: "#ff6b6b",
            fontSize: "14px",
            fontWeight: "bold",
            textShadow: "0 0 5px black",
            pointerEvents: "none",
          }}
        >
          Move device to drag • Tap to release
        </div>
      )}

      {/* Hold instruction */}
      {selectedBox !== null && !isDragging && !showPanel && (
        <div
          style={{
            position: "absolute",
            top: "60%",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
            color: "#fde68a",
            fontSize: "12px",
            textShadow: "0 0 5px black",
            pointerEvents: "none",
          }}
        >
          Long press to drag
        </div>
      )}

      <Canvas
        camera={{ position: [0, 4, 25], fov: 50 }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          startAR(gl);
        }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />

        <group position={[0, 0, -8]}>
          <FadeInText
            show={true}
            text={"Array Data Structure"}
            position={[0, 3, 0]}
            fontSize={0.7}
            color="white"
          />

          <ArrayBackground data={data} spacing={spacing} />

          {data.map((value, i) => (
            <Box
              key={i}
              index={i}
              value={value}
              position={currentPositions[i]}
              selected={selectedBox === i}
              isDragging={draggedBox === i}
              onClick={() => handleClick(i)}
              ref={(r) => addBoxRef(i, r)}
            />
          ))}

          {showPanel && selectedBox !== null && !isDragging && (
            <DefinitionPanel
              page={page}
              data={data}
              index={selectedBox}
              position={[8, 1, 0]}
              onNextClick={handleNextClick}
            />
          )}
        </group>

        {/* Center Crosshair Interaction System */}
        <CenterCrosshairDragSystem
          boxRefs={boxRefs}
          selectedBox={selectedBox}
          setSelectedBox={setSelectedBox}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          draggedBox={draggedBox}
          setDraggedBox={setDraggedBox}
          updateBoxPosition={updateBoxPosition}
          setShowPanel={setShowPanel}
        />

        <OrbitControls makeDefault enabled={!isDragging} />
      </Canvas>
    </div>
  );
};

// --- Center Crosshair Drag System ---
const CenterCrosshairDragSystem = ({
  boxRefs,
  selectedBox,
  setSelectedBox,
  isDragging,
  setIsDragging,
  draggedBox,
  setDraggedBox,
  updateBoxPosition,
  setShowPanel,
}) => {
  const { camera, gl, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const holdTimer = useRef(null);
  const holdStartTime = useRef(0);
  const isHolding = useRef(false);
  const dragDistance = useRef(3); // Distance from camera when dragging

  // Raycast from center of screen
  const raycastFromCenter = () => {
    // Center of screen is (0, 0) in normalized device coordinates
    raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);

    // Get all box meshes
    const meshes = [];
    boxRefs.current.forEach((group, index) => {
      if (group) {
        group.traverse((child) => {
          if (child.isMesh) {
            child.userData.boxIndex = index;
            meshes.push(child);
          }
        });
      }
    });

    const intersects = raycaster.current.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      let hit = intersects[0].object;
      while (hit && hit.userData?.boxIndex === undefined && hit.parent) {
        hit = hit.parent;
      }
      return {
        index: hit?.userData?.boxIndex,
        point: intersects[0].point,
        distance: intersects[0].distance,
      };
    }
    return null;
  };

  // Handle touch/click start (long press detection)
  const handlePointerDown = (e) => {
    if (isDragging) {
      // If already dragging, release on tap
      releaseDrag();
      return;
    }

    const hit = raycastFromCenter();
    if (hit && hit.index !== undefined) {
      holdStartTime.current = Date.now();
      isHolding.current = true;
      dragDistance.current = hit.distance;

      // Start hold timer for drag initiation
      holdTimer.current = setTimeout(() => {
        if (isHolding.current) {
          // Long press detected - start dragging
          setDraggedBox(hit.index);
          setIsDragging(true);
          setSelectedBox(hit.index);
          setShowPanel(false);
        }
      }, 500); // 500ms hold time to start drag
    }
  };

  // Handle touch/click end
  const handlePointerUp = () => {
    const holdDuration = Date.now() - holdStartTime.current;
    isHolding.current = false;

    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }

    // If it was a quick tap (not a long press) and not dragging
    if (holdDuration < 500 && !isDragging) {
      const hit = raycastFromCenter();
      if (hit && hit.index !== undefined) {
        setSelectedBox(hit.index);
        setShowPanel(true);
      }
    }
  };

  // Release drag
  const releaseDrag = () => {
    if (draggedBox !== null) {
      const group = boxRefs.current[draggedBox];
      if (group) {
        const localPos = group.position;
        updateBoxPosition(draggedBox, [localPos.x, localPos.y, localPos.z]);
      }
    }
    setIsDragging(false);
    setDraggedBox(null);
  };

  // Setup event listeners
  useEffect(() => {
    const canvas = gl.domElement;

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
      if (holdTimer.current) {
        clearTimeout(holdTimer.current);
      }
    };
  }, [gl, isDragging, draggedBox]);

  // Update dragged box position every frame (follows camera center)
  useFrame(() => {
    if (!isDragging || draggedBox === null) return;

    const group = boxRefs.current[draggedBox];
    if (!group) return;

    // Get the point in front of camera center
    raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);
    const direction = raycaster.current.ray.direction.clone();
    const origin = raycaster.current.ray.origin.clone();

    // Calculate new world position
    const newWorldPos = origin.add(direction.multiplyScalar(dragDistance.current));

    // Convert to local position (relative to parent group)
    if (group.parent) {
      const newLocalPos = group.parent.worldToLocal(newWorldPos.clone());
      
      // Smooth movement
      group.position.lerp(newLocalPos, 0.3);
    }
  });

  return null;
};

// === Background ===
const ArrayBackground = ({ data, spacing }) => {
  const width = Math.max(6, (data.length - 1) * spacing + 3);
  const height = 2.4;
  const boxGeo = useMemo(
    () => new THREE.BoxGeometry(width, height, 0.06),
    [width, height]
  );
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(boxGeo), [boxGeo]);

  return (
    <group position={[0, 0.9, -1]}>
      <mesh geometry={boxGeo}>
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial />
      </lineSegments>
    </group>
  );
};

// === Fade-in Text ===
const FadeInText = ({ show, text, position, fontSize, color }) => {
  const ref = useRef();
  const opacity = useRef(0);
  const scale = useRef(0.6);

  useFrame(() => {
    if (show) {
      opacity.current = Math.min(opacity.current + 0.06, 1);
      scale.current = Math.min(scale.current + 0.06, 1);
    } else {
      opacity.current = Math.max(opacity.current - 0.06, 0);
      scale.current = 0.6;
    }
    if (ref.current && ref.current.material) {
      ref.current.material.opacity = opacity.current;
      ref.current.scale.set(scale.current, scale.current, scale.current);
    }
  });

  return (
    <Text
      ref={ref}
      position={position}
      fontSize={fontSize}
      color={color}
      anchorX="center"
      anchorY="middle"
      material-transparent
      maxWidth={8}
      textAlign="center"
    >
      {text}
    </Text>
  );
};

// === Box ===
const Box = forwardRef(({ index, value, position, selected, isDragging, onClick }, ref) => {
  const size = [1.6, 1.2, 1];
  
  // Color changes based on state
  let color = index % 2 === 0 ? "#60a5fa" : "#34d399";
  if (selected) color = "#facc15";
  if (isDragging) color = "#ff6b6b";

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
      {/* Main box mesh */}
      <mesh
        castShadow
        receiveShadow
        position={[0, size[1] / 2, 0]}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          emissive={isDragging ? "#ff0000" : selected ? "#fbbf24" : "#000000"}
          emissiveIntensity={isDragging ? 0.5 : selected ? 0.4 : 0}
        />
      </mesh>

      {/* Value text */}
      <FadeInText
        show={true}
        text={String(value)}
        position={[0, size[1] / 2 + 0.15, size[2] / 2 + 0.01]}
        fontSize={0.4}
        color="white"
      />

      {/* Index label */}
      <mesh position={[0, -0.3, size[2] / 2 + 0.01]}>
        <planeGeometry args={[0.9, 0.4]} />
        <meshBasicMaterial transparent opacity={0} />
        <Text
          position={[0, 0, 0.01]}
          fontSize={0.3}
          color="yellow"
          anchorX="center"
          anchorY="middle"
        >
          [{index}]
        </Text>
      </mesh>

      {/* Status text above box */}
      {(selected || isDragging) && (
        <Text
          position={[0, size[1] + 0.8, 0]}
          fontSize={0.3}
          color={isDragging ? "#ff6b6b" : "#fde68a"}
          anchorX="center"
          anchorY="middle"
        >
          {isDragging ? "🎯 Dragging..." : `Value ${value} at index ${index}`}
        </Text>
      )}

      {/* Dragging indicator ring */}
      {isDragging && (
        <mesh position={[0, size[1] / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.2, 1.4, 32]} />
          <meshBasicMaterial color="#ff6b6b" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
});

// === Definition Panel ===
const DefinitionPanel = ({ page, data, index, position, onNextClick }) => {
  let content = "";

  if (page === 0) {
    content = [
      `📘 Index ${index}`,
      "",
      `• Value: ${data[index]}`,
      "• Remember: indexes start from 0.",
    ].join("\n");
  } else if (page === 1) {
    content = [
      "📗 Array Property:",
      "",
      "• Access time: O(1)",
      "• Stored in contiguous memory.",
    ].join("\n");
  } else {
    content = [
      "📊 Summary:",
      "",
      ...data.map((v, i) => `• Index ${i} → value ${v}`),
    ].join("\n");
  }

  const nextLabel = page < 2 ? "Next ▶" : "Close ✖";

  return (
    <group>
      <FadeInText
        show={true}
        text={content}
        position={position}
        fontSize={0.32}
        color="#fde68a"
      />
      <Text
        position={[position[0], position[1] - 2.8, position[2]]}
        fontSize={0.45}
        color="#38bdf8"
        anchorX="center"
        anchorY="middle"
        onClick={onNextClick}
      >
        {nextLabel}
      </Text>
    </group>
  );
};

export default VisualPageAR;

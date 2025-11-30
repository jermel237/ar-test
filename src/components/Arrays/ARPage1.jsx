import React, { useMemo, useState, useRef, useEffect, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

const VisualPageAR = ({ data: initialData = [10, 20, 30, 40], spacing = 2.0 }) => {
  const [data, setData] = useState(initialData);
  const [showPanel, setShowPanel] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedBox, setSelectedBox] = useState(null);
  
  // Per-box drag state
  const [draggedBox, setDraggedBox] = useState(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(null);
  
  const boxRefs = useRef([]);
  const hoverIndexRef = useRef(null);
  const draggedBoxRef = useRef(null);

  const addBoxRef = (r, index) => {
    if (r) {
      boxRefs.current[index] = r;
    }
  };

  const positions = useMemo(() => {
    const mid = (data.length - 1) / 2;
    return data.map((_, i) => [(i - mid) * spacing, 0, 0]);
  }, [data, spacing]);

  // Calculate which index based on X position
  const calculateHoverIndex = (x) => {
    const mid = (data.length - 1) / 2;
    const index = Math.round(x / spacing + mid);
    return Math.max(0, Math.min(data.length - 1, index));
  };

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

  // Per-box drag functions
  const onDragStart = (index) => {
    setDraggedBox(index);
    draggedBoxRef.current = index;
    setDragX(positions[index][0]);
    setHoverIndex(index);
    hoverIndexRef.current = index;
    setIsDragging(true);
    setShowPanel(false);
    setSelectedBox(null);
  };

  const onDragMove = (newX) => {
    setDragX(newX);
    const newHoverIndex = calculateHoverIndex(newX);
    setHoverIndex(newHoverIndex);
    hoverIndexRef.current = newHoverIndex;
  };

  const onDragEnd = () => {
    const fromIndex = draggedBoxRef.current;
    const toIndex = hoverIndexRef.current;
    
    console.log("Swap:", fromIndex, "↔", toIndex); // Debug log
    
    if (fromIndex !== null && toIndex !== null && fromIndex !== toIndex) {
      // SWAP the two boxes
      setData(prevData => {
        const newData = [...prevData];
        const temp = newData[fromIndex];
        newData[fromIndex] = newData[toIndex];
        newData[toIndex] = temp;
        console.log("New data:", newData); // Debug log
        return newData;
      });
    }
    
    // Reset all drag state
    setDraggedBox(null);
    draggedBoxRef.current = null;
    setDragX(0);
    setIsDragging(false);
    setHoverIndex(null);
    hoverIndexRef.current = null;
  };

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

          {/* Dragging indicator */}
          {isDragging && draggedBox !== null && (
            <FadeInText
              show={true}
              text={
                hoverIndex !== null && hoverIndex !== draggedBox
                  ? `🔄 Swap [${draggedBox}] ↔ [${hoverIndex}]`
                  : `✋ Moving [${draggedBox}]...`
              }
              position={[0, 2.3, 0]}
              fontSize={0.4}
              color={hoverIndex !== null && hoverIndex !== draggedBox ? "#4ade80" : "#f97316"}
            />
          )}

          {/* Boxes */}
          {data.map((value, i) => {
            const isBeingDragged = draggedBox === i;
            const isSwapTarget = isDragging && hoverIndex === i && draggedBox !== i;
            
            // Position: dragged box follows dragX, others stay in place
            const boxPosition = isBeingDragged 
              ? [dragX, 0.8, 0.5]  // Lifted position for dragged box
              : positions[i];
            
            return (
              <Box
                key={`box-${i}-${value}`}
                index={i}
                value={value}
                position={boxPosition}
                selected={selectedBox === i}
                isDragging={isBeingDragged}
                isSwapTarget={isSwapTarget}
                isOtherDragging={isDragging && !isBeingDragged && !isSwapTarget}
                onClick={() => handleClick(i)}
                ref={(r) => addBoxRef(r, i)}
              />
            );
          })}

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

        <ARInteractionManager
          boxRefs={boxRefs}
          setSelectedBox={setSelectedBox}
          isDragging={isDragging}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          positions={positions}
          spacing={spacing}
          dataLength={data.length}
        />
        <OrbitControls makeDefault enabled={!isDragging} />
      </Canvas>
    </div>
  );
};

// --- AR Interaction Manager ---
const ARInteractionManager = ({
  boxRefs,
  setSelectedBox,
  isDragging,
  onDragStart,
  onDragMove,
  onDragEnd,
  positions,
  spacing,
  dataLength
}) => {
  const { gl } = useThree();
  const longPressTimer = useRef(null);
  const touchedBoxIndex = useRef(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    const onSessionStart = () => {
      const session = gl.xr.getSession();
      if (!session) return;

      const getCameraRay = () => {
        const xrCamera = gl.xr.getCamera();
        const cam = xrCamera.cameras ? xrCamera.cameras[0] : xrCamera;
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
        const origin = cam.getWorldPosition(new THREE.Vector3());
        return { origin, dir };
      };

      const getHitBoxIndex = () => {
        const { origin, dir } = getCameraRay();
        const raycaster = new THREE.Raycaster();
        raycaster.set(origin, dir);

        const allMeshes = [];
        boxRefs.current.forEach((group, idx) => {
          if (group && group.children) {
            group.children.forEach((child) => {
              child.userData.parentBoxIndex = idx;
              allMeshes.push(child);
            });
          }
        });

        const hits = raycaster.intersectObjects(allMeshes, true);
        if (hits.length > 0) {
          let obj = hits[0].object;
          while (obj) {
            if (obj.userData?.parentBoxIndex !== undefined) {
              return obj.userData.parentBoxIndex;
            }
            if (obj.userData?.boxIndex !== undefined) {
              return obj.userData.boxIndex;
            }
            obj = obj.parent;
          }
        }
        return null;
      };

      const getRaycastX = () => {
        const { origin, dir } = getCameraRay();
        const planeZ = -8;
        const t = (planeZ - origin.z) / dir.z;
        
        if (t > 0) {
          const x = origin.x + dir.x * t;
          const mid = (dataLength - 1) / 2;
          const minX = -mid * spacing - spacing * 0.5;
          const maxX = mid * spacing + spacing * 0.5;
          return Math.max(minX, Math.min(maxX, x));
        }
        return 0;
      };

      const onSelectStart = () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
        }

        const hitIdx = getHitBoxIndex();
        touchedBoxIndex.current = hitIdx;

        if (hitIdx !== null) {
          longPressTimer.current = setTimeout(() => {
            onDragStart(hitIdx);
            longPressTimer.current = null;
          }, 500);
        }
      };

      const onSelectEnd = () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }

        if (isDraggingRef.current) {
          onDragEnd();
        } else if (touchedBoxIndex.current !== null) {
          setSelectedBox(touchedBoxIndex.current);
        }

        touchedBoxIndex.current = null;
      };

      session.addEventListener("selectstart", onSelectStart);
      session.addEventListener("selectend", onSelectEnd);

      const onFrame = (time, frame) => {
        if (isDraggingRef.current) {
          const newX = getRaycastX();
          onDragMove(newX);
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
  }, [gl, boxRefs, setSelectedBox, onDragStart, onDragMove, onDragEnd, positions, spacing, dataLength]);

  return null;
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
const Box = forwardRef(({ index, value, position, selected, isDragging, isSwapTarget, isOtherDragging, onClick }, ref) => {
  const size = [1.6, 1.2, 1];
  const groupRef = useRef();

  const getColor = () => {
    if (isDragging) return "#f97316";
    if (isSwapTarget) return "#4ade80";
    if (selected) return "#facc15";
    if (isOtherDragging) return "#94a3b8";
    return index % 2 === 0 ? "#60a5fa" : "#34d399";
  };

  useEffect(() => {
    if (groupRef.current) groupRef.current.userData = { boxIndex: index };
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
        <boxGeometry args={isDragging ? [size[0] * 1.1, size[1] * 1.1, size[2] * 1.1] : size} />
        <meshStandardMaterial
          color={getColor()}
          emissive={isDragging ? "#f97316" : isSwapTarget ? "#4ade80" : selected ? "#fbbf24" : "#000000"}
          emissiveIntensity={isDragging ? 0.6 : isSwapTarget ? 0.5 : selected ? 0.4 : 0}
          transparent={isOtherDragging}
          opacity={isOtherDragging ? 0.5 : 1}
        />
      </mesh>

      <Text
        position={[0, size[1] / 2 + 0.15, size[2] / 2 + 0.01]}
        fontSize={0.4}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {String(value)}
      </Text>

      <Text
        position={[0, -0.3, size[2] / 2 + 0.01]}
        fontSize={0.3}
        color={isDragging ? "#f97316" : isSwapTarget ? "#4ade80" : "yellow"}
        anchorX="center"
        anchorY="middle"
      >
        [{index}]
      </Text>

      {selected && !isDragging && !isSwapTarget && (
        <Text
          position={[0, size[1] + 0.8, 0]}
          fontSize={0.3}
          color="#fde68a"
          anchorX="center"
          anchorY="middle"
        >
          Value {value} at index {index}
        </Text>
      )}

      {isDragging && (
        <Text
          position={[0, size[1] + 1, 0]}
          fontSize={0.3}
          color="#f97316"
          anchorX="center"
          anchorY="middle"
        >
          ✋ Dragging
        </Text>
      )}

      {isSwapTarget && (
        <Text
          position={[0, size[1] + 1, 0]}
          fontSize={0.3}
          color="#4ade80"
          anchorX="center"
          anchorY="middle"
        >
          🔄 Swap here
        </Text>
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

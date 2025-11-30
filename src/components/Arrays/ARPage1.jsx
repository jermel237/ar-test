import React, { useMemo, useState, useRef, useEffect, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

const VisualPageAR = ({ data: initialData = [10, 20, 30, 40], spacing = 2.0 }) => {
  const [data, setData] = useState(initialData);
  const [showPanel, setShowPanel] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedBox, setSelectedBox] = useState(null);
  
  // Drag state
  const [draggedBox, setDraggedBox] = useState(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(null);
  
  // Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const [targetPositions, setTargetPositions] = useState({}); // { boxIndex: targetX }
  
  const boxRefs = useRef([]);
  const hoverIndexRef = useRef(null);
  const draggedBoxRef = useRef(null);

  const addBoxRef = (r, index) => {
    if (r) {
      boxRefs.current[index] = r;
    }
  };

  // Calculate base positions
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
    if (!isDragging && !isAnimating) {
      setSelectedBox(i);
      setShowPanel(true);
      setPage(0);
    }
  };

  const handleNextClick = () => {
    if (page < 2) setPage(page + 1);
    else setShowPanel(false);
  };

  // Drag functions
  const onDragStart = (index) => {
    if (isAnimating) return;
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
    
    // Reset drag state
    setDraggedBox(null);
    draggedBoxRef.current = null;
    setDragX(0);
    setIsDragging(false);
    setHoverIndex(null);
    hoverIndexRef.current = null;
    
    // Start sliding animation if moving to different position
    if (fromIndex !== null && toIndex !== null && fromIndex !== toIndex) {
      // Calculate new positions for all affected boxes
      const newTargets = {};
      const mid = (data.length - 1) / 2;
      
      if (fromIndex < toIndex) {
        // Moving right: boxes in between shift left
        // Dragged box goes to toIndex position
        newTargets[fromIndex] = (toIndex - mid) * spacing;
        
        // Boxes between fromIndex+1 and toIndex shift left by 1
        for (let i = fromIndex + 1; i <= toIndex; i++) {
          newTargets[i] = (i - 1 - mid) * spacing;
        }
      } else {
        // Moving left: boxes in between shift right
        // Dragged box goes to toIndex position
        newTargets[fromIndex] = (toIndex - mid) * spacing;
        
        // Boxes between toIndex and fromIndex-1 shift right by 1
        for (let i = toIndex; i < fromIndex; i++) {
          newTargets[i] = (i + 1 - mid) * spacing;
        }
      }
      
      setTargetPositions(newTargets);
      setIsAnimating(true);
      
      // After animation completes, update data
      setTimeout(() => {
        setData(prevData => {
          const newData = [...prevData];
          const [removed] = newData.splice(fromIndex, 1);
          newData.splice(toIndex, 0, removed);
          return newData;
        });
        setTargetPositions({});
        setIsAnimating(false);
      }, 400); // Animation duration
    }
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

          {/* Status indicator */}
          {isDragging && draggedBox !== null && (
            <FadeInText
              show={true}
              text={
                hoverIndex !== null && hoverIndex !== draggedBox
                  ? `📍 Move to position [${hoverIndex}]`
                  : `✋ Dragging [${draggedBox}]`
              }
              position={[0, 2.3, 0]}
              fontSize={0.4}
              color={hoverIndex !== null && hoverIndex !== draggedBox ? "#4ade80" : "#f97316"}
            />
          )}

          {/* Boxes */}
          {data.map((value, i) => {
            const isBeingDragged = draggedBox === i;
            const isDropTarget = isDragging && hoverIndex === i && draggedBox !== i;
            const hasAnimationTarget = targetPositions[i] !== undefined;
            
            return (
              <SlidingBox
                key={`box-${i}`}
                index={i}
                value={value}
                basePosition={positions[i]}
                dragX={isBeingDragged ? dragX : null}
                targetX={hasAnimationTarget ? targetPositions[i] : null}
                selected={selectedBox === i}
                isDragging={isBeingDragged}
                isDropTarget={isDropTarget}
                isSliding={hasAnimationTarget}
                isOtherDragging={isDragging && !isBeingDragged}
                onClick={() => handleClick(i)}
                ref={(r) => addBoxRef(r, i)}
              />
            );
          })}

          {showPanel && selectedBox !== null && !isDragging && !isAnimating && (
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
          isAnimating={isAnimating}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          spacing={spacing}
          dataLength={data.length}
        />
        <OrbitControls makeDefault enabled={!isDragging && !isAnimating} />
      </Canvas>
    </div>
  );
};

// === Sliding Box - Simple horizontal slide ===
const SlidingBox = forwardRef(({ 
  index, 
  value, 
  basePosition, 
  dragX,
  targetX,
  selected, 
  isDragging, 
  isDropTarget, 
  isSliding,
  isOtherDragging,
  onClick
}, ref) => {
  const size = [1.6, 1.2, 1];
  const groupRef = useRef();
  const currentX = useRef(basePosition[0]);

  const getColor = () => {
    if (isDragging) return "#f97316"; // Orange
    if (isDropTarget) return "#4ade80"; // Green
    if (isSliding) return "#60a5fa"; // Blue (sliding)
    if (selected) return "#facc15"; // Yellow
    if (isOtherDragging) return "#94a3b8"; // Gray
    return index % 2 === 0 ? "#60a5fa" : "#34d399";
  };

  useEffect(() => {
    if (groupRef.current) groupRef.current.userData = { boxIndex: index };
  }, [index]);

  // Reset position when base changes (after data reorder)
  useEffect(() => {
    if (!isDragging && !isSliding) {
      currentX.current = basePosition[0];
    }
  }, [basePosition, isDragging, isSliding]);

  // Smooth sliding animation
  useFrame(() => {
    if (!groupRef.current) return;

    let targetXPos;
    let yPos = 0;

    if (isDragging && dragX !== null) {
      // Dragging - follow drag position, lifted up
      targetXPos = dragX;
      yPos = 0.5;
    } else if (isSliding && targetX !== null) {
      // Sliding to new position
      targetXPos = targetX;
      yPos = 0;
    } else {
      // Normal position
      targetXPos = basePosition[0];
      yPos = 0;
    }

    // Smooth lerp - simple horizontal slide
    const lerpSpeed = isDragging ? 0.25 : 0.12;
    currentX.current += (targetXPos - currentX.current) * lerpSpeed;

    // Apply position
    groupRef.current.position.x = currentX.current;
    groupRef.current.position.y = yPos;
    groupRef.current.position.z = isDragging ? 0.5 : 0;
  });

  return (
    <group
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
        <boxGeometry args={isDragging ? [size[0] * 1.05, size[1] * 1.05, size[2] * 1.05] : size} />
        <meshStandardMaterial
          color={getColor()}
          emissive={isDragging ? "#f97316" : isDropTarget ? "#4ade80" : selected ? "#fbbf24" : "#000000"}
          emissiveIntensity={isDragging ? 0.5 : isDropTarget ? 0.4 : selected ? 0.3 : 0}
          transparent={isOtherDragging && !isDropTarget}
          opacity={isOtherDragging && !isDropTarget ? 0.6 : 1}
        />
      </mesh>

      {/* Value text */}
      <Text
        position={[0, size[1] / 2 + 0.15, size[2] / 2 + 0.01]}
        fontSize={0.4}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {String(value)}
      </Text>

      {/* Index text */}
      <Text
        position={[0, -0.3, size[2] / 2 + 0.01]}
        fontSize={0.3}
        color={isDragging ? "#f97316" : isDropTarget ? "#4ade80" : "yellow"}
        anchorX="center"
        anchorY="middle"
      >
        [{index}]
      </Text>

      {/* Labels */}
      {selected && !isDragging && !isDropTarget && (
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
          position={[0, size[1] + 0.8, 0]}
          fontSize={0.28}
          color="#f97316"
          anchorX="center"
          anchorY="middle"
        >
          ✋ Dragging
        </Text>
      )}

      {isDropTarget && (
        <Text
          position={[0, size[1] + 0.8, 0]}
          fontSize={0.28}
          color="#4ade80"
          anchorX="center"
          anchorY="middle"
        >
          ← Drop here
        </Text>
      )}
    </group>
  );
});

// --- AR Interaction Manager ---
const ARInteractionManager = ({
  boxRefs,
  setSelectedBox,
  isDragging,
  isAnimating,
  onDragStart,
  onDragMove,
  onDragEnd,
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
        if (isAnimating) return;
        
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
        } else if (touchedBoxIndex.current !== null && !isAnimating) {
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
  }, [gl, boxRefs, setSelectedBox, onDragStart, onDragMove, onDragEnd, spacing, dataLength, isAnimating]);

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

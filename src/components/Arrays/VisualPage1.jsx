import React, { useState, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

const VisualPage1 = ({ data: initialData = [10, 20, 30, 40], spacing = 2.0 }) => {
  const [data, setData] = useState(initialData);
  const [showPanel, setShowPanel] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedBox, setSelectedBox] = useState(null);
  const [draggedBox, setDraggedBox] = useState(null);
  const [holdingBox, setHoldingBox] = useState(null);
  const [boxPositions, setBoxPositions] = useState(() => {
    const mid = (initialData.length - 1) / 2;
    return initialData.map((_, i) => [(i - mid) * spacing, 0, 0]);
  });

  const controlsRef = useRef();

  const handleIndexClick = () => {
    setShowPanel((prev) => !prev);
    setPage(0);
  };

  const handleNextClick = () => {
    if (page < 2) setPage(page + 1);
    else setShowPanel(false);
  };

  const handleBoxClick = (i) => {
    setSelectedBox((prev) => (prev === i ? null : i));
  };

  const handleHoldStart = (index) => {
    setHoldingBox(index);
  };

  const handleHoldComplete = (index) => {
    setDraggedBox(index);
    setSelectedBox(index);
    setHoldingBox(null);
  };

  const handleHoldCancel = () => {
    setHoldingBox(null);
  };

  const handleDragEnd = () => {
    setDraggedBox(null);
    setHoldingBox(null);
  };

  const updateBoxPosition = (index, newPosition) => {
    setBoxPositions((prev) => {
      const updated = [...prev];
      updated[index] = newPosition;
      return updated;
    });
  };

  const handleSwap = (draggedIndex, targetIndex) => {
    if (draggedIndex !== targetIndex) {
      const newData = [...data];
      [newData[draggedIndex], newData[targetIndex]] = [newData[targetIndex], newData[draggedIndex]];
      setData(newData);
      
      const mid = (newData.length - 1) / 2;
      setBoxPositions(newData.map((_, i) => [(i - mid) * spacing, 0, 0]));
    }
  };

  return (
    <div 
      className="w-full h-[500px] relative"
      style={{
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        KhtmlUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas 
        camera={{ position: [0, 6, 14], fov: 50 }}
        style={{
          touchAction: 'none',
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />
        <pointLight position={[-5, 5, 5]} intensity={0.3} />

        <FadeInText
          show={true}
          text={"Array Data Structure"}
          position={[0, 4, 0]}
          fontSize={0.6}
          color="white"
        />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
          <planeGeometry args={[20, 10]} />
          <meshStandardMaterial color="#1e293b" transparent opacity={0.5} />
        </mesh>

        {data.map((_, i) => {
          const mid = (data.length - 1) / 2;
          const originalX = (i - mid) * spacing;
          return (
            <DropZone
              key={`zone-${i}`}
              position={[originalX, -0.4, 0]}
              index={i}
              isActive={draggedBox !== null && draggedBox !== i}
              onDrop={() => draggedBox !== null && handleSwap(draggedBox, i)}
            />
          );
        })}

        {data.map((value, i) => (
          <DraggableBox
            key={i}
            index={i}
            value={value}
            position={boxPositions[i]}
            selected={selectedBox === i}
            isDragging={draggedBox === i}
            isHolding={holdingBox === i}
            anyDragging={draggedBox !== null}
            onBoxClick={() => handleBoxClick(i)}
            onIndexClick={handleIndexClick}
            onHoldStart={() => handleHoldStart(i)}
            onHoldComplete={() => handleHoldComplete(i)}
            onHoldCancel={handleHoldCancel}
            onDragEnd={handleDragEnd}
            onPositionChange={(pos) => updateBoxPosition(i, pos)}
            controlsRef={controlsRef}
          />
        ))}

        {showPanel && (
          <DefinitionPanel
            page={page}
            data={data}
            position={[8, 1, 0]}
            onNextClick={handleNextClick}
          />
        )}

        <OrbitControls 
          ref={controlsRef}
          makeDefault 
          enabled={draggedBox === null && holdingBox === null}
        />
      </Canvas>
    </div>
  );
};

const DropZone = ({ position, index, isActive, onDrop }) => {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef();

  useFrame(() => {
    if (meshRef.current) {
      const targetScale = isActive && hovered ? 1.2 : 1;
      meshRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.1
      );
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={() => isActive && setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onPointerUp={() => isActive && onDrop()}
      >
        <boxGeometry args={[1.8, 0.1, 1.2]} />
        <meshStandardMaterial
          color={hovered && isActive ? "#22c55e" : "#475569"}
          transparent
          opacity={isActive ? 0.8 : 0.3}
          emissive={hovered && isActive ? "#22c55e" : "#000000"}
          emissiveIntensity={0.3}
        />
      </mesh>
      <Text
        position={[0, 0.15, 0]}
        fontSize={0.25}
        color={isActive ? "#22c55e" : "#64748b"}
        anchorX="center"
        anchorY="middle"
      >
        [{index}]
      </Text>
    </group>
  );
};

const DraggableBox = ({
  index,
  value,
  position,
  selected,
  isDragging,
  isHolding,
  anyDragging,
  onBoxClick,
  onIndexClick,
  onHoldStart,
  onHoldComplete,
  onHoldCancel,
  onDragEnd,
  onPositionChange,
  controlsRef,
}) => {
  const groupRef = useRef();
  const { camera, gl, raycaster, pointer } = useThree();
  const [isHovered, setIsHovered] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdStartTimeRef = useRef(null);
  const isPointerDownRef = useRef(false);
  const pointerStartPosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const offset = useRef(new THREE.Vector3());
  const intersection = useRef(new THREE.Vector3());

  const HOLD_DURATION = 500; // 0.5 seconds
  const CLICK_THRESHOLD = 5; // pixels - if moved less than this, it's a click

  const size = [1.6, 1.2, 1];
  
  const getColor = () => {
    if (isDragging) return "#f97316";
    if (isHolding) return "#fb923c";
    if (selected) return "#facc15";
    if (isHovered) return "#818cf8";
    return index % 2 === 0 ? "#60a5fa" : "#34d399";
  };

  useFrame(() => {
    if (groupRef.current) {
      const targetY = isDragging ? 1.5 : isHolding ? 0.3 : 0;
      
      if (isDragging) {
        groupRef.current.position.x = position[0];
        groupRef.current.position.z = position[2];
        groupRef.current.position.y = THREE.MathUtils.lerp(
          groupRef.current.position.y,
          position[1] + targetY,
          0.3
        );
      } else {
        groupRef.current.position.y = THREE.MathUtils.lerp(
          groupRef.current.position.y,
          position[1] + targetY,
          0.15
        );
        groupRef.current.position.x = THREE.MathUtils.lerp(
          groupRef.current.position.x,
          position[0],
          0.15
        );
        groupRef.current.position.z = THREE.MathUtils.lerp(
          groupRef.current.position.z,
          position[2],
          0.15
        );
      }

      const targetScale = isDragging ? 1.15 : isHolding ? 1.1 : isHovered ? 1.05 : 1;
      groupRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.1
      );
    }

    // Update hold progress
    if (isHolding && holdStartTimeRef.current && !isDragging) {
      const elapsed = Date.now() - holdStartTimeRef.current;
      const progress = Math.min(elapsed / HOLD_DURATION, 1);
      setHoldProgress(progress);
      
      if (progress >= 1) {
        completeHold();
      }
    }
  });

  const startHold = (e) => {
    if (controlsRef.current) {
      controlsRef.current.enabled = false;
    }
    
    isPointerDownRef.current = true;
    hasDraggedRef.current = false;
    holdStartTimeRef.current = Date.now();
    pointerStartPosRef.current = { x: e.clientX || 0, y: e.clientY || 0 };
    setHoldProgress(0);
    onHoldStart();
    
    gl.domElement.style.cursor = "progress";
  };

  const completeHold = () => {
    if (!isPointerDownRef.current) return;
    
    hasDraggedRef.current = true;
    holdStartTimeRef.current = null;
    setHoldProgress(0);
    
    dragPlane.current.set(new THREE.Vector3(0, 1, 0), -groupRef.current.position.y);
    
    raycaster.setFromCamera(pointer, camera);
    raycaster.ray.intersectPlane(dragPlane.current, intersection.current);
    offset.current.copy(intersection.current).sub(groupRef.current.position);
    
    onHoldComplete();
    gl.domElement.style.cursor = "grabbing";
  };

  const cancelHold = () => {
    holdStartTimeRef.current = null;
    setHoldProgress(0);
    isPointerDownRef.current = false;
    onHoldCancel();
    
    if (controlsRef.current) {
      controlsRef.current.enabled = true;
    }
    
    gl.domElement.style.cursor = "auto";
  };

  const handlePointerDown = (e) => {
    e.stopPropagation();
    try {
      e.target.setPointerCapture(e.pointerId);
    } catch (err) {}
    startHold(e);
  };

  const handlePointerMove = (e) => {
    if (!isPointerDownRef.current) return;
    e.stopPropagation();

    if (!isDragging) return;

    raycaster.setFromCamera(pointer, camera);
    raycaster.ray.intersectPlane(dragPlane.current, intersection.current);

    const newPosition = [
      intersection.current.x - offset.current.x,
      0,
      intersection.current.z - offset.current.z,
    ];

    onPositionChange(newPosition);
  };

  const handlePointerUp = (e) => {
    e.stopPropagation();
    
    try {
      if (e.target.releasePointerCapture) {
        e.target.releasePointerCapture(e.pointerId);
      }
    } catch (err) {}

    const endPos = { x: e.clientX || 0, y: e.clientY || 0 };
    const distance = Math.sqrt(
      Math.pow(endPos.x - pointerStartPosRef.current.x, 2) +
      Math.pow(endPos.y - pointerStartPosRef.current.y, 2)
    );

    // If it was a quick tap (not a hold that completed) and didn't move much, treat as click
    if (!hasDraggedRef.current && distance < CLICK_THRESHOLD) {
      onBoxClick();
    }

    if (isDragging) {
      onDragEnd();
    } else {
      cancelHold();
    }
    
    isPointerDownRef.current = false;
    hasDraggedRef.current = false;
    holdStartTimeRef.current = null;
    setHoldProgress(0);
    
    if (controlsRef.current) {
      controlsRef.current.enabled = true;
    }
    
    gl.domElement.style.cursor = "auto";
  };

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerOver={() => {
        setIsHovered(true);
        if (!anyDragging) gl.domElement.style.cursor = "grab";
      }}
      onPointerOut={() => {
        setIsHovered(false);
        if (!anyDragging && !isHolding) gl.domElement.style.cursor = "auto";
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Hold Progress Ring */}
      {isHolding && !isDragging && (
        <group position={[0, size[1] + 1.2, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.4, 0.55, 32]} />
            <meshBasicMaterial color="#374151" transparent opacity={0.5} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry 
              args={[
                0.4, 
                0.55, 
                32, 
                1, 
                0, 
                Math.PI * 2 * holdProgress
              ]} 
            />
            <meshBasicMaterial color="#f97316" />
          </mesh>
        </group>
      )}

      {/* Shadow when dragging */}
      {isDragging && (
        <mesh position={[0, -1.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.8, 32]} />
          <meshBasicMaterial color="black" transparent opacity={0.3} />
        </mesh>
      )}

      {/* Main Box */}
      <mesh castShadow receiveShadow position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={getColor()}
          emissive={isDragging ? "#f97316" : isHolding ? "#fb923c" : selected ? "#fbbf24" : "#000000"}
          emissiveIntensity={isDragging ? 0.5 : isHolding ? 0.3 : selected ? 0.4 : 0}
          metalness={0.1}
          roughness={0.5}
        />
      </mesh>

      {/* Outline effect when dragging */}
      {isDragging && (
        <mesh position={[0, size[1] / 2, 0]}>
          <boxGeometry args={[size[0] + 0.1, size[1] + 0.1, size[2] + 0.1]} />
          <meshBasicMaterial color="#ffffff" wireframe />
        </mesh>
      )}

      {/* Pulsing outline when holding */}
      {isHolding && !isDragging && (
        <mesh position={[0, size[1] / 2, 0]}>
          <boxGeometry args={[size[0] + 0.08, size[1] + 0.08, size[2] + 0.08]} />
          <meshBasicMaterial color="#f97316" wireframe />
        </mesh>
      )}

      {/* Value label on box */}
      <FadeInText
        show={true}
        text={String(value)}
        position={[0, size[1] / 2 + 0.15, size[2] / 2 + 0.01]}
        fontSize={0.45}
        color="white"
      />

      {/* Index clickable */}
      <Text
        position={[0, -0.3, size[2] / 2 + 0.01]}
        fontSize={0.3}
        color="yellow"
        anchorX="center"
        anchorY="middle"
        onClick={(e) => {
          e.stopPropagation();
          onIndexClick();
        }}
      >
        [{index}]
      </Text>

      {/* Selected/Dragging status label */}
      {(selected || isDragging) && !isHolding && (
        <Text
          position={[0, size[1] + 0.9, 0]}
          fontSize={0.28}
          color={isDragging ? "#fb923c" : "#fde68a"}
          anchorX="center"
          anchorY="middle"
        >
          {isDragging ? "Dragging..." : `Value ${value} at index ${index}`}
        </Text>
      )}
    </group>
  );
};

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
      maxWidth={10}
      textAlign="center"
    >
      {text}
    </Text>
  );
};

const DefinitionPanel = ({ page, data, position, onNextClick }) => {
  let content = "";

  if (page === 0) {
    content = [
      "📘 Understanding Index in Arrays:",
      "",
      "• Index is the position assigned to each element.",
      "• Starts at 0, so first element → index 0.",
    ].join("\n");
  } else if (page === 1) {
    content = [
      "📗 In Data Structures & Algorithms:",
      "",
      "• Indexing gives O(1) access time.",
      "• Arrays are stored in contiguous memory.",
    ].join("\n");
  } else if (page === 2) {
    content = [
      "📊 Current Array State:",
      "",
      ...data.map((v, i) => `• Index ${i} → value ${v}`),
    ].join("\n");
  }

  const nextLabel = page < 2 ? "Next ▶" : "Close ✖";

  return (
    <group>
      <mesh position={[position[0], position[1] - 0.5, position[2] - 0.1]}>
        <planeGeometry args={[6, 5]} />
        <meshBasicMaterial color="#1e293b" transparent opacity={0.85} />
      </mesh>
      
      <FadeInText
        show={true}
        text={content}
        position={position}
        fontSize={0.28}
        color="#fde68a"
      />
      <Text
        position={[position[0], position[1] - 2.8, position[2]]}
        fontSize={0.4}
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

export default VisualPage1;

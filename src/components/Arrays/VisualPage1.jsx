import React, { useMemo, useState, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

const VisualPage1 = ({ initialData = [10, 20, 30, 40], spacing = 3.0 }) => {
  const [data, setData] = useState(initialData);
  const [showPanel, setShowPanel] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedBox, setSelectedBox] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dropTargetIndex, setDropTargetIndex] = useState(null);
  const [dragEnabled, setDragEnabled] = useState(false);

  // Define slot positions
  const positions = useMemo(() => {
    const mid = (data.length - 1) / 2;
    return data.map((_, i) => [(i - mid) * spacing, 0, 0]);
  }, [data, spacing]);

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

  const handleDragStart = (index) => {
    if (!dragEnabled) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (index) => {
    if (!dragEnabled) return;
    if (index !== draggedIndex) setDropTargetIndex(index);
  };

  const handleDragEnd = () => {
    if (!dragEnabled) return;

    if (
      draggedIndex !== null &&
      dropTargetIndex !== null &&
      draggedIndex !== dropTargetIndex
    ) {
      const newData = [...data];
      // Swap values
      [newData[draggedIndex], newData[dropTargetIndex]] = [
        newData[dropTargetIndex],
        newData[draggedIndex],
      ];
      setData(newData);
    }

    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  return (
    <div className="w-full h-[600px]">
      <Canvas camera={{ position: [0, 4, 12], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />

        <FadeInText
          show={true}
          text={"Array Data Structure - Drag to Swap"}
          position={[0, 3, 0]}
          fontSize={0.7}
          color="white"
        />

        {data.map((value, i) => (
          <DraggableBox
            key={`${i}-${value}`}
            index={i}
            value={value}
            position={positions[i]}
            selected={selectedBox === i}
            isDragging={draggedIndex === i}
            isDropTarget={dropTargetIndex === i}
            onValueClick={() => handleBoxClick(i)}
            onIndexClick={handleIndexClick}
            onDragStart={() => handleDragStart(i)}
            onDragOver={() => handleDragOver(i)}
            onDragEnd={handleDragEnd}
            dragEnabled={dragEnabled}
            draggedIndex={draggedIndex}
            dropTargetIndex={dropTargetIndex}
            positions={positions}
            spacing={spacing}
          />
        ))}

        <ToggleBox
          position={[0, -2, 0]}
          dragEnabled={dragEnabled}
          setDragEnabled={setDragEnabled}
        />

        {showPanel && (
          <DefinitionPanel
            page={page}
            data={data}
            position={[8, 1, 0]}
            onNextClick={handleNextClick}
          />
        )}

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};

// --- Toggle Box ---
const ToggleBox = ({ position, dragEnabled, setDragEnabled }) => {
  const meshRef = useRef();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        castShadow
        receiveShadow
        onClick={() => setDragEnabled(!dragEnabled)}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
      >
        <boxGeometry args={[2, 1, 1]} />
        <meshStandardMaterial
          color={dragEnabled ? "#34d399" : "#f87171"}
          emissive={isHovered ? "#fcd34d" : "#000000"}
          emissiveIntensity={0.5}
        />
      </mesh>

      <FadeInText
        show={true}
        text={`Toggle`}
        position={[0, 0.7, 0]}
        fontSize={0.35}
        color="white"
      />

      <FadeInText
        show={true}
        text={dragEnabled ? "ON" : "OFF"}
        position={[0, -0.7, 0]}
        fontSize={0.35}
        color={dragEnabled ? "#34d399" : "#f87171"}
      />
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
      maxWidth={8}
      textAlign="center"
    >
      {text}
    </Text>
  );
};

const DraggableBox = ({
  index,
  value,
  position,
  selected,
  isDragging,
  isDropTarget,
  onValueClick,
  onIndexClick,
  onDragStart,
  onDragOver,
  onDragEnd,
  dragEnabled,
  draggedIndex,
  dropTargetIndex,
  positions,
  spacing,
}) => {
  const meshRef = useRef();
  const groupRef = useRef();
  const { camera, gl, raycaster } = useThree();
  const [isHovered, setIsHovered] = useState(false);
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
  const dragOffset = useRef(new THREE.Vector3());
  const isDraggingRef = useRef(false);

  const size = [1.6, 1.2, 1];
  const buffer = 0.3;

  let color = selected ? "#facc15" : index % 2 === 0 ? "#60a5fa" : "#34d399";
  if (isDragging) color = "#f97316";
  if (isDropTarget && draggedIndex !== index) color = "#a855f7";

  const targetY = isDragging ? 2 : 0;
  const targetX = useRef(position[0]); // animated x position

  useFrame(() => {
    if (groupRef.current) {
      // Smooth y movement
      groupRef.current.position.y += (targetY - groupRef.current.position.y) * 0.15;
      // Smooth x movement
      groupRef.current.position.x += (targetX.current - groupRef.current.position.x) * 0.15;
    }
  });

  const handlePointerDown = (e) => {
    if (!dragEnabled) return;
    if (e.button !== 0) return;
    e.stopPropagation();

    isDraggingRef.current = true;
    onDragStart();

    const intersection = e.intersections[0];
    if (intersection) {
      dragOffset.current.copy(groupRef.current.position).sub(intersection.point);
    }

    gl.domElement.style.cursor = "grabbing";
  };

  const handlePointerMove = (e) => {
    if (!dragEnabled || !isDraggingRef.current) return;

    const pointer = new THREE.Vector2(
      (e.clientX / gl.domElement.clientWidth) * 2 - 1,
      -(e.clientY / gl.domElement.clientHeight) * 2 + 1
    );

    raycaster.setFromCamera(pointer, camera);
    const point = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane.current, point);

    if (point) {
      // Determine nearest slot
      let desiredX = point.x + dragOffset.current.x;
      let nearestIndex = 0;
      let minDist = Infinity;
      positions.forEach((pos, i) => {
        const dist = Math.abs(pos[0] - desiredX);
        if (dist < minDist) {
          minDist = dist;
          nearestIndex = i;
        }
      });

      // Reserve space for drop target
      let reservedOffset = 0;
      if (dropTargetIndex !== null && dropTargetIndex !== draggedIndex) {
        reservedOffset = draggedIndex < dropTargetIndex ? -buffer : buffer;
      }

      targetX.current = positions[nearestIndex][0] + reservedOffset;
    }
  };

  const handlePointerUp = (e) => {
    if (!dragEnabled || !isDraggingRef.current) return;

    isDraggingRef.current = false;
    onDragEnd();
    gl.domElement.style.cursor = isHovered ? "grab" : "auto";
    targetX.current = position[0]; // reset smoothly
  };

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);

    return () => {
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragEnabled, dropTargetIndex]);

  return (
    <group
      ref={groupRef}
      position={[position[0], position[1], position[2]]}
      onPointerEnter={() => {
        setIsHovered(true);
        if (dragEnabled) onDragOver();
        gl.domElement.style.cursor = "grab";
      }}
      onPointerLeave={() => {
        setIsHovered(false);
        gl.domElement.style.cursor = "auto";
      }}
    >
      <mesh
        ref={meshRef}
        castShadow
        receiveShadow
        position={[0, size[1] / 2, 0]}
        onClick={onValueClick}
        onPointerDown={handlePointerDown}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          emissive={isDragging ? "#fb923c" : selected ? "#fbbf24" : "#000000"}
          emissiveIntensity={isDragging ? 0.6 : selected ? 0.4 : 0}
        />
      </mesh>

      <FadeInText
        show={true}
        text={String(value)}
        position={[0, size[1] / 2 + 0.15, size[2] / 2 + 0.01]}
        fontSize={0.4}
        color="white"
      />

      <Text
        position={[0, -0.3, size[2] / 2 + 0.01]}
        fontSize={0.3}
        color="yellow"
        anchorX="center"
        anchorY="middle"
        onClick={onIndexClick}
      >
        [{index}]
      </Text>

      {isDropTarget && draggedIndex !== index && (
        <Text
          position={[0, size[1] + 0.8, 0]}
          fontSize={0.3}
          color="#c084fc"
          anchorX="center"
          anchorY="middle"
        >
          Drop Here
        </Text>
      )}
    </group>
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
      "• Drag boxes to swap array elements!",
    ].join("\n");
  } else if (page === 1) {
    content = [
      "📗 In Data Structures & Algorithms:",
      "",
      "• Indexing gives O(1) access time.",
      "• Arrays are stored in contiguous memory.",
      "• Swapping updates the index mapping.",
    ].join("\n");
  } else if (page === 2) {
    content = [
      "📊 Index Summary:",
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

export default VisualPage1;

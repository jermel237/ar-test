import React, { useMemo, useState, useRef, useEffect, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

const VisualPageAR = ({ data = [10, 20, 30, 40], spacing = 2.0 }) => {
  const [showPanel, setShowPanel] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedBox, setSelectedBox] = useState(null);
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
    setSelectedBox(i);
    setShowPanel(true);
    setPage(0);
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

          <ArrayBackground data={data} spacing={spacing} />

          {data.map((value, i) => (
            <DraggableBox
              key={i}
              index={i}
              value={value}
              position={currentPositions[i]}
              selected={selectedBox === i}
              onClick={() => handleClick(i)}
              onPositionChange={(newPos) => updateBoxPosition(i, newPos)}
              ref={(r) => addBoxRef(i, r)}
            />
          ))}

          {showPanel && selectedBox !== null && (
            <DefinitionPanel
              page={page}
              data={data}
              index={selectedBox}
              position={[8, 1, 0]}
              onNextClick={handleNextClick}
            />
          )}
        </group>

        <ARDragController
          boxRefs={boxRefs}
          setSelectedBox={setSelectedBox}
          updateBoxPosition={updateBoxPosition}
        />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};

// --- AR Drag Controller ---
const ARDragController = ({ boxRefs, setSelectedBox, updateBoxPosition }) => {
  const { gl, camera } = useThree();
  const dragging = useRef(null);
  const dragOffset = useRef(new THREE.Vector3());
  const raycaster = useRef(new THREE.Raycaster());
  const tempMatrix = useRef(new THREE.Matrix4());
  const controllers = useRef([]);

  useEffect(() => {
    // Setup XR controllers
    const controller0 = gl.xr.getController(0);
    const controller1 = gl.xr.getController(1);
    
    controllers.current = [controller0, controller1];

    const onSelectStart = (event) => {
      const controller = event.target;
      
      // Update raycaster from controller
      tempMatrix.current.identity().extractRotation(controller.matrixWorld);
      raycaster.current.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.current.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix.current);

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
        const hit = intersects[0];
        const boxIndex = hit.object.userData.boxIndex;
        
        if (boxIndex !== undefined) {
          dragging.current = {
            index: boxIndex,
            controller: controller,
            object: boxRefs.current[boxIndex],
          };
          
          // Calculate offset
          const boxWorldPos = new THREE.Vector3();
          boxRefs.current[boxIndex].getWorldPosition(boxWorldPos);
          dragOffset.current.copy(boxWorldPos).sub(hit.point);
          
          setSelectedBox(boxIndex);
          
          // Add visual feedback
          controller.userData.dragging = true;
        }
      }
    };

    const onSelectEnd = (event) => {
      const controller = event.target;
      
      if (dragging.current && dragging.current.controller === controller) {
        // Save final position
        const group = dragging.current.object;
        if (group && group.parent) {
          const localPos = group.position.clone();
          updateBoxPosition(dragging.current.index, [localPos.x, localPos.y, localPos.z]);
        }
        
        controller.userData.dragging = false;
        dragging.current = null;
      }
    };

    controller0.addEventListener("selectstart", onSelectStart);
    controller0.addEventListener("selectend", onSelectEnd);
    controller1.addEventListener("selectstart", onSelectStart);
    controller1.addEventListener("selectend", onSelectEnd);

    // Add controllers to scene
    const scene = gl.xr.getSession() ? gl.xr.getReferenceSpace() : null;

    return () => {
      controller0.removeEventListener("selectstart", onSelectStart);
      controller0.removeEventListener("selectend", onSelectEnd);
      controller1.removeEventListener("selectstart", onSelectStart);
      controller1.removeEventListener("selectend", onSelectEnd);
    };
  }, [gl, boxRefs, setSelectedBox, updateBoxPosition]);

  // Update dragged object position every frame
  useFrame(() => {
    if (!dragging.current) return;

    const { controller, object, index } = dragging.current;
    
    if (!controller || !object) return;

    // Get controller position and direction
    tempMatrix.current.identity().extractRotation(controller.matrixWorld);
    const controllerPos = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(tempMatrix.current);
    
    // Calculate new position (2 units in front of controller)
    const distance = 2;
    const newWorldPos = controllerPos.clone().add(direction.multiplyScalar(distance));
    newWorldPos.add(dragOffset.current);
    
    // Convert to local position
    if (object.parent) {
      const newLocalPos = object.parent.worldToLocal(newWorldPos);
      object.position.copy(newLocalPos);
    }
  });

  return null;
};

// === Draggable Box Component ===
const DraggableBox = forwardRef(({ index, value, position, selected, onClick, onPositionChange }, ref) => {
  const size = [1.6, 1.2, 1];
  const color = selected ? "#facc15" : index % 2 === 0 ? "#60a5fa" : "#34d399";
  const groupRef = useRef();
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(null);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.userData = { boxIndex: index };
    }
  }, [index]);

  // Mouse/Touch drag for non-AR mode
  const handlePointerDown = (e) => {
    e.stopPropagation();
    setIsDragging(true);
    dragStart.current = {
      x: e.point.x,
      y: e.point.y,
      z: e.point.z,
      posX: position[0],
      posY: position[1],
      posZ: position[2],
    };
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging || !dragStart.current) return;
    e.stopPropagation();
    
    const deltaX = e.point.x - dragStart.current.x;
    const deltaY = e.point.y - dragStart.current.y;
    
    const newX = dragStart.current.posX + deltaX;
    const newY = dragStart.current.posY + deltaY;
    
    if (groupRef.current) {
      groupRef.current.position.x = newX;
      groupRef.current.position.y = newY;
    }
  };

  const handlePointerUp = (e) => {
    if (isDragging && groupRef.current) {
      e.stopPropagation();
      const newPos = [
        groupRef.current.position.x,
        groupRef.current.position.y,
        groupRef.current.position.z,
      ];
      onPositionChange(newPos);
      
      // Only trigger click if we didn't drag much
      const totalDrag = dragStart.current 
        ? Math.abs(groupRef.current.position.x - dragStart.current.posX) + 
          Math.abs(groupRef.current.position.y - dragStart.current.posY)
        : 0;
      
      if (totalDrag < 0.1) {
        onClick();
      }
    }
    setIsDragging(false);
    dragStart.current = null;
  };

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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={isDragging ? "#ff6b6b" : color}
          emissive={selected ? "#fbbf24" : isDragging ? "#ff0000" : "#000000"}
          emissiveIntensity={selected ? 0.4 : isDragging ? 0.3 : 0}
        />
      </mesh>

      <FadeInText
        show={true}
        text={String(value)}
        position={[0, size[1] / 2 + 0.15, size[2] / 2 + 0.01]}
        fontSize={0.4}
        color="white"
      />

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

      {selected && (
        <Text
          position={[0, size[1] + 0.8, 0]}
          fontSize={0.3}
          color="#fde68a"
          anchorX="center"
          anchorY="middle"
        >
          {isDragging ? "Dragging..." : `Value ${value} at index ${index}`}
        </Text>
      )}
    </group>
  );
});

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

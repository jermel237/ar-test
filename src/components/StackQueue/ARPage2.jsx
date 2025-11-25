import React, { useMemo, useState, useRef, useEffect, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

const ARPage2 = () => {
  const [stack, setStack] = useState([10, 20, 30]);
  const [highlighted, setHighlighted] = useState(null);
  const [operationInfo, setOperationInfo] = useState(null);
  const [selectedButton, setSelectedButton] = useState(null);

  // Structure position (whole structure moves together)
  const [structurePos, setStructurePos] = useState([0, 0, -8]);
  const [isDragging, setIsDragging] = useState(false);

  const spacing = 1.6;
  const buttonRefs = useRef([]);
  const structureRef = useRef();

  const addButtonRef = (r) => {
    if (r && !buttonRefs.current.includes(r)) buttonRefs.current.push(r);
  };

  const positions = useMemo(
    () => stack.map((_, i) => [0, i * spacing, 0]),
    [stack, spacing]
  );

  // Drag whole structure
  const onDragStart = () => {
    setIsDragging(true);
    setOperationInfo(null);
  };

  const onDragMove = (newPos) => {
    setStructurePos(newPos);
  };

  const onDragEnd = () => {
    setIsDragging(false);
  };

  // === Utility ===
  const showOperationInfo = (title, complexity, description) => {
    if (!isDragging) {
      setOperationInfo({ title, complexity, description });
    }
  };

  // === Stack Operations ===
  const handlePush = () => {
    if (isDragging) return;
    const newVal = Math.floor(Math.random() * 90) + 10;
    setStack((prev) => [...prev, newVal]);
    showOperationInfo(
      "Push()",
      "O(1)",
      "Adds a new element on top of the stack."
    );
  };

  const handlePop = () => {
    if (isDragging) return;
    if (stack.length === 0) return;
    setStack((prev) => prev.slice(0, -1));
    showOperationInfo(
      "Pop()",
      "O(1)",
      "Removes the top element from the stack."
    );
  };

  const handlePeek = () => {
    if (isDragging) return;
    if (stack.length === 0) return;
    const topIndex = stack.length - 1;
    setHighlighted(topIndex);
    setTimeout(() => setHighlighted(null), 1000);
    showOperationInfo(
      "Peek()",
      "O(1)",
      "Views the top element without removing it."
    );
  };

  // === Auto-start AR ===
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
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />

        {/* Whole structure group - moves together when dragging */}
        <group position={structurePos} ref={structureRef}>
          <FadeInText
            show={true}
            text={"Stack Operations & Complexity"}
            position={[5, 5, 0]}
            fontSize={0.6}
            color="white"
          />

          {/* Dragging indicator */}
          {isDragging && (
            <FadeInText
              show={true}
              text={"✋ Moving Structure..."}
              position={[5, 4.3, 0]}
              fontSize={0.4}
              color="#f97316"
            />
          )}

          <StackBackground height={stack.length * spacing + 2} isDragging={isDragging} />

          {stack.map((value, i) => (
            <StackBox
              key={i}
              index={i}
              value={value}
              position={[0, i * spacing, 0]}
              isTop={i === stack.length - 1}
              highlight={highlighted === i}
            />
          ))}

          {operationInfo && !isDragging && (
            <OperationInfoPanel info={operationInfo} position={[-6, 2, 0]} />
          )}

          {!isDragging && (
            <OperationsPanelAR
              position={[5, 2, 0]}
              onPush={handlePush}
              onPop={handlePop}
              onPeek={handlePeek}
              addButtonRef={addButtonRef}
              selectedButton={selectedButton}
            />
          )}
        </group>

        <ARInteractionManager
          buttonRefs={buttonRefs}
          structureRef={structureRef}
          setSelectedButton={setSelectedButton}
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
  buttonRefs, 
  structureRef,
  setSelectedButton,
  isDragging,
  onDragStart,
  onDragMove,
  onDragEnd
}) => {
  const { gl } = useThree();
  const longPressTimer = useRef(null);
  const touchedButton = useRef(null);
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

        const candidates = (buttonRefs.current || [])
          .map((group) => (group ? group.children : []))
          .flat();

        const intersects = raycaster.intersectObjects(candidates, true);
        if (intersects.length > 0) {
          let hit = intersects[0].object;
          while (hit && hit.userData?.btnAction === undefined && hit.parent) {
            hit = hit.parent;
          }
          const action = hit?.userData?.btnAction;
          if (action) {
            return { type: 'button', action };
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
        
        if (hitInfo?.type === 'button') {
          touchedButton.current = hitInfo.action;
          touchedStructure.current = true;
        } else if (hitInfo !== null) {
          touchedStructure.current = true;
          touchedButton.current = null;
        } else {
          touchedStructure.current = false;
          touchedButton.current = null;
        }

        // If touching any part of structure, start long press for drag
        if (touchedStructure.current) {
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
        } else if (touchedButton.current) {
          // Short tap on button - trigger action
          setSelectedButton(touchedButton.current);
        }

        touchedButton.current = null;
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
  }, [gl, buttonRefs, structureRef, setSelectedButton, onDragStart, onDragMove, onDragEnd]);

  return null;
};

// === Stack Background ===
const StackBackground = ({ height, isDragging }) => {
  const geometry = useMemo(
    () => new THREE.BoxGeometry(3.5, height, 0.08),
    [height]
  );
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);

  return (
    <group position={[0, height / 2 - 1, -0.5]}>
      <mesh geometry={geometry}>
        <meshBasicMaterial 
          color={isDragging ? "#1e3a5f" : "#1e293b"} 
          opacity={0.3} 
          transparent 
        />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial 
          color={isDragging ? "#f97316" : "#64748b"} 
          linewidth={2} 
        />
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
      opacity.current = Math.min(opacity.current + 0.05, 1);
      scale.current = Math.min(scale.current + 0.05, 1);
    } else {
      opacity.current = Math.max(opacity.current - 0.05, 0);
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

// === Stack Box ===
const StackBox = ({ index, value, position, isTop, highlight }) => {
  const size = [2, 1, 1];
  const color = highlight ? "#facc15" : isTop ? "#60a5fa" : "#34d399";
  const meshRef = useRef();

  useFrame(() => {
    if (meshRef.current && meshRef.current.scale.y < 1) {
      meshRef.current.scale.y += 0.1;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef} position={[0, 0.5, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} />
      </mesh>

      <FadeInText
        show={true}
        text={String(value)}
        position={[0, 0.6, 0.57]}
        fontSize={0.4}
        color="white"
      />

      {isTop && (
        <Text
          position={[0, 1.6, 0]}
          fontSize={0.3}
          color="#fde68a"
          anchorX="center"
          anchorY="middle"
        >
          🟢 Top
        </Text>
      )}
    </group>
  );
};

// === AR Operations Panel ===
const OperationsPanelAR = ({
  position,
  onPush,
  onPop,
  onPeek,
  addButtonRef,
  selectedButton,
}) => {
  const [activeButton, setActiveButton] = useState(null);

  useEffect(() => {
    if (selectedButton) {
      setActiveButton(selectedButton);
      if (selectedButton === "push") onPush();
      if (selectedButton === "pop") onPop();
      if (selectedButton === "peek") onPeek();
      setTimeout(() => setActiveButton(null), 400);
    }
  }, [selectedButton, onPush, onPop, onPeek]);

  const renderButton = (label, action, y) => {
    const isActive = activeButton === action;
    const color = isActive ? "#22c55e" : "#38bdf8";

    return (
      <group
        ref={addButtonRef}
        position={[0, y, 0]}
        userData={{ btnAction: action }}
      >
        <mesh>
          <boxGeometry args={[2.6, 0.6, 0.1]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <Text
          position={[0, 0, 0.06]}
          fontSize={0.33}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      </group>
    );
  };

  return (
    <group position={position}>
      <FadeInText
        show={true}
        text={"Stack Functions:"}
        position={[0, 2, 0]}
        fontSize={0.35}
        color="#fde68a"
      />
      {renderButton("➕ Push", "push", 1.2)}
      {renderButton("➖ Pop", "pop", 0.4)}
      {renderButton("👁️ Peek", "peek", -0.4)}
      <FadeInText
        show={true}
        text={"All operations → O(1)"}
        position={[0, -2, 0]}
        fontSize={0.28}
        color="#fef9c3"
      />
    </group>
  );
};

// === Operation Info Panel ===
const OperationInfoPanel = ({ info, position }) => {
  const content = [
    `🔹 ${info.title}`,
    `Complexity: ${info.complexity}`,
    "",
    info.description,
  ].join("\n");
  return (
    <group>
      <FadeInText
        show={true}
        text={content}
        position={position}
        fontSize={0.32}
        color="#a5f3fc"
      />
    </group>
  );
};

export default ARPage2;

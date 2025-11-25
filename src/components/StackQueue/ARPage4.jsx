import React, { useMemo, useState, useRef, useEffect, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

const ARPage4 = () => {
  const [queue, setQueue] = useState([15, 25, 35]);
  const [highlighted, setHighlighted] = useState(null);
  const [operationInfo, setOperationInfo] = useState(null);
  const [selectedButton, setSelectedButton] = useState(null);
  const buttonRefs = useRef([]);
  const structureRef = useRef();

  // Structure position (whole structure moves together)
  const [structurePos, setStructurePos] = useState([0, 0, -6]);
  const [isDragging, setIsDragging] = useState(false);

  const spacing = 2;

  const positions = useMemo(
    () => queue.map((_, i) => [i * spacing, 0, 0]),
    [queue, spacing]
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

  const showOperationInfo = (title, complexity, description) => {
    if (!isDragging) {
      setOperationInfo({ title, complexity, description });
    }
  };

  // === Queue Operations ===
  const handleEnqueue = () => {
    if (isDragging) return;
    const newVal = Math.floor(Math.random() * 90) + 10;
    setQueue((prev) => [...prev, newVal]);
    showOperationInfo(
      "Enqueue()",
      "O(1)",
      "Adds an element to the rear of the queue."
    );
  };

  const handleDequeue = () => {
    if (isDragging) return;
    if (queue.length === 0) return;
    setHighlighted(0);
    setTimeout(() => {
      setQueue((prev) => prev.slice(1));
      setHighlighted(null);
    }, 600);
    showOperationInfo(
      "Dequeue()",
      "O(1)",
      "Removes the element from the front of the queue."
    );
  };

  const handlePeek = () => {
    if (isDragging) return;
    if (queue.length === 0) return;
    setHighlighted(0);
    showOperationInfo(
      "Peek()",
      "O(1)",
      "Views the element at the front without removing it."
    );
    setTimeout(() => setHighlighted(null), 600);
  };

  // === Start AR session ===
  const startAR = (gl) => {
    if (navigator.xr) {
      navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
        if (supported) {
          navigator.xr
            .requestSession("immersive-ar", {
              requiredFeatures: ["hit-test", "local-floor"],
            })
            .then((session) => gl.xr.setSession(session))
            .catch((err) => console.error("AR session failed:", err));
        } else {
          console.warn("AR not supported on this device.");
        }
      });
    }
  };

  const addButtonRef = (r) => {
    if (r && !buttonRefs.current.includes(r)) buttonRefs.current.push(r);
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
            text={"Queue Operations & Complexity"}
            position={[0, 4.5, 0]}
            fontSize={0.55}
            color="white"
          />

          <FadeInText
            show={true}
            text={isDragging ? "✋ Moving Structure..." : "Each operation has constant time complexity — O(1)"}
            position={[0, 3.8, 0]}
            fontSize={0.35}
            color={isDragging ? "#f97316" : "#fde68a"}
          />

          <QueueBase width={queue.length * spacing + 2} isDragging={isDragging} />

          {queue.map((value, i) => (
            <QueueBox
              key={i}
              value={value}
              position={positions[i]}
              isFront={i === 0}
              isRear={i === queue.length - 1}
              highlight={highlighted === i}
            />
          ))}

          {operationInfo && !isDragging && (
            <OperationInfoPanel info={operationInfo} position={[-6, 1.5, 0]} />
          )}

          {!isDragging && (
            <OperationsPanel
              position={[6, 1.5, 0]}
              onEnqueue={handleEnqueue}
              onDequeue={handleDequeue}
              onPeek={handlePeek}
              addButtonRef={addButtonRef}
              selectedButton={selectedButton}
            />
          )}

          <FadeInText
            show={!isDragging}
            text={"Queues process elements in the order they arrive (FIFO)."}
            position={[0, -2.5, 0]}
            fontSize={0.35}
            color="#a5f3fc"
          />
        </group>

        <ARInteractionManager
          buttonRefs={buttonRefs}
          structureRef={structureRef}
          setSelectedButton={setSelectedButton}
          handleEnqueue={handleEnqueue}
          handleDequeue={handleDequeue}
          handlePeek={handlePeek}
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
  handleEnqueue,
  handleDequeue,
  handlePeek,
  isDragging,
  onDragStart,
  onDragMove,
  onDragEnd,
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
          while (hit && hit.userData?.action === undefined && hit.parent) {
            hit = hit.parent;
          }
          const action = hit?.userData?.action;
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
        
        // Project ray to a distance (6 units in front)
        const distance = 6;
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
          const action = touchedButton.current;
          setSelectedButton(action);
          if (action === "enqueue") handleEnqueue();
          else if (action === "dequeue") handleDequeue();
          else if (action === "peek") handlePeek();
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
  }, [gl, buttonRefs, structureRef, setSelectedButton, handleEnqueue, handleDequeue, handlePeek, onDragStart, onDragMove, onDragEnd]);

  return null;
};

// === Queue Base ===
const QueueBase = ({ width, isDragging }) => {
  const geometry = useMemo(() => new THREE.BoxGeometry(width, 0.2, 2), [width]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);
  
  return (
    <group position={[width / 2 - 2, -0.1, 0]}>
      <mesh>
        <primitive object={geometry} />
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
      maxWidth={10}
      textAlign="center"
    >
      {text}
    </Text>
  );
};

// === Queue Box ===
const QueueBox = ({ value, position, isFront, isRear, highlight }) => {
  const color = highlight ? "#facc15" : "#34d399";
  const meshRef = useRef();

  useFrame(() => {
    if (meshRef.current && meshRef.current.scale.y < 1) {
      meshRef.current.scale.y += 0.1;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef} position={[0, 0.5, 0]}>
        <boxGeometry args={[1.5, 1, 1]} />
        <meshStandardMaterial color={color} />
      </mesh>

      <FadeInText
        show={true}
        text={String(value)}
        position={[0, 0.5, 0.6]}
        fontSize={0.4}
        color="white"
      />

      {isFront && (
        <Text position={[-1.6, 0.5, 0]} fontSize={0.3} color="#60a5fa">
          Front 🔵
        </Text>
      )}
      {isRear && (
        <Text position={[1.6, 0.5, 0]} fontSize={0.3} color="#f472b6">
          🟣 Rear
        </Text>
      )}
    </group>
  );
};

// === Operations Panel ===
const OperationsPanel = ({
  position,
  onEnqueue,
  onDequeue,
  onPeek,
  addButtonRef,
  selectedButton,
}) => {
  const [activeButton, setActiveButton] = useState(null);

  useEffect(() => {
    if (selectedButton) {
      setActiveButton(selectedButton);
      const t = setTimeout(() => setActiveButton(null), 300);
      return () => clearTimeout(t);
    }
  }, [selectedButton]);

  const renderButton = (label, action, y, callback) => {
    const isActive = activeButton === action;
    const color = isActive ? "#22c55e" : "#38bdf8";

    return (
      <group position={[0, y, 0]} ref={addButtonRef} userData={{ action }}>
        <mesh onClick={callback} castShadow receiveShadow userData={{ action }}>
          <boxGeometry args={[2.8, 0.6, 0.1]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <Text position={[0, 0, 0.06]} fontSize={0.35} color="white" anchorX="center" anchorY="middle">
          {label}
        </Text>
      </group>
    );
  };

  return (
    <group position={position}>
      <FadeInText
        show={true}
        text={"Queue Functions:"}
        position={[0, 3, 0]}
        fontSize={0.35}
        color="#fde68a"
      />

      {renderButton("➕ Enqueue", "enqueue", 2.2, onEnqueue)}
      {renderButton("➖ Dequeue", "dequeue", 1.4, onDequeue)}
      {renderButton("👁 Peek", "peek", 0.6, onPeek)}

      <FadeInText
        show={true}
        text={"Each → O(1)"}
        position={[0, -2, 0]}
        fontSize={0.3}
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
    <FadeInText
      show={true}
      text={content}
      position={position}
      fontSize={0.32}
      color="#a5f3fc"
    />
  );
};

export default ARPage4;

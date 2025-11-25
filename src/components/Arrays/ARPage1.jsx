import React, { useMemo, useState, useRef, useEffect, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { initARSession, isIOS } from "../../utils/arCompatibility";
import { setupXRInput } from "../../utils/xrInput";

const VisualPageAR = ({ data = [10, 20, 30, 40], spacing = 2.0 }) => {
  const [showPanel, setShowPanel] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedBox, setSelectedBox] = useState(null);
  
  // Structure position (whole array moves together)
  const [structurePos, setStructurePos] = useState([0, 0, -8]);
  const [isDragging, setIsDragging] = useState(false);
  
  const boxRefs = useRef([]);
  const structureRef = useRef();

  const addBoxRef = (r) => {
    if (r && !boxRefs.current.includes(r)) boxRefs.current.push(r);
  };

  const positions = useMemo(() => {
    const mid = (data.length - 1) / 2;
    return data.map((_, i) => [(i - mid) * spacing, 0, 0]);
  }, [data, spacing]);

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

  // Drag whole structure
  const onDragStart = () => {
    setIsDragging(true);
    setShowPanel(false);
    setSelectedBox(null);
  };

  const onDragMove = (newPos) => {
    setStructurePos(newPos);
  };

  const onDragEnd = () => {
    setIsDragging(false);
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

        {/* Whole structure group - this moves when dragging */}
        <group position={structurePos} ref={structureRef}>
          
          <FadeInText
            show={true}
            text={"Array Data Structure"}
            position={[0, 3, 0]}
            fontSize={0.7}
            color="white"
          />

          {/* Dragging indicator */}
          {isDragging && (
            <FadeInText
              show={true}
              text={"✋ Moving Structure..."}
              position={[0, 4, 0]}
              fontSize={0.5}
              color="#f97316"
            />
          )}

          <ArrayBackground data={data} spacing={spacing} isDragging={isDragging} />

          {data.map((value, i) => (
            <Box
              key={i}
              index={i}
              value={value}
              position={positions[i]}
              selected={selectedBox === i}
              onClick={() => handleClick(i)}
              ref={(r) => addBoxRef(r)}
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

        <ARInteractionManager
          boxRefs={boxRefs}
          structureRef={structureRef}
          setSelectedBox={setSelectedBox}
          isDragging={isDragging}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          structurePos={structurePos}
        />
        <OrbitControls makeDefault enabled={!isDragging} />
      </Canvas>
    </div>
  );
};

// --- AR Interaction Manager ---
const ARInteractionManager = ({
  boxRefs,
  structureRef,
  setSelectedBox,
  isDragging,
  onDragStart,
  onDragMove,
  onDragEnd,
  structurePos
}) => {
  const { gl } = useThree();
  const longPressTimer = useRef(null);
  const touchedBox = useRef(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    if (isIOS()) return;

    const cleanup = setupXRInput(gl, {
      getCandidates: () => {
        const all = [];
        boxRefs.current.forEach((g) => {
          if (g && g.children) {
            g.children.forEach((c) => all.push(c));
          }
        });
        return all;
      },
      onSelect: (hit) => {
        // short tap/select -> choose box
        if (hit && hit.index !== undefined && hit.index >= 0) setSelectedBox(hit.index);
      },
      onSelectStart: () => {
        // used for long-press/drag start if needed by app logic
      },
      onDragMove: (hit) => {
        // while dragging, update position using ray hit point
        if (isDraggingRef.current && hit && hit.point) {
          onDragMove([hit.point.x, hit.point.y, hit.point.z]);
        }
      },
      onSelectEnd: () => {
        // drop structure
        if (isDraggingRef.current) onDragEnd();
      },
    });

    return () => {
      try {
        if (typeof cleanup === "function") cleanup();
      } catch (e) {}
    };
  }, [gl, boxRefs, structureRef, setSelectedBox, onDragStart, onDragMove, onDragEnd, structurePos]);

  return null;
};

// === Background ===
const ArrayBackground = ({ data, spacing, isDragging }) => {
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
        <meshStandardMaterial 
          color={isDragging ? "#1e3a5f" : "#0f172a"} 
          emissive={isDragging ? "#f97316" : "#000000"}
          emissiveIntensity={isDragging ? 0.2 : 0}
        />
      </mesh>
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial color={isDragging ? "#f97316" : "#ffffff"} />
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
const Box = forwardRef(({ index, value, position, selected, onClick }, ref) => {
  const size = [1.6, 1.2, 1];
  const color = selected ? "#facc15" : index % 2 === 0 ? "#60a5fa" : "#34d399";
  const groupRef = useRef();

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
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? "#fbbf24" : "#000000"}
          emissiveIntensity={selected ? 0.4 : 0}
        />
      </mesh>

      <FadeInText
        show={true}
        text={String(value)}
        position={[0, size[1] / 2 + 0.15, size[2] / 2 + 0.01]}
        fontSize={0.4}
        color="white"
      />

      <mesh onClick={onClick} position={[0, -0.3, size[2] / 2 + 0.01]}>
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
          Value {value} at index {index}
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

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { initARSession, isIOS } from "../../utils/arCompatibility";
import { setupXRInput } from "../../utils/xrInput";

const ARPage1 = ({ data = [35, 10, 25, 5, 15], spacing = 2 }) => {
  const [sorted, setSorted] = useState(false);
  const [boxes, setBoxes] = useState(data);
  const boxRefs = useRef([]);

  // Helper to collect refs
  const addBoxRef = (ref) => {
    if (ref && !boxRefs.current.includes(ref)) boxRefs.current.push(ref);
  };

  // Compute heights
  const heights = useMemo(() => {
    const maxVal = Math.max(...boxes);
    return boxes.map((v) => (v / maxVal) * 2 + 0.5);
  }, [boxes]);

  // Compute positions
  const positions = useMemo(() => {
    const mid = (boxes.length - 1) / 2;
    return boxes.map((_, i) => [(i - mid) * spacing, 0, 0]);
  }, [boxes, spacing]);

  // Handle sorting click
  const handleSortClick = () => {
    if (!sorted) {
      const sortedData = [...boxes].sort((a, b) => a - b);
      setBoxes(sortedData);
      setSorted(true);
    } else {
      setBoxes(data);
      setSorted(false);
    }
  };

  // Pseudo code generator
  const generateCode = () => {
    return [
      "📘 Pseudo Code Example:",
      "",
      "array = [35, 10, 25, 5, 15]",
      "print('Before Sorting:', array)",
      "",
      "sort(array)   // Arrange values in ascending order",
      "print('After Sorting:', array)",
      "",
      "// Result: [5, 10, 15, 25, 35]",
    ].join("\n");
  };

  // --- Auto start AR ---
  const startAR = async (gl) => {
    await initARSession(gl);
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
        {/* Lights */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={1} />

        <group position={[0, 0, -8]}>
          {/* Header */}
          <FadeText
            text="Introduction to Sorting Algorithms"
            position={[0, 4.5, 0]}
            fontSize={0.6}
            color="#facc15"
          />

          {/* Instruction */}
          <FadeText
            text={
              sorted
                ? "The array is now sorted in ascending order!"
                : "Click any box to visualize sorting"
            }
            position={[0, 3.8, 0]}
            fontSize={0.35}
            color="white"
          />

          {/* Boxes */}
          {boxes.map((value, i) => (
            <AnimatedBox
              key={i}
              index={i}
              value={value}
              height={heights[i]}
              position={positions[i]}
              sorted={sorted}
              onClick={handleSortClick}
              ref={(r) => addBoxRef(r)}
            />
          ))}

          {/* Code Panel */}
          {sorted && <CodePanel code={generateCode()} position={[8.8, 1, 0]} />}
        </group>

        {/* AR click/tap handler */}
        <ARInteractionManager boxRefs={boxRefs} onSelectBox={handleSortClick} />

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};

// === AR Interaction Manager ===
const ARInteractionManager = ({ boxRefs, onSelectBox }) => {
  const { gl } = useThree();

  useEffect(() => {
    if (isIOS()) return;

    const cleanup = setupXRInput(gl, {
      getCandidates: () => (boxRefs.current || []).map((g) => (g ? g.children : [])).flat(),
      onSelect: (hit) => {
        if (hit) onSelectBox();
      },
    });

    return () => {
      try {
        if (typeof cleanup === "function") cleanup();
      } catch (e) {}
    };
  }, [gl, boxRefs, onSelectBox]);

  return null;
};

// === Animated Box Component ===
const AnimatedBox = React.forwardRef(
  ({ index, value, height, position, sorted, onClick }, ref) => {
    const meshRef = useRef();
    const groupRef = useRef();
    const targetY = height / 2;
    const targetColor = sorted
      ? new THREE.Color("#34d399")
      : new THREE.Color("#60a5fa");

    useEffect(() => {
      if (groupRef.current) groupRef.current.userData = { boxIndex: index };
    }, [index]);

    useFrame(() => {
      if (!meshRef.current) return;
      meshRef.current.position.x +=
        (position[0] - meshRef.current.position.x) * 0.1;
      meshRef.current.position.y +=
        (targetY - meshRef.current.position.y) * 0.1;
      meshRef.current.material.color.lerp(targetColor, 0.1);
    });

    return (
      <group
        ref={(g) => {
          groupRef.current = g;
          if (typeof ref === "function") ref(g);
          else if (ref) ref.current = g;
        }}
      >
        <mesh ref={meshRef} onClick={onClick}>
          <boxGeometry args={[1.6, height, 1]} />
          <meshStandardMaterial
            color={sorted ? "#34d399" : "#60a5fa"}
            emissive={sorted ? "#fbbf24" : "#000000"}
            emissiveIntensity={sorted ? 0.5 : 0}
          />
        </mesh>

        <Text
          position={[position[0], height + 0.3, 0]}
          fontSize={0.35}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {String(value)}
        </Text>
      </group>
    );
  }
);

// === Code Panel ===
const CodePanel = ({ code, position }) => (
  <FadeText text={code} position={position} fontSize={0.3} color="#c7d2fe" />
);

// === Fade Text ===
const FadeText = ({ text, position, fontSize = 0.5, color = "white" }) => {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    let frame;
    let start;
    const duration = 1000;
    const animate = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setOpacity(progress);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

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

export default ARPage1;

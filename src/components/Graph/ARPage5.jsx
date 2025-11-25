// ARPage5.jsx
import React, { useState, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Text } from "@react-three/drei";

const ARPage5 = ({
  data = [10, 20, 30, 40, 50],
  spacing = 2.0,
  deleteIndex = 2, // index to delete
  loopDelay = 3000,
}) => {
  const [boxes, setBoxes] = useState(data);
  const [status, setStatus] = useState("Idle");
  const [highlightIndex, setHighlightIndex] = useState(null);
  const [phase, setPhase] = useState(0);

  // positions update based on count
  const positions = useMemo(() => {
    const mid = (boxes.length - 1) / 2;
    return boxes.map((_, i) => [(i - mid) * spacing, 0, 0]);
  }, [boxes, spacing]);

  useEffect(() => {
    const runSequence = async () => {
      setBoxes(data);
      setStatus(
        `Deleting value ${data[deleteIndex]} at index ${deleteIndex}...`
      );
      setHighlightIndex(deleteIndex);

      await delay(2000);

      setHighlightIndex(null);
      setStatus(`Removing value ${data[deleteIndex]}...`);
      await delay(1000);

      const newArr = data.filter((_, i) => i !== deleteIndex);
      setBoxes(newArr);

      setStatus("Shifting elements...");
      await delay(2000);

      setStatus("✅ Deletion complete!");
      await delay(loopDelay);

      setPhase((p) => p + 1); // restart loop
    };

    runSequence();
  }, [phase, data, deleteIndex, loopDelay]);

  return (
    <div className="w-full h-screen">
      <Canvas
        camera={{ position: [0, 2, 6], fov: 50 }}
        gl={{ alpha: true }}
        shadows
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          if (navigator.xr) {
            navigator.xr
              .requestSession("immersive-ar", {
                requiredFeatures: ["local-floor"], // ✅ no hit-test
              })
              .then((session) => gl.xr.setSession(session))
              .catch((err) => console.error("❌ AR session failed:", err));
          }
        }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />

        {/* ✅ Fixed group in front of user */}
        <group position={[0, 1, -2]} scale={[0.1, 0.1, 0.1]}>
          {/* Status text floating above */}
          <Text
            position={[0, 3, 0]}
            fontSize={0.5}
            anchorX="center"
            anchorY="middle"
            color="white"
          >
            {status}
          </Text>

          {/* Boxes */}
          {boxes.map((value, i) => (
            <Box
              key={i}
              index={i}
              value={value}
              position={positions[i]}
              highlight={highlightIndex === i}
            />
          ))}

          {/* Ground plane */}
          <mesh rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[10, 10]} />
            <shadowMaterial opacity={0.3} />
          </mesh>
        </group>
      </Canvas>
    </div>
  );
};

const Box = ({ index, value, position, highlight }) => {
  const size = [1.6, 1.2, 1];
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={highlight ? "#f87171" : "#60a5fa"}
          emissive={highlight ? "#facc15" : "#000000"}
          emissiveIntensity={highlight ? 0.9 : 0}
        />
      </mesh>

      <Text
        position={[0, size[1] / 2 + 0.15, size[2] / 2 + 0.01]}
        fontSize={0.35}
        anchorX="center"
        anchorY="middle"
      >
        {String(value)}
      </Text>

      <Text
        position={[0, size[1] / 2 - 0.35, size[2] / 2 + 0.01]}
        fontSize={0.2}
        anchorX="center"
        anchorY="middle"
      >
        {`[${index}]`}
      </Text>
    </group>
  );
};

// small delay utility
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default ARPage5;

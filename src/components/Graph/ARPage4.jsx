import React, { useMemo, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Text } from "@react-three/drei";

const ARPage4 = ({
  data = [10, 20, 30, 40],
  spacing = 2.0,
  insertValue = 90,
  insertIndex = 2,
}) => {
  const [boxes, setBoxes] = useState(data);
  const [activeIndex, setActiveIndex] = useState(null);
  const [operationText, setOperationText] = useState("Starting AR...");
  const [placed, setPlaced] = useState(true); // ✅ always placed now

  // update sequence
  useEffect(() => {
    if (!placed) return;

    const steps = [
      {
        text: `Insert ${insertValue} at index ${insertIndex}`,
        arr: data,
        highlight: null,
        delay: 2000,
      },
      {
        text: `Appending ${insertValue}...`,
        arr: [...data, insertValue],
        highlight: data.length,
        delay: 2000,
      },
      {
        text: `Comparing ${insertValue} with 40...`,
        arr: [...data, insertValue],
        highlight: data.length - 1,
        delay: 2000,
      },
      {
        text: `Placing ${insertValue} at index ${insertIndex}`,
        arr: [
          ...data.slice(0, insertIndex),
          insertValue,
          ...data.slice(insertIndex),
        ],
        highlight: insertIndex,
        delay: 2000,
      },
      {
        text: `✅ Insertion complete`,
        arr: [
          ...data.slice(0, insertIndex),
          insertValue,
          ...data.slice(insertIndex),
        ],
        highlight: null,
        delay: 3000,
      },
    ];

    let currentStep = 0;
    let loop;

    const runStep = () => {
      const step = steps[currentStep];
      setOperationText(step.text);
      setBoxes(step.arr);
      setActiveIndex(step.highlight);

      loop = setTimeout(() => {
        currentStep++;
        if (currentStep >= steps.length) currentStep = 0; // loop
        runStep();
      }, step.delay);
    };

    runStep();
    return () => clearTimeout(loop);
  }, [placed]);

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
        <directionalLight position={[5, 10, 5]} intensity={1} castShadow />

        {/* ✅ Fixed-position group in front of user */}
        <group position={[0, 1, -2]} scale={[0.1, 0.1, 0.1]}>
          {/* Operation text */}
          <Text
            position={[0, 3, 0]}
            fontSize={0.5}
            anchorX="center"
            anchorY="middle"
            color="white"
          >
            {operationText}
          </Text>

          {/* Boxes */}
          {boxes.map((value, i) => {
            const mid = (boxes.length - 1) / 2;
            return (
              <Box
                key={i}
                index={i}
                value={value}
                position={[(i - mid) * spacing, 0, 0]}
                highlight={activeIndex === i}
              />
            );
          })}

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

const Box = ({ index, value, position = [0, 0, 0], highlight }) => {
  const size = [1.6, 1.2, 1];
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={
            highlight ? "#facc15" : index % 2 === 0 ? "#60a5fa" : "#34d399"
          }
          emissive={highlight ? "#facc15" : "#000"}
          emissiveIntensity={highlight ? 1 : 0}
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

export default ARPage4;

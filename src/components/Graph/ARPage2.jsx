import React, { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

const ARPage2 = () => {
  const [selected, setSelected] = useState(null);
  const matrixRef = useRef();
  const listRef = useRef();
  const allRefs = useRef([]);

  const addRef = (r) => {
    if (r && !allRefs.current.includes(r)) allRefs.current.push(r);
  };

  // === Definitions ===
  const definitions = {
    matrix: [
      "📘 Adjacency Matrix:",
      "",
      "• 2D array where matrix[i][j] = 1 if an edge exists, else 0.",
      "• Pros: Simple, fast edge lookup.",
      "• Cons: Uses O(V²) space.",
      "",
      "📘 Pseudo Code Example:",
      "matrix[V][V] = 0",
      "for each edge (u, v):",
      "    matrix[u][v] = 1",
      "    matrix[v][u] = 1",
    ].join("\n"),

    list: [
      "📗 Adjacency List:",
      "",
      "• Each vertex stores a list of connected vertices.",
      "• Pros: Efficient for sparse graphs.",
      "• Cons: Slower for direct edge lookup.",
      "",
      "📘 Pseudo Code Example:",
      "adj[V] = {}",
      "for each edge (u, v):",
      "    adj[u].append(v)",
      "    adj[v].append(u)",
    ].join("\n"),
  };

  const handleSelect = (type) => {
    setSelected((prev) => (prev === type ? null : type));
  };

  // === Auto Start AR Session ===
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
        camera={{ position: [0, 2, 25], fov: 50 }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          startAR(gl);
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />

        {/* === Group adjusted for AR === */}
        <group position={[0, 0, -9]} scale={[0.7, 0.7, 0.7]}>
          <FadeInText
            show={true}
            text={"Graph Representation"}
            position={[0, 4.5, 0]}
            fontSize={0.7}
            color="white"
          />

          <AdjacencyMatrix
            ref={(r) => {
              matrixRef.current = r;
              addRef(r);
            }}
            position={[-6.5, -1, 0]}
            selected={selected === "matrix"}
            onClick={() => handleSelect("matrix")}
          />

          <AdjacencyList
            ref={(r) => {
              listRef.current = r;
              addRef(r);
            }}
            position={[6, -1, 0]}
            selected={selected === "list"}
            onClick={() => handleSelect("list")}
          />

          {selected && (
            <DefinitionPanel
              type={selected}
              definition={definitions[selected]}
              position={[0, -1, 0]}
              onClose={() => setSelected(null)}
            />
          )}
        </group>

        <ARInteractionManager allRefs={allRefs} setSelected={setSelected} />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};

// === AR Interaction Manager ===
const ARInteractionManager = ({ allRefs, setSelected }) => {
  const { gl } = useThree();

  useEffect(() => {
    const onSessionStart = () => {
      const session = gl.xr.getSession();
      if (!session) return;

      const onSelect = () => {
        const xrCamera = gl.xr.getCamera();
        const raycaster = new THREE.Raycaster();
        const cam = xrCamera.cameras ? xrCamera.cameras[0] : xrCamera;
        const dir = new THREE.Vector3(0, 0, -1)
          .applyQuaternion(cam.quaternion)
          .normalize();
        const origin = cam.getWorldPosition(new THREE.Vector3());
        raycaster.set(origin, dir);

        const candidates = (allRefs.current || [])
          .map((group) => (group ? group.children : []))
          .flat();

        const intersects = raycaster.intersectObjects(candidates, true);
        if (intersects.length > 0) {
          const hit = intersects[0].object;
          const parentGroup = hit.parent;
          if (parentGroup?.userData?.type) {
            setSelected(parentGroup.userData.type);
          }
        }
      };

      session.addEventListener("select", onSelect);
      const onEnd = () => session.removeEventListener("select", onSelect);
      session.addEventListener("end", onEnd);
    };

    gl.xr.addEventListener("sessionstart", onSessionStart);
    return () => gl.xr.removeEventListener("sessionstart", onSessionStart);
  }, [gl, allRefs, setSelected]);

  return null;
};

// === Adjacency Matrix Visualization ===
const AdjacencyMatrix = React.forwardRef(
  ({ position, selected, onClick }, ref) => {
    const boxes = useMemo(() => {
      const items = [];
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          const hasEdge = Math.random() > 0.5;
          items.push({
            key: `${i}-${j}`,
            pos: [j - 1.5, 1.5 - i, 0],
            active: hasEdge,
          });
        }
      }
      return items;
    }, []);

    const groupRef = useRef();
    useEffect(() => {
      if (groupRef.current) groupRef.current.userData = { type: "matrix" };
      if (typeof ref === "function") ref(groupRef.current);
      else if (ref) ref.current = groupRef.current;
    }, [ref]);

    return (
      <group ref={groupRef} position={position}>
        <FadeInText
          show={true}
          text={"Adjacency Matrix"}
          position={[0, 3, 0]}
          fontSize={0.4}
          color="#93c5fd"
        />
        {boxes.map((b) => (
          <mesh key={b.key} position={b.pos} onClick={onClick}>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <meshStandardMaterial
              color={b.active ? "#fa5741" : "#28438f"}
              emissive={selected && b.active ? "#facc15" : "#000"}
              emissiveIntensity={selected && b.active ? 0.5 : 0}
            />
          </mesh>
        ))}
        <Text
          position={[0, -2.8, 0]}
          fontSize={0.3}
          color="yellow"
          anchorX="center"
          anchorY="middle"
        >
          [Matrix]
        </Text>
      </group>
    );
  }
);

// === Adjacency List Visualization ===
// === Adjacency List Visualization (Updated) ===
const AdjacencyList = React.forwardRef(
  ({ position, selected, onClick }, ref) => {
    const nodes = useMemo(
      () => [
        { id: 0, connections: [1, 2] },
        { id: 1, connections: [3] },
        { id: 2, connections: [3] },
        { id: 3, connections: [] },
      ],
      []
    );

    const groupRef = useRef();
    useEffect(() => {
      if (groupRef.current) groupRef.current.userData = { type: "list" };
      if (typeof ref === "function") ref(groupRef.current);
      else if (ref) ref.current = groupRef.current;
    }, [ref]);

    return (
      <group ref={groupRef} position={position}>
        <FadeInText
          show={true}
          text={"Adjacency List"}
          position={[0, 3, 0]}
          fontSize={0.4}
          color="#93c5fd"
        />

        {nodes.map((node, i) => (
          <group key={i} position={[0, 2 - i * 1.2, 0]}>
            {/* Main Node Box (Clickable) */}
            <mesh onClick={onClick}>
              <boxGeometry args={[0.7, 0.7, 0.7]} />
              <meshStandardMaterial
                color={selected ? "#34d399" : "#4ade80"}
                emissive={selected ? "#facc15" : "#000"}
                emissiveIntensity={selected ? 0.5 : 0}
              />
            </mesh>

            {/* Connected Nodes (Smaller Boxes) */}
            {node.connections.map((c, j) => (
              <mesh
                key={j}
                position={[1.2 + j * 0.9, 0, 0]}
                onClick={onClick} // make connected boxes clickable too
              >
                <boxGeometry args={[0.45, 0.45, 0.45]} />
                <meshStandardMaterial color="#a5f3fc" />
              </mesh>
            ))}

            <Text
              position={[-0.9, 0, 0]}
              fontSize={0.3}
              color="white"
              anchorX="center"
              anchorY="middle"
            >
              {`V${node.id}`}
            </Text>
          </group>
        ))}

        <Text
          position={[0, -2.8, 0]}
          fontSize={0.3}
          color="yellow"
          anchorX="center"
          anchorY="middle"
        >
          [List]
        </Text>
      </group>
    );
  }
);

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
const DefinitionPanel = ({ type, definition, position, onClose }) => {
  return (
    <group>
      <FadeInText
        show={true}
        text={definition}
        position={position}
        fontSize={0.33}
        color="#fde68a"
      />
    </group>
  );
};

export default ARPage2;

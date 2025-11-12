import React, { useState, useEffect } from "react";
import { Lock, Unlock } from "lucide-react";
import ARPage1 from "./ARPage1";

const ARButton = () => {
  const [isSupported, setIsSupported] = useState(null);
  const [startAR, setStartAR] = useState(false);

  useEffect(() => {
    const checkARSupport = async () => {
      if (!navigator.xr) {
        setIsSupported(false);
        return;
      }
      try {
        const supported = await navigator.xr.isSessionSupported("immersive-ar");
        setIsSupported(supported);
      } catch (error) {
        console.error("Error checking AR support:", error);
        setIsSupported(false);
      }
    };

    checkARSupport();
  }, []);

  // kung nag-start na si AR → render ARPage1
  if (startAR) {
    return <ARPage1 />;
  }

  if (isSupported === null) {
    return (
      <button
        disabled
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 text-gray-600 rounded-lg cursor-not-allowed font-medium"
      >
        <Lock size={18} />
        Checking...
      </button>
    );
  }

  return (
    <button
      disabled={!isSupported}
      onClick={() => setStartAR(true)}
      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium shadow-sm transition 
        ${
          isSupported
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-gray-200 text-gray-600 cursor-not-allowed"
        }`}
    >
      {isSupported ? <Unlock size={18} /> : <Lock size={18} />}
      {isSupported ? "Start AR Experience" : "AR Not Supported"}
    </button>
  );
};

export default ARButton;

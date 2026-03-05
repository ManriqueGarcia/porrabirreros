import React, { useState, useEffect, useRef } from "react";

const Avatar = React.memo(function Avatar({ name, avatar: customAvatar, size = "md", mode = "f1" }) {
  const slug = (name || "").toLowerCase().replace(/\s+/g, "");
  const primary = customAvatar || (mode === "futbol" ? `./assets/avatars/${slug}-futbol.svg` : `./assets/avatars/${slug}.svg`);
  const fallbackSrc = mode === "futbol" ? `./assets/avatars/${slug}.svg` : "./assets/avatars/default.svg";
  const [src, setSrc] = useState(primary);
  const triedFallback = useRef(false);

  useEffect(() => {
    setSrc(primary);
    triedFallback.current = false;
  }, [primary]);

  const handleError = () => {
    if (!triedFallback.current) {
      triedFallback.current = true;
      setSrc(fallbackSrc);
    }
  };

  const sizeCls = size === "sm" ? "w-8 h-8" : size === "xs" ? "w-6 h-6" : "w-28 h-32";
  return <img src={src} alt={name} onError={handleError} className={`${sizeCls} rounded-xl object-contain`} />;
});

export { Avatar };

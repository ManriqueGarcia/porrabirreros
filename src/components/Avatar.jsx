import React, { useState, useEffect, useRef } from "react";

const DEFAULT_AVATAR = "./assets/avatars/default.svg";

const Avatar = React.memo(function Avatar({ name, avatar: customAvatar, avatarFutbol, size = "md", mode = "f1" }) {
  const primary = (mode === "futbol" ? (avatarFutbol || customAvatar) : customAvatar) || DEFAULT_AVATAR;
  const [src, setSrc] = useState(primary);
  const triedFallback = useRef(false);

  useEffect(() => {
    setSrc(primary);
    triedFallback.current = false;
  }, [primary]);

  const handleError = () => {
    if (!triedFallback.current) {
      triedFallback.current = true;
      setSrc(DEFAULT_AVATAR);
    }
  };

  const sizeCls = size === "sm" ? "w-8 h-8" : size === "xs" ? "w-6 h-6" : "w-28 h-32";
  return <img src={src} alt={name} onError={handleError} className={`${sizeCls} rounded-xl object-contain`} />;
});

export { Avatar };

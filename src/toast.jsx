import { useState, useEffect } from "react";

const _toastListeners = [];

export function toast(msg, type = "info", duration = 3500) {
  _toastListeners.forEach(fn => fn(msg, type, duration));
}
toast.success = (m, d) => toast(m, "success", d);
toast.error = (m, d) => toast(m, "error", d);
toast.warn = (m, d) => toast(m, "warning", d);

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const handler = (msg, type, duration) => {
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, msg, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration || 3500);
    };
    _toastListeners.push(handler);
    return () => { const i = _toastListeners.indexOf(handler); if (i >= 0) _toastListeners.splice(i, 1); };
  }, []);
  const colors = {
    success: "from-emerald-600/90 to-emerald-700/90 border-emerald-400/30",
    error: "from-red-600/90 to-red-700/90 border-red-400/30",
    info: "from-slate-600/90 to-slate-700/90 border-slate-400/30",
    warning: "from-amber-600/90 to-amber-700/90 border-amber-400/30",
  };
  if (!toasts.length) return null;
  return <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-xs" style={{ pointerEvents: "none" }}>
    {toasts.map(t => <div key={t.id} className={`bg-gradient-to-r ${colors[t.type] || colors.info} text-white text-sm px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm`} style={{ pointerEvents: "auto", animation: "fadeInUp .3s ease" }}>{t.msg}</div>)}
  </div>;
}

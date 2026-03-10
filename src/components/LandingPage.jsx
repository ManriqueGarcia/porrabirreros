export default function LandingPage({ onCreateGroup, onJoinGroup }) {
  const features = [
    {
      title: "Apuestas F1",
      description: "Predice podios, poles y resultados de cada Gran Premio con tus amigos.",
      gradient: "from-red-600/20 to-amber-600/10",
      border: "border-red-500/20",
      accent: "text-red-400",
    },
    {
      title: "Apuestas Fútbol",
      description: "Apunta resultados de partidos de liga y compite por acertar el marcador.",
      gradient: "from-emerald-600/20 to-emerald-500/10",
      border: "border-emerald-500/20",
      accent: "text-emerald-400",
    },
    {
      title: "Rankings en vivo",
      description: "Sigue la clasificación en tiempo real y ve quién va ganando.",
      gradient: "from-amber-600/20 to-yellow-600/10",
      border: "border-amber-500/20",
      accent: "text-amber-400",
    },
    {
      title: "Estadísticas e historial",
      description: "Consulta tu historial de aciertos, podios y evolución temporada a temporada.",
      gradient: "from-slate-600/20 to-neutral-600/10",
      border: "border-white/10",
      accent: "text-slate-300",
    },
  ];

  const steps = [
    { num: "1", title: "Crea un grupo", desc: "Registra tu porra y configura tu liga de amigos." },
    { num: "2", title: "Invita a tus amigos", desc: "Comparte el enlace y que se unan al grupo." },
    { num: "3", title: "Apuesta y compite", desc: "Haz tus predicciones. Al que gane, le invitan a birras." },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Background gradient */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -15%, rgba(225,6,0,.12) 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 80% 90%, rgba(34,197,94,.08) 0%, transparent 50%), radial-gradient(ellipse 50% 35% at 10% 85%, rgba(245,158,11,.06) 0%, transparent 45%)",
        }}
      />

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-20">
        {/* Hero */}
        <section className="text-center mb-16 sm:mb-20">
          <h1 className="text-4xl sm:text-5xl sm:text-6xl font-black tracking-tight mb-4">
            <span className="bg-gradient-to-r from-white via-red-50 to-amber-100 bg-clip-text text-transparent">
              PORRA BIRREROS
            </span>
            <span className="ml-2" aria-hidden="true">🍺</span>
          </h1>
          <p className="text-lg sm:text-xl text-white/70 max-w-xl mx-auto mb-10 sm:mb-12">
            Apuesta con tus amigos. Al que gane, le invitan a birras.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <button
              onClick={onCreateGroup}
              className="px-6 py-3.5 rounded-xl font-semibold text-base bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-lg shadow-red-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              Crea tu porra
            </button>
            <button
              onClick={onJoinGroup}
              className="px-6 py-3.5 rounded-xl font-semibold text-base bg-white/10 hover:bg-white/15 border border-white/20 text-white backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              Únete a una porra
            </button>
          </div>
        </section>

        {/* Feature cards */}
        <section className="mb-16 sm:mb-20">
          <h2 className="text-xl font-bold text-white/90 mb-8 text-center sm:text-left">
            Qué puedes hacer
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {features.map((f) => (
              <article
                key={f.title}
                className={`relative overflow-hidden rounded-2xl bg-neutral-900/80 backdrop-blur-xl border ${f.border} p-5 sm:p-6 transition-all duration-300 hover:border-white/20 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-50`}
                  aria-hidden="true"
                />
                <div className="relative">
                  <h3 className={`font-bold text-base mb-2 ${f.accent}`}>{f.title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed">{f.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mb-16 sm:mb-20">
          <h2 className="text-xl font-bold text-white/90 mb-8 text-center sm:text-left">
            Cómo funciona
          </h2>
          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            {steps.map((s) => (
              <div
                key={s.num}
                className="relative flex flex-col items-center sm:items-start text-center sm:text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600/30 to-amber-600/20 border border-white/10 flex items-center justify-center font-bold text-lg text-amber-100 mb-4">
                  {s.num}
                </div>
                <h3 className="font-semibold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{s.desc}</p>
                {s.num !== "3" && (
                  <div className="hidden sm:block absolute top-6 left-[calc(100%+1rem)] w-8 h-px bg-gradient-to-r from-white/20 to-transparent" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t border-white/10 text-center text-sm text-white/50">
          Porra Birreros · Open Source
        </footer>
      </main>
    </div>
  );
}

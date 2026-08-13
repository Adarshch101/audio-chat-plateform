import CallScreen from "../components/CallScreen";

export function Screening() {
  return (
    // The page fills the viewport under the header (100dvh - 4rem); nothing
    // else on the page scrolls — only the chat transcript inside the card.
    <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 pt-5 pb-3 h-[calc(100dvh-4rem)] flex flex-col overflow-hidden">
      {/* Compact hero header — single row to maximize chat height */}
      <div className="flex items-center justify-center gap-3 mb-3">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live voice AI intake
        </p>
        <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
          Start a <span className="text-gradient">voice screening</span>
        </h1>
      </div>

      {/* Screening card with soft glow — fills the remaining viewport height */}
      <div className="relative w-full md:w-[70%] mx-auto flex-1 min-h-0">
        <div
          aria-hidden="true"
          className="absolute -inset-4 bg-gradient-to-tr from-cyan-500/15 via-indigo-500/10 to-fuchsia-500/15 blur-2xl"
        />
        <div className="relative h-full">
          <CallScreen />
        </div>
      </div>
    </section>
  );
}

export default Screening;
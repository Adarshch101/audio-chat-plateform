import { NavLink, Outlet, useLocation } from "react-router-dom";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-lg text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400/60 ${
    isActive
      ? "text-white bg-white/10 border border-white/15"
      : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
  }`;

function Logo() {
  return (
    <NavLink to="/" className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 rounded-lg px-1.5 py-1">
      <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
        <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 text-slate-950" fill="currentColor" aria-hidden="true">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-sm font-bold tracking-tight text-white">
        Voice<span className="text-gradient">Scribe</span>
      </span>
    </NavLink>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  // The screening view is a full-viewport, app-like chat surface — the page
  // itself must not scroll, so its footer is hidden and only the chat scrolls.
  const isChatView = pathname === "/screening";

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden">
      {/* Ambient background glows */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute top-1/3 -right-48 w-[560px] h-[560px] rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[420px] h-[420px] rounded-full bg-fuchsia-500/5 blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary">
            <NavLink to="/" end className={navLinkClass}>
              Home
            </NavLink>
            <NavLink to="/screening" className={navLinkClass}>
              Screening
            </NavLink>
            <NavLink to="/dashboard" className={navLinkClass}>
              Dashboard
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      {!isChatView && (
        <footer className="border-t border-white/5 mt-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <p>
              © {new Date().getFullYear()} VoiceScribe AI Health Screening. Demo — not a medical device.
            </p>
            <p className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              English · हिन्दी
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}

export default Layout;
import { Link } from "react-router-dom";
import type { ReactNode } from "react";

interface Feature {
  title: string;
  description: string;
  icon: ReactNode;
}

const features: Feature[] = [
  {
    title: "Conversational Intake",
    description:
      "A natural voice assistant asks adaptive clinical questions and extracts structured health data in real time.",
    icon: "💬",
  },
  {
    title: "English & हिन्दी",
    description:
      "Screen patients in either language with a full native pipeline — no translation layer, no lost nuance.",
    icon: "🌐",
  },
  {
    title: "Structured Reports",
    description:
      "Every call ends with a clinician-grade intake report: symptoms, medications, history, vitals, and flags.",
    icon: "🗂️",
  },
  {
    title: "Urgency Triage",
    description:
      "A rules engine rates each intake urgent / high / routine so clinicians can prioritise at a glance.",
    icon: "🚨",
  },
  {
    title: "Clinician Dashboard",
    description:
      "Review persisted intakes, drill into raw collected data, and track review status across your caseload.",
    icon: "🩺",
  },
  {
    title: "Private By Design",
    description:
      "Consent-gated audio streaming, optional API auth, and sessions persisted locally under your control.",
    icon: "🔒",
  },
];

const steps = [
  {
    step: "01",
    title: "Start a screening",
    description: "Pick English or हिन्दी and press start — the assistant opens with a spoken greeting.",
  },
  {
    step: "02",
    title: "Talk or type",
    description: "Hold to talk, or type. The assistant listens, clarifies, and barge-in interrupts work live.",
  },
  {
    step: "03",
    title: "Get the report",
    description: "A validated clinical intake report is generated instantly — printable and reviewable.",
  },
];

function HeroCardIcon() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-400/10 text-emerald-300 border border-emerald-400/20">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-1.5 align-middle" />
          Listening
        </span>
      </div>
      <div className="flex gap-3">
        <div className="glass rounded-2xl px-3.5 py-2.5 text-sm text-slate-200 max-w-[80%]">
          How long have you been having these symptoms, and on a scale of 0–10, how severe would you say they feel?
        </div>
      </div>
      <div className="flex justify-end">
        <div className="rounded-2xl px-3.5 py-2.5 text-sm bg-gradient-to-r from-cyan-500/90 to-indigo-500/90 text-white font-medium">
          For about a week — painful, maybe a 7 out of 10.
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
          Transcribing…
        </span>
      </div>
    </div>
  );
}

export function Landing() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 grid lg:grid-cols-2 gap-12 items-center">
        <div className="animate-fadeIn">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Live voice AI intake · STT → LLM → TTS
          </p>
          <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.05]">
            Health screening that <span className="text-gradient">speaks your patient&apos;s language.</span>
          </h1>
          <p className="mt-6 text-lg text-slate-400 leading-relaxed max-w-xl">
            VoiceScribe turns a spoken conversation into a structured clinical intake report — complete with
            urgency triage — so your front office never misses the details that matter.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/screening"
              className="glow inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-6 py-3.5 text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
            >
              Start a screening
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-bold text-slate-200 transition-all hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
            >
              Clinician view
            </Link>
          </div>
          <p className="mt-5 text-xs text-slate-500">
            No sign-up · works in Chrome &amp; Edge · audio stays between your browser and your server.
          </p>
        </div>

        {/* Hero mock panel */}
        <div className="relative animate-float">
          <div className="absolute -inset-6 bg-gradient-to-tr from-cyan-500/20 via-indigo-500/15 to-fuchsia-500/20 blur-2xl" aria-hidden="true" />
          <div className="relative glass rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-950" fill="currentColor" aria-hidden="true">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-bold text-white">VoiceScribe Live</p>
                  <p className="text-[10px] text-slate-500">Session · Intake in progress</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold text-slate-400 bg-white/5 border border-white/10">
                00:04:12
              </span>
            </div>
            <div className="rounded-2xl bg-slate-950/60 border border-white/10 p-4">
              <HeroCardIcon />
            </div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Speak
              </span>
              <span className="text-slate-700">•</span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                Type
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <div>
            <p className="text-3xl font-extrabold text-white">2</p>
            <p className="mt-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Languages</p>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-white">14+</p>
            <p className="mt-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Clinical fields captured</p>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-white">&lt;1s</p>
            <p className="mt-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assistant turnaround</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-20 sm:py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Everything a clinician needs, <span className="text-gradient">automatically collected.</span>
          </h2>
          <p className="mt-4 text-slate-400 leading-relaxed">
            Built on a real-time pipeline: Deepgram speech-to-text, an adaptive OpenAI conversation engine, and
            ElevenLabs text-to-speech.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="glass rounded-2xl p-6 transition-all hover:bg-white/[0.06] hover:-translate-y-0.5"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center text-xl">
                {f.icon}
              </div>
              <h3 className="mt-4 text-lg font-bold text-white">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-white/5 bg-white/[0.02]">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-20 sm:py-24">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white text-center">
            Three steps to a <span className="text-gradient">clean intake.</span>
          </h2>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {steps.map((s) => (
              <div key={s.step} className="glass rounded-2xl p-6 relative overflow-hidden">
                <span className="text-5xl font-extrabold text-white/5 absolute -top-2 right-3 select-none">
                  {s.step}
                </span>
                <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">{s.step}</p>
                <h3 className="mt-2 text-lg font-bold text-white">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-20">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-indigo-500/10 to-fuchsia-500/10 p-10 sm:p-14 text-center">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[560px] h-[560px] bg-cyan-500/10 rounded-full blur-3xl animate-gradient" aria-hidden="true" />
          <h2 className="relative text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Ready to try a screening?
          </h2>
          <p className="relative mt-4 text-slate-400 max-w-xl mx-auto leading-relaxed">
            Launch the live voice assistant — no account needed. Or open the clinician dashboard to inspect
            persisted intakes and triage.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/screening"
              className="glow inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-7 py-4 text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
            >
              Start screening now
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-7 py-4 text-sm font-bold text-slate-200 transition-all hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
            >
              View the dashboard
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Landing;
import { useState } from "react";
import type { HealthReport as HealthReportType, ChatTurn } from "../types/session";

interface HealthReportProps {
  report: HealthReportType;
  transcript: ChatTurn[];
  onNewScreening: () => void;
  actionLabel?: string;
}

/** Compact labeled list used for the optional clinical detail sections. */
function SectionList({
  title,
  items,
  emptyText = "None reported"
}: {
  title: string;
  items?: string[] | null;
  emptyText?: string;
}) {
  const list = items ?? [];
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1 print:text-slate-500">{title}</h3>
      <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 flex flex-wrap gap-1.5 min-h-[36px] print:bg-slate-50 print:border-slate-200">
        {list.length === 0 ? (
          <p className="text-sm text-slate-500 italic print:text-slate-400">{emptyText}</p>
        ) : (
          list.map((item, i) => (
            <span
              key={i}
              className="px-2.5 py-1 bg-slate-950 border border-white/10 rounded-full text-xs font-medium text-slate-300 print:bg-white print:border-slate-300 print:text-slate-700"
            >
              {item}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export function HealthReport({ report, transcript, onNewScreening, actionLabel = "Start New Screening" }: HealthReportProps) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [copied, setCopied] = useState(false);

  // Helper formats for placeholders
  const displayVal = (val: string | null) => val || "Not provided";

  const handleCopySummary = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(report.summary);
      } else {
        // Fallback for older browsers without the async Clipboard API
        const ta = document.createElement("textarea");
        ta.value = report.summary;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy summary:", err);
    }
  };

  return (
    <div className="w-full glass rounded-3xl p-6 sm:p-8 flex flex-col gap-8 transition-all animate-fadeIn shadow-2xl print:max-w-none print:shadow-none print:border-0 print:p-4 print:gap-4 print:bg-white print:text-black">

      {/* Report Header */}
      <div className="text-center border-b border-white/5 pb-5 print:pb-3 print:border-slate-200">
        <h1 className="text-2xl font-bold tracking-wide text-white uppercase print:text-slate-800">Health Screening Report</h1>
        <p className="text-xs text-slate-500 mt-1 print:text-slate-500">Clinical Intake Assessment Overview</p>
      </div>

      {/* Report Actions */}
      <div className="flex flex-wrap gap-2 -mt-4 print:hidden">
        <button
          onClick={() => window.print()}
          className="flex-1 min-w-[120px] py-2.5 px-4 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-xs transition-all focus:outline-none focus:ring-2 focus:ring-white/30"
        >
          Print / Save PDF
        </button>
        <button
          onClick={handleCopySummary}
          className={`flex-1 min-w-[120px] py-2.5 px-4 font-bold rounded-xl text-xs transition-all focus:outline-none focus:ring-2 ${
            copied
              ? "bg-emerald-500 text-white focus:ring-emerald-400/60"
              : "bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 focus:ring-white/20"
          }`}
        >
          {copied ? "Copied!" : "Copy Summary"}
        </button>
      </div>

      {/* Grid: 4 Core Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col print:bg-slate-50 print:border-slate-200">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1 print:text-slate-500">Patient Name</span>
          <span className="text-base font-semibold text-slate-100 print:text-slate-800">{displayVal(report.patientName)}</span>
        </div>
        
        {/* Main Concern */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col print:bg-slate-50 print:border-slate-200">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1 print:text-slate-500">Main Concern</span>
          <span className="text-base font-semibold text-slate-100 print:text-slate-800">{displayVal(report.mainConcern)}</span>
        </div>

        {/* Duration */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col print:bg-slate-50 print:border-slate-200">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1 print:text-slate-500">Duration</span>
          <span className="text-base font-semibold text-slate-100 print:text-slate-800">{displayVal(report.duration)}</span>
        </div>

        {/* Severity */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col print:bg-slate-50 print:border-slate-200">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1 print:text-slate-500">Severity</span>
          <span className="text-base font-semibold text-slate-100 print:text-slate-800">{displayVal(report.severity)}</span>
        </div>

        {/* Onset */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col print:bg-slate-50 print:border-slate-200">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1 print:text-slate-500">Onset</span>
          <span className="text-base font-semibold text-slate-100 print:text-slate-800">{displayVal(report.onset)}</span>
        </div>

        {/* Smoking Status */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col print:bg-slate-50 print:border-slate-200">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1 print:text-slate-500">Smoking / Tobacco</span>
          <span className="text-base font-semibold text-slate-100 print:text-slate-800">{displayVal(report.smokingStatus)}</span>
        </div>
      </div>

      {/* Symptoms list */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1 print:text-slate-500">Key Symptoms Reported</h3>
        {(report.keySymptoms || []).length === 0 ? (
          <p className="text-sm text-slate-500 italic px-1 print:text-slate-400">None reported</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-white/5 border border-white/10 rounded-xl p-4 list-disc pl-8 print:bg-slate-50 print:border-slate-200">
            {(report.keySymptoms || []).map((symptom, i) => (
              <li key={i} className="text-sm text-slate-200 font-medium capitalize print:text-slate-700">
                {symptom}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Additional clinical detail: medications, allergies, history, vitals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SectionList title="Current Medications" items={report.medications} />
        <SectionList title="Allergies" items={report.allergies} />
        <SectionList title="Medical History" items={report.medicalHistory} />
        <SectionList title="Family History" items={report.familyHistory} />
        <SectionList title="Triggers" items={report.triggers} />
        <SectionList title="Reported Vitals" items={report.vitals} />
      </div>

      {/* Two-Column lists: Follow-Up & Missing Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Follow-up Flags */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1 print:text-slate-500">Follow-Up Attention Flags</h3>
          <div className="flex-1 bg-red-500/10 border border-red-500/25 rounded-xl p-4 flex flex-col gap-2 print:bg-red-50 print:border-red-100">
            {(report.followUpFlags || []).length === 0 ? (
              <p className="text-sm text-slate-500 italic print:text-slate-400">No serious flags noted</p>
            ) : (
              <ul className="flex flex-col gap-2 list-none pl-0">
                {(report.followUpFlags || []).map((flag, i) => (
                  <li key={i} className="text-sm text-red-200 font-medium flex gap-2 items-start print:text-red-700">
                    <span className="text-red-400 mt-0.5 print:text-red-500">•</span>
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Missing Information */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1 print:text-slate-500">Missing Clinical Information</h3>
          <div className="flex-1 bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 flex flex-col gap-2 print:bg-amber-50 print:border-amber-100">
            {(report.missingInformation || []).length === 0 ? (
              <p className="text-sm text-slate-500 italic print:text-slate-400">All basic variables gathered</p>
            ) : (
              <ul className="flex flex-col gap-2 list-none pl-0">
                {(report.missingInformation || []).map((info, i) => (
                  <li key={i} className="text-sm text-amber-200 font-medium flex gap-2 items-start print:text-amber-800">
                    <span className="text-amber-400 mt-0.5 print:text-amber-500">•</span>
                    <span>{info}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1 print:text-slate-500">Narrative Summary</h3>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-slate-200 leading-relaxed font-medium print:bg-slate-50 print:border-slate-200 print:text-slate-700">
          {report.summary}
        </div>
      </div>

      {/* Accordion: Transcript Toggle */}
      {transcript.length > 0 && (
        <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5 print:border-0 print:bg-transparent">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            aria-expanded={showTranscript}
            className="w-full px-5 py-4 flex justify-between items-center text-sm font-semibold text-slate-200 hover:bg-white/5 transition-all border-b border-transparent focus:outline-none print:hidden"
            style={{ borderBottomColor: showTranscript ? "rgba(255,255,255,0.1)" : "transparent" }}
          >
            <span>{showTranscript ? "▼" : "▶"} View Conversation Transcript</span>
            <span className="text-xs text-slate-500 font-normal">{transcript.length} logs</span>
          </button>

          {/* Kept mounted so print can force it visible regardless of toggle state */}
          <div className={`max-h-[220px] overflow-y-auto p-4 flex flex-col gap-3 bg-slate-950/50 ${showTranscript ? "block" : "hidden print:block print:max-h-none print:overflow-visible print:bg-transparent print:p-2"}`}>
              {transcript.map((turn, i) => (
                <div
                  key={i}
                  className={`flex flex-col max-w-[85%] ${
                    turn.sender === "user" ? "self-end items-end" : "self-start items-start"
                  }`}
                >
                  <span className="text-[9px] text-slate-500 mb-0.5 uppercase tracking-wider px-1 print:text-slate-500">
                    {turn.sender === "user" ? "You" : "AI"}
                  </span>
                  <div
                    className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                      turn.sender === "user"
                        ? "bg-white/10 text-slate-200 rounded-tr-none print:bg-slate-100 print:text-slate-700"
                        : "bg-cyan-400/10 text-cyan-100 rounded-tl-none border border-cyan-400/20 print:bg-blue-50 print:text-blue-800 print:border-blue-100"
                    }`}
                  >
                    {turn.text}
                  </div>
                </div>
              ))}
            </div>
        </div>
      )}

      {/* Clinical Disclaimer */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-xs text-red-300/80 leading-relaxed font-medium text-center italic print:bg-red-50/50 print:border-red-100 print:text-red-600/80">
        <strong>Disclaimer:</strong> {report.disclaimer}
      </div>

      {/* Call to Action Button */}
      <div className="mt-2 border-t border-white/5 pt-5 print:hidden print:border-slate-200">
        <button
          onClick={onNewScreening}
          className="glow w-full py-3.5 px-6 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-90 active:opacity-80 text-white font-bold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400/60 tracking-wide uppercase text-xs"
        >
          {actionLabel}
        </button>
      </div>

    </div>
  );
}

export default HealthReport;
import { useState } from "react";
import type { HealthReport as HealthReportType } from "../types/websocket";

interface HealthReportProps {
  report: HealthReportType;
  transcript: { sender: "user" | "assistant"; text: string; timestamp: number }[];
  onNewScreening: () => void;
}

export function HealthReport({ report, transcript, onNewScreening }: HealthReportProps) {
  const [showTranscript, setShowTranscript] = useState(false);

  // Helper formats for placeholders
  const displayVal = (val: string | null) => val || "Not provided";

  return (
    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-100 p-8 flex flex-col gap-8 transition-all animate-fadeIn">
      
      {/* Report Header */}
      <div className="text-center border-b border-slate-100 pb-5">
        <h1 className="text-2xl font-bold tracking-wide text-slate-800 uppercase">Health Screening Report</h1>
        <p className="text-xs text-slate-400 mt-1">Clinical Intake Assessment Overview</p>
      </div>

      {/* Grid: 4 Core Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Patient Name</span>
          <span className="text-base font-semibold text-slate-700">{displayVal(report.patientName)}</span>
        </div>
        
        {/* Main Concern */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Main Concern</span>
          <span className="text-base font-semibold text-slate-700">{displayVal(report.mainConcern)}</span>
        </div>

        {/* Duration */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Duration</span>
          <span className="text-base font-semibold text-slate-700">{displayVal(report.duration)}</span>
        </div>

        {/* Severity */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Severity</span>
          <span className="text-base font-semibold text-slate-700">{displayVal(report.severity)}</span>
        </div>
      </div>

      {/* Symptoms list */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1">Key Symptoms Reported</h3>
        {(report.keySymptoms || []).length === 0 ? (
          <p className="text-sm text-slate-400 italic px-1">None reported</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-50 border border-slate-100 rounded-xl p-4 list-disc pl-8">
            {(report.keySymptoms || []).map((symptom, i) => (
              <li key={i} className="text-sm text-slate-600 font-medium capitalize">
                {symptom}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Two-Column lists: Follow-Up & Missing Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Follow-up Flags */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1">Follow-Up Attention Flags</h3>
          <div className="flex-1 bg-red-50/50 border border-red-100 rounded-xl p-4 flex flex-col gap-2">
            {(report.followUpFlags || []).length === 0 ? (
              <p className="text-sm text-slate-400 italic">No serious flags noted</p>
            ) : (
              <ul className="flex flex-col gap-2 list-none pl-0">
                {(report.followUpFlags || []).map((flag, i) => (
                  <li key={i} className="text-sm text-red-700 font-medium flex gap-2 items-start">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Missing Information */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1">Missing Clinical Information</h3>
          <div className="flex-1 bg-amber-50/50 border border-amber-100 rounded-xl p-4 flex flex-col gap-2">
            {(report.missingInformation || []).length === 0 ? (
              <p className="text-sm text-slate-400 italic">All basic variables gathered</p>
            ) : (
              <ul className="flex flex-col gap-2 list-none pl-0">
                {(report.missingInformation || []).map((info, i) => (
                  <li key={i} className="text-sm text-amber-800 font-medium flex gap-2 items-start">
                    <span className="text-amber-500 mt-0.5">•</span>
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
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1">Narrative Summary</h3>
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-600 leading-relaxed font-medium">
          {report.summary}
        </div>
      </div>

      {/* Accordion: Transcript Toggle */}
      {transcript.length > 0 && (
        <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full px-5 py-4 flex justify-between items-center text-sm font-semibold text-slate-700 hover:bg-slate-100/50 transition-all border-b border-transparent focus:outline-none"
            style={{ borderBottomColor: showTranscript ? "#f1f5f9" : "transparent" }}
          >
            <span>{showTranscript ? "▼" : "▶"} View Conversation Transcript</span>
            <span className="text-xs text-slate-400 font-normal">{transcript.length} logs</span>
          </button>
          
          {showTranscript && (
            <div className="max-h-[220px] overflow-y-auto p-4 flex flex-col gap-3 bg-white">
              {transcript.map((turn, i) => (
                <div
                  key={i}
                  className={`flex flex-col max-w-[85%] ${
                    turn.sender === "user" ? "self-end items-end" : "self-start items-start"
                  }`}
                >
                  <span className="text-[9px] text-slate-400 mb-0.5 uppercase tracking-wider px-1">
                    {turn.sender === "user" ? "You" : "AI"}
                  </span>
                  <div
                    className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                      turn.sender === "user"
                        ? "bg-slate-100 text-slate-700 rounded-tr-none"
                        : "bg-blue-50 text-blue-800 rounded-tl-none border border-blue-100"
                    }`}
                  >
                    {turn.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clinical Disclaimer */}
      <div className="bg-red-50/30 border border-red-100 rounded-xl p-4 text-xs text-red-600/80 leading-relaxed font-medium text-center italic">
        <strong>Disclaimer:</strong> {report.disclaimer}
      </div>

      {/* Call to Action Button */}
      <div className="mt-2 border-t border-slate-100 pt-5">
        <button
          onClick={onNewScreening}
          className="w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 tracking-wide uppercase text-xs"
        >
          Start New Screening
        </button>
      </div>

    </div>
  );
}

export default HealthReport;

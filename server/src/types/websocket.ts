import { HealthReport } from "../schemas/report.schema";

export type CallStatus =
  | "idle"
  | "connecting"
  | "greeting"
  | "listening"
  | "processing"
  | "speaking"
  | "ending"
  | "generating_report"
  | "report_ready"
  | "error"
  | "ended";

export type ClientMessage =
  | {
      type: "start_call";
      language: "en" | "hi";
    }
  | {
      type: "audio_chunk";
      data: string; // Base64 chunk
    }
  | {
      type: "text_message";
      text: string;
    }
  | {
      type: "end_turn";
    }
  | {
      type: "end_call";
    }
  | {
      type: "retry_report";
    }
  | {
      type: "silence_ping";
    };

export type ServerMessage =
  | {
      type: "call_started";
      sessionId: string;
    }
  | {
      type: "status";
      status: CallStatus;
    }
  | {
      type: "assistant_message";
      text: string;
    }
  | {
      type: "transcript_partial";
      text: string;
    }
  | {
      type: "transcript_final";
      text: string;
    }
  | {
      type: "stt_empty";
    }
  | {
      type: "language_detected";
      language: "en" | "hi";
      source: "speech" | "text";
    }
  | {
      type: "audio_start";
      responseId: string;
    }
  | {
      type: "audio_chunk";
      responseId: string;
      data: string; // Base64 audio chunk
    }
  | {
      type: "audio_end";
      responseId: string;
    }
  | {
      type: "tts_error";
      message: string;
    }
  | {
      type: "report_generating";
    }
  | {
      type: "report_ready";
      report: HealthReport;
    }
  | {
      type: "report_failed";
      message: string;
    }
  | {
      type: "call_ended";
    }
  | {
      type: "error";
      message: string;
    };

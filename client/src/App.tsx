import { CallScreen } from "./components/CallScreen";

function App() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      <CallScreen />
      <div className="mt-8 text-xs text-slate-400">
        AI Health Screening Voice Agent • Phase 2
      </div>
    </div>
  );
}

export default App;

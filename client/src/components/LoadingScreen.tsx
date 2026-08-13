import Spinner from "./Spinner";

interface LoadingScreenProps {
  message?: string;
  className?: string;
}

export function LoadingScreen({ message = "Loading…", className = "" }: LoadingScreenProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-16 animate-fadeIn ${className}`}>
      <Spinner size={36} className="text-cyan-400" />
      <p className="text-sm font-medium text-slate-400">{message}</p>
    </div>
  );
}

export default LoadingScreen;
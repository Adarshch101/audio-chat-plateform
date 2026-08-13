import ClinicianDashboard from "../components/ClinicianDashboard";

export function Dashboard() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-10 sm:py-14 flex flex-col items-center animate-fadeIn">
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Clinician Dashboard
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Review persisted intakes, triage, and reports.
        </p>
      </div>
      <ClinicianDashboard />
    </section>
  );
}

export default Dashboard;
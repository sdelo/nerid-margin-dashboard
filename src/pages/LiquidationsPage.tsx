import NavBar from "../features/shared/components/NavBar";
import { LiquidationDashboard } from "../features/lending/components/LiquidationDashboard";

export function LiquidationsPage() {
  return (
    <div className="min-h-screen text-white">
      <header className="sticky-stack">
        <NavBar />
      </header>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6">
        <LiquidationDashboard />
      </main>
    </div>
  );
}

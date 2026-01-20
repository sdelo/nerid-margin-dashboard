import { Outlet } from "react-router-dom";

export function MainLayout() {
  return (
    <div className="min-h-screen relative">
      <Outlet /> {/* Child routes render here - each page handles its own sticky stack */}
    </div>
  );
}

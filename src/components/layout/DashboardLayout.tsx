"use client";

import { useState, type ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
  userDisplayName?: string;
  userRoleLabel?: string;
}

export function DashboardLayout({
  children,
  userDisplayName,
  userRoleLabel,
}: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  return (
    <div className="flex flex-col h-full">
      <Header
        onToggleSidebar={handleToggleSidebar}
        isSidebarOpen={isSidebarOpen}
        userDisplayName={userDisplayName}
        userRoleLabel={userRoleLabel}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={isSidebarOpen} />
        <main className="flex-1 overflow-y-auto bg-[var(--color-bg-secondary)]">
          <div className="p-6 max-w-screen-xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

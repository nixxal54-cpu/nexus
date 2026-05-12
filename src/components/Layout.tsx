import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Brain, MessageSquare, Clock, Lightbulb, Target, Flame } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { fetchJson } from "../lib/api";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [stats, setStats] = useState({ streak: 0, unseenInsights: 0 });

  useEffect(() => {
    fetchJson("/api/stats")
      .then(s => setStats({ streak: s.streak, unseenInsights: s.unseenInsights || 0 }))
      .catch(console.error);
  }, []);

  const links = [
    { to: "/", icon: Brain, label: "Dashboard" },
    { to: "/chat", icon: MessageSquare, label: "Chat" },
    { to: "/memories", icon: Clock, label: "Memories" },
    { to: "/insights", icon: Lightbulb, label: "Insights", badge: stats.unseenInsights },
    { to: "/goals", icon: Target, label: "Goals" },
  ];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--color-bg-primary)]">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b border-[var(--color-border-subtle)] px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent-primary)] font-display font-bold text-white">N</div>
          <span className="font-display text-lg font-bold tracking-widest text-white">NEXUS</span>
        </div>
        <div className="flex items-center gap-6">
          {stats.streak > 0 && (
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-accent-warm)]">
              <Flame size={16} /> {stats.streak} day streak
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--color-text-secondary)]">{user?.name}</span>
            <button onClick={logout} className="rounded-full bg-[var(--color-bg-secondary)] px-3 py-1 text-xs text-[var(--color-text-secondary)] hover:text-white transition">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/50 p-4">
          <nav className="flex flex-col gap-2">
            {links.map(link => {
              const active = location.pathname === link.to || (link.to !== "/" && location.pathname.startsWith(link.to));
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <link.icon size={18} />
                    {link.label}
                  </div>
                  {link.badge && link.badge > 0 ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent-primary)] text-[10px] font-bold text-white">
                      {link.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="relative flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl p-8 pb-32">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

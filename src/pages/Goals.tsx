import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { fetchJson } from "../lib/api";
import { Target, CheckCircle2, Circle, XCircle } from "lucide-react";

function getGoalStatus(summary: string | null): string {
  if (!summary) return "ACTIVE";
  const match = summary.match(/^STATUS:([^|]+)\|/);
  return match ? match[1] : "ACTIVE";
}

export function Goals() {
  const [goals, setGoals] = useState<any[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchJson("/api/memories?type=GOAL").then(setGoals).catch(console.error);
  }, []);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    try {
      const updated = await fetchJson(`/api/goals/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setGoals(goals.map(g => g.id === id ? { ...g, summary: updated.summary } : g));
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(null);
    }
  };

  const active = goals.filter(g => getGoalStatus(g.summary) === "ACTIVE");
  const completed = goals.filter(g => getGoalStatus(g.summary) === "COMPLETED");
  const abandoned = goals.filter(g => getGoalStatus(g.summary) === "ABANDONED");

  const GoalCard = ({ g }: { g: any }) => {
    const status = getGoalStatus(g.summary);
    const isUpdating = updating === g.id;
    return (
      <div key={g.id} className={`glass-card p-6 flex flex-col justify-between transition-opacity ${isUpdating ? "opacity-50" : ""}`}>
        <div>
          <div className="text-xs text-[var(--color-text-secondary)] mb-3 font-mono">
            {new Date(g.createdAt).toLocaleDateString()}
          </div>
          <p className={`text-lg leading-relaxed mb-4 ${status === "COMPLETED" ? "line-through text-[var(--color-text-muted)]" : "text-white"}`}>
            {g.content}
          </p>
        </div>
        <div className="flex justify-between items-end mt-4">
          <div className="flex flex-wrap gap-2">
            {g.tags?.map((t: string) => (
              <span key={t} className="text-xs text-[var(--color-text-muted)] border border-[var(--color-border-subtle)] rounded-full px-2 py-0.5">#{t}</span>
            ))}
          </div>
          <div className="flex gap-2">
            {status !== "COMPLETED" && (
              <button
                onClick={() => updateStatus(g.id, "COMPLETED")}
                disabled={isUpdating}
                className="text-[var(--color-text-secondary)] hover:text-green-400 transition"
                title="Mark complete"
              >
                <CheckCircle2 size={20} />
              </button>
            )}
            {status !== "ABANDONED" && status !== "COMPLETED" && (
              <button
                onClick={() => updateStatus(g.id, "ABANDONED")}
                disabled={isUpdating}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent-warm)] transition"
                title="Abandon goal"
              >
                <XCircle size={20} />
              </button>
            )}
            {(status === "COMPLETED" || status === "ABANDONED") && (
              <button
                onClick={() => updateStatus(g.id, "ACTIVE")}
                disabled={isUpdating}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent-primary)] transition"
                title="Reactivate"
              >
                <Circle size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-8">
        <Target className="text-[var(--color-accent-primary)]" size={28} />
        <h1 className="font-display text-3xl font-bold text-white">Goals</h1>
      </div>

      {goals.length === 0 ? (
        <div className="glass-card p-12 text-center text-[var(--color-text-secondary)]">
          No goals yet. Tell Nexus a goal on the dashboard to start tracking.
        </div>
      ) : (
        <div className="space-y-10">
          {active.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-[var(--color-text-secondary)] mb-4 font-bold">Active ({active.length})</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {active.map(g => <GoalCard key={g.id} g={g} />)}
              </div>
            </section>
          )}
          {completed.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-green-500 mb-4 font-bold">Completed ({completed.length})</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {completed.map(g => <GoalCard key={g.id} g={g} />)}
              </div>
            </section>
          )}
          {abandoned.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-[var(--color-accent-warm)] mb-4 font-bold">Abandoned ({abandoned.length})</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {abandoned.map(g => <GoalCard key={g.id} g={g} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </Layout>
  );
}

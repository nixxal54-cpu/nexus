import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchJson } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = await fetchJson("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      login(user);
      navigate("/");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-8">
        <h1 className="mb-2 font-display text-3xl font-bold tracking-tight text-white">Access Nexus</h1>
        <p className="mb-8 text-sm text-[var(--color-text-secondary)]">Your second brain awaits.</p>
        
        {error && <div className="mb-6 rounded-lg bg-[var(--color-accent-warm)]/10 p-3 text-sm text-[var(--color-accent-warm)]">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-4 py-2 text-white focus:border-[var(--color-accent-primary)] focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-4 py-2 text-white focus:border-[var(--color-accent-primary)] focus:outline-none"
              required
            />
          </div>
          <button type="submit" className="w-full rounded-full bg-[var(--color-text-primary)] px-4 py-3 font-medium text-[var(--color-bg-primary)] transition hover:bg-[var(--color-text-secondary)]">
            Log In
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
          No account? <Link to="/register" className="text-[var(--color-accent-secondary)] hover:underline">Initialize one</Link>
        </div>
      </div>
    </div>
  );
}

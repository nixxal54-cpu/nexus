import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { fetchJson } from "../lib/api";
import { Clock, Trash2, Search, X } from "lucide-react";

export function Memories() {
  const [memories, setMemories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchJson("/api/memories").then(setMemories).catch(console.error);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const results = await fetchJson(`/api/memories/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => { setSearchQuery(""); setSearchResults(null); };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this memory?")) return;
    try {
      await fetchJson(`/api/memories/${id}`, { method: "DELETE" });
      setMemories(memories.filter((m) => m.id !== id));
      if (searchResults) setSearchResults(searchResults.filter(m => m.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const displayList = searchResults ?? memories;

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-8">
        <Clock className="text-[var(--color-accent-primary)]" size={28} />
        <h1 className="font-display text-3xl font-bold text-white">Memory Timeline</h1>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="mb-8 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search memories semantically..."
            className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] py-3 pl-9 pr-4 text-sm text-white outline-none focus:border-[var(--color-accent-primary)] transition"
          />
          {searchQuery && (
            <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-white">
              <X size={16} />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={searching}
          className="rounded-xl bg-[var(--color-accent-primary)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 transition hover:bg-opacity-90"
        >
          {searching ? "Searching..." : "Search"}
        </button>
      </form>

      {searchResults !== null && (
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{searchQuery}"
        </p>
      )}

      <div className="relative border-l border-[var(--color-border-subtle)] ml-4 pl-8 space-y-10">
        {displayList.length === 0 && (
          <p className="text-[var(--color-text-secondary)]">No memories found.</p>
        )}
        {displayList.map(m => (
          <div key={m.id} className="relative">
            <div className="absolute -left-10 mt-1.5 h-4 w-4 rounded-full border-2 border-[var(--color-bg-primary)] bg-[var(--color-accent-primary)]"></div>
            <div className="glass-card group p-6 relative">
              <div className="text-xs text-[var(--color-text-secondary)] mb-3 font-mono">
                {new Date(m.createdAt).toLocaleString()}
              </div>
              <p className="text-lg leading-relaxed text-white mb-4">{m.content}</p>
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <span className="rounded-md bg-[var(--color-bg-tertiary)] px-2 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  {m.type}
                </span>
                {m.mood && (
                  <span className={`rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wider ${m.mood === "anxious" ? "text-[var(--color-accent-warm)]" : m.mood === "excited" ? "text-[var(--color-accent-secondary)]" : "text-[var(--color-accent-primary)]"}`}>
                    • {m.mood}
                  </span>
                )}
                <div className="flex gap-2 flex-wrap">
                  {m.tags.map((t: string) => (
                    <span key={t} className="text-xs text-[var(--color-text-muted)] border border-[var(--color-border-subtle)] rounded-full px-2 py-0.5">#{t}</span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleDelete(m.id)}
                className="absolute top-4 right-4 p-2 text-[var(--color-text-muted)] hover:text-[var(--color-accent-warm)] transition opacity-0 group-hover:opacity-100"
                title="Delete memory"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}

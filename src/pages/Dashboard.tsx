import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { fetchJson } from "../lib/api";
import { Send, Mic, BrainCircuit } from "lucide-react";
import Markdown from "react-markdown";

export function Dashboard() {
  const [briefing, setBriefing] = useState<any>(null);
  const [stats, setStats] = useState({ memoryCount: 0, streak: 0, insightCount: 0 });
  const [memories, setMemories] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    fetchJson("/api/briefing/today").then(setBriefing).catch(console.error);
    fetchJson("/api/stats").then(setStats).catch(console.error);
    fetchJson("/api/memories").then(data => setMemories(data.slice(0, 5))).catch(console.error);
    fetchJson("/api/insights").then(data => setInsights(data.slice(0, 3))).catch(console.error);
  }, []);

  const startListening = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech recognition not supported in this browser.");
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => prev ? prev + " " + transcript : transcript);
    };
    recognition.onerror = (e: any) => {
      console.error(e);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    
    recognition.start();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    
    setIsProcessing(true);
    try {
      const res = await fetchJson("/api/memories", {
        method: "POST",
        body: JSON.stringify({ content: input })
      });
      setInput("");
      setMemories([res, ...memories]);
      if (res.insight) {
        setInsights([res.insight, ...insights]);
      }
      setStats(s => ({ ...s, memoryCount: s.memoryCount + 1 }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-12">
        
        {/* Welcome state for new users */}
        {stats.memoryCount === 0 && !briefing && (
          <div className="rounded-2xl border border-[var(--color-accent-primary)]/20 bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] p-10 text-center">
            <div className="mb-4 text-5xl">🧠</div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">Nexus is ready to learn</h2>
            <p className="text-[var(--color-text-secondary)] max-w-md mx-auto leading-relaxed">
              Start by sharing anything — a thought, goal, idea, or what's on your mind. The more you share, the smarter Nexus gets.
            </p>
          </div>
        )}

        {/* Morning Briefing */}
        {briefing && (
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] p-8 shadow-2xl relative">
            <div className="absolute top-0 right-0 p-3 opacity-20"><BrainCircuit size={120} /></div>
            <h2 className="mb-4 font-display text-2xl font-bold tracking-tight text-[var(--color-accent-secondary)] flex items-center gap-2">
              <span>Morning Briefing</span>
            </h2>
            <div className="markdown-body font-sans leading-relaxed text-[var(--color-text-primary)]">
              <Markdown>{briefing.content}</Markdown>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6">
          <div className="glass-card p-6">
            <div className="text-sm uppercase tracking-widest text-[var(--color-text-secondary)]">Memories</div>
            <div className="mt-2 font-display text-4xl font-bold">{stats.memoryCount}</div>
          </div>
          <div className="glass-card p-6">
            <div className="text-sm uppercase tracking-widest text-[var(--color-text-secondary)]">Insights</div>
            <div className="mt-2 text-4xl font-bold text-[var(--color-accent-primary)] font-display">{stats.insightCount}</div>
          </div>
          <div className="glass-card p-6">
            <div className="text-sm uppercase tracking-widest text-[var(--color-text-secondary)]">Current Streak</div>
            <div className="mt-2 text-4xl font-bold text-[var(--color-accent-warm)] font-display">{stats.streak}</div>
          </div>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div>
            <h3 className="mb-4 text-lg font-bold tracking-widest uppercase text-[var(--color-text-secondary)]">Recent Insights</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {insights.map(i => (
                <div key={i.id} className="glass-card relative overflow-hidden border-[var(--color-accent-primary)]/30 p-6 shadow-[0_0_15px_rgba(108,99,255,0.1)]">
                  <div className="text-sm leading-relaxed">{i.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Memories */}
        <div>
          <h3 className="mb-4 text-lg font-bold tracking-widest uppercase text-[var(--color-text-secondary)]">Recent Memories</h3>
          <div className="space-y-4">
            {memories.map(m => (
              <div key={m.id} className="glass-card flex border-l-4 p-5" style={{ borderLeftColor: m.mood === 'focused' ? 'var(--color-accent-primary)' : m.mood === 'anxious' ? 'var(--color-accent-warm)' : m.mood === 'excited' ? 'var(--color-accent-secondary)' : 'var(--color-border-subtle)' }}>
                <div className="flex-1">
                  <p className="text-[var(--color-text-primary)]">{m.content}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[var(--color-bg-tertiary)] px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)]">{m.type}</span>
                    {m.tags?.map((t: string) => (
                      <span key={t} className="rounded-full border border-[var(--color-border-subtle)] px-2 py-1 text-xs text-[var(--color-text-muted)]">#{t}</span>
                    ))}
                  </div>
                </div>
                {m.linkedIds?.length > 0 && (
                  <div className="ml-4 flex items-center justify-center rounded-full bg-[var(--color-accent-secondary)]/10 px-3 py-1 text-xs font-semibold text-[var(--color-accent-secondary)]">
                    🔗 {m.linkedIds.length}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Floating Input Bar */}
      <div className="fixed bottom-0 left-64 right-0 bg-gradient-to-t from-[var(--color-bg-primary)] via-[var(--color-bg-primary)] to-transparent p-6 pt-12">
        <form onSubmit={handleSubmit} className={`mx-auto flex max-w-4xl items-center gap-3 rounded-2xl border ${isListening ? 'border-[var(--color-accent-warm)] shadow-[0_0_30px_rgba(255,107,107,0.2)]' : 'border-[var(--color-accent-primary)]/40 shadow-[0_0_30px_rgba(108,99,255,0.15)]'} bg-[var(--color-bg-secondary)]/80 p-2 backdrop-blur-xl transition-all focus-within:border-[var(--color-accent-primary)] focus-within:shadow-[0_0_40px_rgba(108,99,255,0.3)]`}>
          <button 
            type="button" 
            onClick={startListening}
            className={`p-3 transition ${isListening ? 'text-[var(--color-accent-warm)] animate-pulse' : 'text-[var(--color-text-secondary)] hover:text-white'}`}
          >
            <Mic size={20} />
          </button>
          <input 
            type="text" 
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isProcessing}
            placeholder={isProcessing ? "Nexus is thinking..." : "Tell Nexus anything... a thought, goal, fear, idea, what happened today"}
            className="flex-1 bg-transparent px-2 py-3 text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
          />
          <button type="submit" disabled={isProcessing || !input.trim()} className="rounded-xl bg-[var(--color-accent-primary)] p-3 text-white transition hover:bg-opacity-90 disabled:opacity-50">
            <Send size={20} />
          </button>
        </form>
      </div>
    </Layout>
  );
}

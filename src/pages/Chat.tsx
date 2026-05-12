import { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { fetchJson } from "../lib/api";
import { Plus, Send, ChevronRight } from "lucide-react";
import Markdown from "react-markdown";

function ThreadView({ threadId }: { threadId: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchJson(`/api/chat/threads/${threadId}`).then(data => {
      setMessages(data.messages || []);
    }).catch(console.error);
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const aiResponse = await fetchJson(`/api/chat/threads/${threadId}/message`, {
        method: "POST",
        body: JSON.stringify({ message: msg })
      });
      setMessages(prev => [...prev, aiResponse]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">No messages yet. Say hi.</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-5 ${m.role === 'user' ? 'bg-[var(--color-accent-primary)] text-white rounded-tr-sm' : 'glass-card rounded-tl-sm'}`}>
              <div className="markdown-body text-sm leading-relaxed"><Markdown>{m.content}</Markdown></div>
              {m.memoryIds?.length > 0 && (
                <div className="mt-3 text-xs opacity-50 border-t border-white/20 pt-2 flex items-center gap-1">
                  <ChevronRight size={12}/> Pulled from {m.memoryIds.length} past memories
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
             <div className="glass-card rounded-2xl rounded-tl-sm p-4 text-sm text-[var(--color-text-secondary)] animate-pulse">
               Nexus is thinking...
             </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="mt-4 flex flex-none items-center gap-2 rounded-xl bg-[var(--color-bg-secondary)] p-2 border border-[var(--color-border-subtle)] focus-within:border-[var(--color-accent-primary)]">
         <input type="text" value={input} onChange={e => setInput(e.target.value)} disabled={loading} placeholder="Reply to Nexus..." className="flex-1 bg-transparent px-3 py-2 text-white outline-none" />
         <button type="submit" disabled={!input.trim() || loading} className="rounded-lg bg-[var(--color-text-primary)] text-[var(--color-bg-primary)] p-2 hover:bg-[var(--color-text-secondary)] disabled:opacity-50 transition"><Send size={18} /></button>
      </form>
    </div>
  );
}

export function Chat() {
  const [threads, setThreads] = useState<any[]>([]);
  const { threadId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    fetchJson("/api/chat/threads").then(setThreads).catch(console.error);
  }, []);

  const newChat = async () => {
    try {
      const thread = await fetchJson("/api/chat/threads", { method: "POST" });
      setThreads([thread, ...threads]);
      navigate(`/chat/${thread.id}`);
    } catch(err) { console.error(err) }
  };

  return (
    <Layout>
      <div className="flex h-[calc(100vh-10rem)] gap-6">
        <div className="w-1/3 flex flex-col gap-4 border-r border-[var(--color-border-subtle)] pr-6">
           <button onClick={newChat} className="flex items-center gap-2 rounded-lg bg-[var(--color-accent-primary)]/20 px-4 py-3 font-semibold text-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary)]/30 transition">
             <Plus size={18} /> New Analysis Thread
           </button>
           <div className="flex-1 overflow-y-auto space-y-2">
             {threads.map(t => (
               <Link key={t.id} to={`/chat/${t.id}`} className={`block p-3 rounded-lg border ${t.id === threadId ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10' : 'border-transparent hover:bg-[var(--color-bg-secondary)]'}`}>
                 <div className="font-medium text-white truncate">{t.title}</div>
                 <div className="text-xs text-[var(--color-text-secondary)] mt-1">{new Date(t.updatedAt).toLocaleDateString()}</div>
               </Link>
             ))}
           </div>
        </div>
        <div className="w-2/3 h-full">
           {threadId ? <ThreadView threadId={threadId} /> : <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">Select a thread to continue synthesizing</div>}
        </div>
      </div>
    </Layout>
  );
}

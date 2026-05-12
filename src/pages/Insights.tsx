import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { fetchJson } from "../lib/api";
import { Lightbulb, AlertTriangle, Link as LinkIcon, Trophy } from "lucide-react";

export function Insights() {
  const [insights, setInsights] = useState<any[]>([]);

  useEffect(() => {
    fetchJson("/api/insights").then(setInsights).catch(console.error);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="text-[var(--color-accent-warm)]" size={24} />;
      case 'connection': return <LinkIcon className="text-[var(--color-accent-secondary)]" size={24} />;
      case 'achievement': return <Trophy className="text-[var(--color-accent-gold)]" size={24} />;
      default: return <Lightbulb className="text-[var(--color-accent-primary)]" size={24} />;
    }
  };

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-8">
         <Lightbulb className="text-[var(--color-accent-gold)]" size={28} />
         <h1 className="font-display text-3xl font-bold text-white">Pattern Detective</h1>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        {insights.map(insight => (
           <div key={insight.id} className="glass-card flex items-start gap-4 p-6 relative overflow-hidden group">
             <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[var(--color-accent-primary)]/5 opacity-0 group-hover:opacity-100 transition duration-500"></div>
             <div className="flex-none p-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)]">
               {getIcon(insight.type)}
             </div>
             <div className="z-10">
               <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
                 <span>{insight.type}</span>
                 <span className="opacity-50">• {new Date(insight.createdAt).toLocaleDateString()}</span>
               </div>
               <p className="text-white leading-relaxed">{insight.content}</p>
               {insight.memoryIds?.length > 0 && (
                 <div className="mt-4 text-xs font-mono text-[var(--color-text-muted)]">
                   Based on {insight.memoryIds.length} memories
                 </div>
               )}
             </div>
           </div>
        ))}
      </div>
    </Layout>
  );
}

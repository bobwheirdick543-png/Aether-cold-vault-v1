import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole, Boxes, GitBranch, Sparkles, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export const Route = createFileRoute("/")({ component: LandingPage });

function LandingPage() {
  const cards = [
    [LockKeyhole, "Private by default", "Files live in private object storage and every project operation is authorization-checked."],
    [Boxes, "Real filesystem", "Nested files and folders persist as actual project state, with safe names and path isolation."],
    [GitBranch, "Versioned", "Snapshots preserve project history and make restoration non-destructive."],
  ] as const;

  return (
    <main className="min-h-screen bg-[#080b0a] text-[#f4f3ee]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Logo showWordmark />
        <nav className="hidden items-center gap-7 text-sm text-white/65 md:flex"><a href="#workspace" className="hover:text-white">Workspace</a><a href="#security" className="hover:text-white">Security</a><a href="#mcp" className="hover:text-white">MCP</a></nav>
        <div className="flex items-center gap-3"><Link to="/login" className="rounded-full px-4 py-2 text-sm text-white/75 hover:text-white">Sign in</Link><Link to="/signup" className="rounded-full bg-[#d7e5b0] px-5 py-2.5 text-sm font-semibold text-[#10150f]">Create vault</Link></div>
      </header>
      <section className="relative overflow-hidden px-6 pb-28 pt-20 lg:px-10 lg:pt-32"><div className="pointer-events-none absolute left-1/2 top-10 h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-[#b9d48c]/8 blur-3xl" /><div className="relative mx-auto max-w-5xl text-center">
        <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.035] px-4 py-2 text-xs uppercase tracking-[.22em] text-white/55"><Sparkles className="h-3.5 w-3.5" /> A private home for your code</div>
        <h1 className="text-balance text-5xl font-medium leading-[1.02] tracking-[-.055em] sm:text-6xl lg:text-8xl">Your code.<br /><span className="text-[#d7e5b0]">Sealed, versioned, intelligent.</span></h1>
        <p className="mx-auto mt-7 max-w-2xl text-pretty text-lg leading-8 text-white/55">Aether Code Vault is a secure cloud workspace for real projects, real files and controlled AI access — built as infrastructure, not a mock dashboard.</p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/signup" className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#d7e5b0] px-6 py-3.5 font-semibold text-[#10150f]">Open your vault <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></Link><Link to="/login" className="rounded-full border border-white/12 bg-white/[.035] px-6 py-3.5 font-medium text-white/80">Sign in</Link></div>
      </div></section>
      <section id="workspace" className="mx-auto max-w-7xl px-6 pb-28 lg:px-10"><div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0d1210] shadow-2xl shadow-black/30"><div className="flex items-center gap-2 border-b border-white/8 px-5 py-4"><span className="h-2.5 w-2.5 rounded-full bg-white/15" /><span className="h-2.5 w-2.5 rounded-full bg-white/15" /><span className="h-2.5 w-2.5 rounded-full bg-white/15" /><span className="ml-3 text-xs text-white/35">Aether Code Vault / workspace</span></div><div className="grid min-h-[420px] md:grid-cols-[230px_1fr]"><aside className="border-r border-white/8 p-5 text-sm text-white/45"><div className="mb-5 text-xs uppercase tracking-[.2em] text-white/25">Project</div><div className="space-y-3"><div className="text-white/75">▾ src</div><div className="pl-4">▾ components</div><div className="pl-8 text-[#d7e5b0]">App.tsx</div><div className="pl-8">workspace.tsx</div><div className="pl-4">routes</div><div>▾ tests</div></div></aside><div className="p-7 font-mono text-sm leading-7 text-white/45"><div><span className="text-white/20">01</span> <span className="text-[#d7e5b0]">export</span> <span className="text-white/80">function</span> Vault() {'{'}</div><div><span className="text-white/20">02</span> <span className="pl-5 text-white/65">return</span> <span className="text-white/70">&lt;Workspace /&gt;</span></div><div><span className="text-white/20">03</span> {'}'}</div><div className="mt-8 h-px w-full bg-white/6" /><div className="mt-5 text-xs text-white/25">Real files · persistent storage · immutable snapshots · controlled AI access</div></div></div></div></section>
      <section id="security" className="mx-auto grid max-w-7xl gap-5 px-6 pb-24 md:grid-cols-3 lg:px-10">{cards.map(([Icon, title, body]) => <article key={title} className="rounded-3xl border border-white/8 bg-white/[.025] p-7"><Icon className="mb-8 h-5 w-5 text-[#d7e5b0]" /><h2 className="text-xl font-medium">{title}</h2><p className="mt-3 text-sm leading-6 text-white/45">{body}</p></article>)}</section>
      <section id="mcp" className="border-y border-white/8 bg-[#0b100e] px-6 py-24 lg:px-10"><div className="mx-auto max-w-4xl text-center"><ShieldCheck className="mx-auto mb-6 h-6 w-6 text-[#d7e5b0]" /><h2 className="text-4xl tracking-[-.035em] sm:text-5xl">AI access without giving away the vault.</h2><p className="mx-auto mt-5 max-w-2xl leading-7 text-white/45">Aether is designed for a real MCP control plane with authenticated clients, project-scoped permissions, guarded writes and an audit trail.</p></div></section>
      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-10 text-xs text-white/30 sm:flex-row sm:items-center sm:justify-between lg:px-10"><Logo /><span>Aether Code Vault · Private developer infrastructure</span></footer>
    </main>
  );
}

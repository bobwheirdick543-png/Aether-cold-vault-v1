import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/logo";
import type { ReactNode } from "react";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <main className="min-h-screen bg-[#080b0a] px-6 py-10 text-[#f4f3ee]"><div className="mx-auto flex max-w-md flex-col items-center"><Link to="/" className="mb-14"><Logo showWordmark /></Link><section className="w-full rounded-[28px] border border-white/10 bg-white/[.025] p-7 shadow-2xl shadow-black/20 sm:p-9"><h1 className="text-3xl tracking-[-.03em]">{title}</h1><p className="mt-2 text-sm leading-6 text-white/45">{subtitle}</p>{children}</section></div></main>;
}

export function Field({ label, type = "text", value, onChange, placeholder, autoComplete }: { label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string }) {
  return <label className="block"><span className="mb-2 block text-xs font-medium uppercase tracking-[.12em] text-white/40">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition placeholder:text-white/20 focus:border-[#d7e5b0]/50 focus:ring-2 focus:ring-[#d7e5b0]/10" /></label>;
}

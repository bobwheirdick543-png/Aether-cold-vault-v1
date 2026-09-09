import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, Field } from "@/components/auth/AuthShell";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const navigate = useNavigate(); const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState(""); const [notice,setNotice]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(""); setNotice(""); if(password.length<8){setError("Use at least 8 characters for your password.");setBusy(false);return;} const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:name.trim()||email.split("@")[0]}}}); if(error)setError(error.message); else if(data.session) await navigate({to:"/dashboard"}); else setNotice("Account created. Check your email if confirmation is enabled, then sign in."); setBusy(false); }
  return <AuthShell title="Create your vault" subtitle="Your account starts private. Your projects remain isolated by the database."><form onSubmit={submit} className="mt-8 space-y-5"><Field label="Display name" value={name} onChange={setName} autoComplete="name" placeholder="Your name"/><Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" placeholder="you@example.com"/><Field label="Password" value={password} onChange={setPassword} type="password" autoComplete="new-password" placeholder="At least 8 characters"/>{error&&<p className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200">{error}</p>}{notice&&<p className="rounded-xl border border-[#d7e5b0]/20 bg-[#d7e5b0]/5 px-4 py-3 text-sm text-[#d7e5b0]">{notice}</p>}<button disabled={busy} className="w-full rounded-xl bg-[#d7e5b0] px-4 py-3.5 text-sm font-semibold text-[#10150f] disabled:opacity-50">{busy?"Creating…":"Create account"}</button><p className="text-center text-xs text-white/40">Already have a vault? <Link to="/login" className="text-white/70 hover:text-white">Sign in</Link></p></form></AuthShell>;
}

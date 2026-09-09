import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapPlatformOwner, getSessionProfile } from "@/lib/vault.functions";
import { AetherMark } from "@/components/brand/logo";

export const Route = createFileRoute("/admin/login")({ component: AdminLogin });

function AdminLogin(){
  const navigate=useNavigate();
  const[email,setEmail]=useState("");
  const[password,setPassword]=useState("");
  const[error,setError]=useState("");
  const[busy,setBusy]=useState(false);

  async function submit(e:FormEvent){
    e.preventDefault();
    setBusy(true);
    setError("");
    const{error:signInError}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(signInError){setError(signInError.message);setBusy(false);return;}
    try{
      // Securely recognize the configured ADMIN_EMAIL on the server and grant
      // platform-owner access. Non-owner admins keep their existing role.
      try { await bootstrapPlatformOwner(); } catch { /* normal admins do not need bootstrap */ }
      const me=await getSessionProfile();
      if(!me.roles.some(r=>["admin","platform_owner","super_admin"].includes(r))){
        await supabase.auth.signOut();
        setError("This account is authenticated but does not have platform administrator access.");
      }else{
        await navigate({to:"/admin"});
      }
    }catch(err){
      await supabase.auth.signOut();
      setError(err instanceof Error?err.message:"Administrator verification failed.");
    }finally{setBusy(false)}
  }

  return <main className="vault-grid vault-aura flex min-h-screen items-center justify-center px-5"><div className="w-full max-w-md"><div className="mb-8 text-center"><AetherMark className="mx-auto size-12"/><p className="mt-4 font-mono text-[10px] tracking-[.3em] text-primary">AETHER CODE VAULT · PLATFORM</p><h1 className="mt-3 text-3xl font-semibold">Administrator access</h1><p className="mt-2 text-sm text-muted-foreground">Separate control plane. Server-enforced authorization.</p></div><form onSubmit={submit} className="panel-raised p-7"><label className="block"><span className="field-label">Administrator email</span><input className="vault-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required/></label><label className="mt-5 block"><span className="field-label">Password</span><input className="vault-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label>{error&&<p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}<button disabled={busy} className="vault-button-primary mt-6 h-11 w-full">{busy?"Verifying…":"Enter control plane"}</button><Link to="/admin/bootstrap" className="mt-5 block text-center text-xs text-primary hover:underline">First-time platform owner bootstrap</Link><Link to="/" className="mt-3 block text-center text-xs text-muted-foreground hover:text-foreground">Return to Aether Code Vault</Link></form></div></main>
}

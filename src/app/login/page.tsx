"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2, ArrowRight, ShieldCheck, Lock, Gauge, LineChart,
} from "lucide-react";

const POINTS = [
  {
    icon: Lock,
    title: "Private & confidential",
    desc: "Internal company data for authorized staff only — never shared with any third party.",
  },
  {
    icon: Gauge,
    title: "Run the company faster",
    desc: "A shared, live view so everyone knows what's happening and what's next.",
  },
  {
    icon: LineChart,
    title: "Track everything",
    desc: "Every lead, project and payment tracked — clear visibility on what's working.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Login failed");
        setLoading(false);
        return;
      }
      const from = new URLSearchParams(window.location.search).get("from");
      router.push(from || "/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-background lg:grid lg:grid-cols-[1.15fr_1fr]">
      {/* Left — brand top, confidential notice + points middle */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-card p-12 lg:flex xl:p-16">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.3] [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_72%)]" />
        <div className="pointer-events-none absolute -left-24 -top-24 size-[28rem] rounded-full bg-brand/15 blur-[120px]" />

        {/* top — logo + name */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative flex items-center gap-3"
        >
          <Image src="/logo.jpg" alt="Aura Digital Services" width={44} height={44} priority className="size-11 rounded-xl object-contain" />
          <span className="text-lg font-semibold tracking-tight">Aura HQ</span>
        </motion.div>

        {/* middle — heading + system points */}
        <div className="relative max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05, ease: "easeOut" }}
          >
            <h1 className="text-[30px] font-semibold leading-tight tracking-tight">
              Private company dashboard
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              One place to run the whole company — and see exactly how it&apos;s doing.
            </p>
          </motion.div>

          <div className="mt-9 space-y-5">
            {POINTS.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.16 + i * 0.09, ease: "easeOut" }}
                className="flex items-start gap-3.5"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/50 text-foreground">
                  <p.icon className="size-[18px]" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="text-sm font-medium">{p.title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{p.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* bottom — footer */}
        <p className="relative flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" /> Private workspace · access by invitation only
        </p>
      </div>

      {/* Right — login fields */}
      <div className="flex min-h-screen items-center justify-center px-5 py-12 lg:min-h-0">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          {/* logo on mobile (left panel hidden) */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <Image src="/logo.jpg" alt="Aura Digital Services" width={64} height={64} priority className="size-16 rounded-2xl object-contain" />
            <span className="mt-3 text-lg font-semibold tracking-tight">Aura HQ</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">Sign in to your private workspace.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@auradigitalservices.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <span className="text-xs text-muted-foreground/70">Forgot? Ask an admin</span>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
              >
                <Lock className="size-3.5" /> {error}
              </motion.p>
            )}

            <Button type="submit" className="h-11 w-full gap-2" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <>Sign in <ArrowRight className="size-4" /></>}
            </Button>
          </form>

          <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground/70">
            <Lock className="size-3" /> Confidential · do not share with third parties
          </p>
        </motion.div>
      </div>
    </div>
  );
}

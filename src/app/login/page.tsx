"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Github,
  Scale,
  Sparkles,
  Shield,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login, signup } from "./actions";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setErrors({});
    setGlobalError(null);
    setSuccessMessage(null);

    const result = isSignUp ? await signup(formData) : await login(formData);

    setLoading(false);

    if (result?.errors) {
      setErrors(result.errors);
    }
  };

  const clearError = (field: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  return (
    <div className="flex h-screen w-full font-sans overflow-hidden">

      {/* ─── Left Panel: Brand & Visual ─── */}
      <div className="hidden lg:flex lg:w-[50%] relative overflow-hidden bg-black">
        {/* Radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.03] blur-[120px]" />

        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between w-full p-12 xl:p-16">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-white rounded-lg flex items-center justify-center">
              <Scale className="h-[18px] w-[18px] text-black" />
            </div>
            <span className="text-white font-serif text-xl font-bold tracking-tight">
              Juris
            </span>
          </div>

          {/* Center: Headline + Mock UI */}
          <div className="space-y-10">
            <div className="space-y-5 max-w-md">
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-[44px] xl:text-[52px] font-serif text-white font-bold leading-[1.05] tracking-tight"
              >
                The future of
                <br />
                legal work.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="text-neutral-500 text-[15px] leading-relaxed max-w-sm"
              >
                Draft, research, and manage — all in one AI-powered workspace built for legal professionals.
              </motion.p>
            </div>

            {/* Product Preview Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] max-w-md backdrop-blur-sm overflow-hidden"
            >
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
                <div className="h-2 w-2 rounded-full bg-white/10" />
                <div className="h-2 w-2 rounded-full bg-white/10" />
                <div className="h-2 w-2 rounded-full bg-white/10" />
                <div className="ml-3 text-[10px] text-white/30 font-medium">Non-Disclosure Agreement — Draft</div>
              </div>

              {/* Editor body */}
              <div className="p-5">
                {/* Document heading */}
                <p className="text-white/80 text-[13px] font-serif font-bold mb-3">
                  § 4. Confidentiality Obligations
                </p>
                {/* Body text */}
                <div className="space-y-2 mb-4">
                  <p className="text-white/40 text-[11px] leading-relaxed">
                    The Receiving Party shall hold and maintain the Confidential
                    Information in strict confidence, using the same degree of care
                    as it uses to protect its own confidential information.
                  </p>
                  <p className="text-white/25 text-[11px] leading-relaxed">
                    This obligation shall remain in effect for a period of three
                    (3) years following the date of disclosure...
                  </p>
                </div>

                {/* AI Suggestion */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.8 }}
                  className="rounded-lg border border-white/[0.1] bg-white/[0.04] p-3.5"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-5 w-5 rounded bg-white flex items-center justify-center">
                      <Sparkles className="h-2.5 w-2.5 text-black" />
                    </div>
                    <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider">AI Suggestion</span>
                  </div>
                  <p className="text-white/50 text-[11px] leading-relaxed">
                    Consider adding a carve-out for information independently
                    developed by the Receiving Party. This is standard in most
                    NDA frameworks under §&nbsp;1(b)(iv).
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="px-3 py-1 rounded-md bg-white/[0.1] text-[10px] text-white/60 font-semibold">Accept</div>
                    <div className="px-3 py-1 rounded-md bg-white/[0.05] text-[10px] text-white/40 font-medium">Dismiss</div>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex items-center gap-8 max-w-md"
            >
              {[
                { value: "50K+", label: "Statutes" },
                { value: "0.4s", label: "Avg. response" },
                { value: "99.9%", label: "Uptime" },
              ].map((stat, i) => (
                <div key={i} className="space-y-0.5">
                  <p className="text-white text-xl font-bold tracking-tight">{stat.value}</p>
                  <p className="text-neutral-600 text-[11px] font-medium">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 text-[11px] text-neutral-600">
            <span>© 2026 Juris</span>
            <span className="text-neutral-700">·</span>
            <Link href="#" className="hover:text-neutral-400 transition-colors">Terms</Link>
            <span className="text-neutral-700">·</span>
            <Link href="#" className="hover:text-neutral-400 transition-colors">Privacy</Link>
          </div>
        </div>
      </div>

      {/* ─── Right Panel: Auth Form ─── */}
      <div className="w-full lg:w-[50%] flex flex-col items-center justify-center bg-[#fbfbfb] relative overflow-y-auto">

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 absolute top-6 left-6">
          <div className="h-8 w-8 bg-[#0f172a] rounded-lg flex items-center justify-center">
            <Scale className="h-4 w-4 text-white" />
          </div>
          <span className="text-[#0f172a] font-serif text-lg font-bold tracking-tight">
            Juris
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[520px] px-8"
        >
          {/* Main Auth Card */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-10 sm:p-14">

            {/* Heading */}
            <div className="mb-8">
              <h2 className="text-2xl font-serif font-bold text-[#0f172a] tracking-tight">
                {isSignUp ? "Create Account" : "Sign In"}
              </h2>
              <p className="text-[13px] text-slate-500 mt-2 font-medium">
                {isSignUp
                  ? "Enter your credentials to join Juris."
                  : "Welcome back. Please enter your details."}
              </p>
            </div>

            {/* Global Error/Success Messages */}
            {globalError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{globalError}</span>
              </div>
            )}
            {successMessage && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-sm">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Social Auth */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="w-full h-12 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all rounded-xl text-sm font-semibold gap-3 cursor-pointer justify-center shadow-sm"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#0f172a" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#0f172a" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#0f172a" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#0f172a" />
                </svg>
                Google
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all rounded-xl text-sm font-semibold gap-3 cursor-pointer justify-center shadow-sm"
              >
                <Github className="h-5 w-5 text-[#0f172a]" />
                GitHub
              </Button>
            </div>

            {/* Divider */}
            <div className="relative my-10">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-100" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-[0.25em] font-bold text-slate-300">
                <span className="bg-white px-6">OR</span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form action={handleSubmit} className="space-y-5">

              {/* Full Name (Sign Up only) */}
              {isSignUp && (
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-700 uppercase tracking-widest ml-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      name="fullName"
                      placeholder="Jane Doe"
                      className={`h-12 border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-slate-900/5 focus:border-[#0f172a] transition-all text-[15px] rounded-xl placeholder:text-slate-400 ${errors.fullName ? "border-red-400 focus:border-red-500 focus:ring-red-500/10" : ""}`}
                      required
                      onChange={() => clearError("fullName")}
                    />
                  </div>
                  {errors.fullName && (
                    <p className="text-xs text-red-600 ml-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.fullName}
                    </p>
                  )}
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-slate-700 uppercase tracking-widest ml-1">
                  Work Email
                </label>
                <Input
                  type="email"
                  name="email"
                  placeholder="name@firm.com"
                  className={`h-12 border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-slate-900/5 focus:border-[#0f172a] transition-all text-[15px] rounded-xl placeholder:text-slate-400 ${errors.email ? "border-red-400 focus:border-red-500 focus:ring-red-500/10" : ""}`}
                  required
                  onChange={() => clearError("email")}
                />
                {errors.email && (
                  <p className="text-xs text-red-600 ml-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[12px] font-bold text-slate-700 uppercase tracking-widest">
                    Password
                  </label>
              {!isSignUp && (
                <Link
                  href="/forgot-password"
                  className="text-[12px] font-bold text-slate-400 hover:text-[#0f172a] transition-colors uppercase tracking-tight"
                >
                  Forgot?
                </Link>
              )}
                </div>
                <Input
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  className={`h-12 border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-slate-900/5 focus:border-[#0f172a] transition-all text-[15px] rounded-xl placeholder:text-slate-400 ${errors.password ? "border-red-400 focus:border-red-500 focus:ring-red-500/10" : ""}`}
                  required
                  onChange={() => clearError("password")}
                />
                {errors.password && (
                  <p className="text-xs text-red-600 ml-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.password}
                  </p>
                )}
                {isSignUp && (
                  <p className="text-[11px] text-slate-400 ml-1">
                    Must be at least 8 characters
                  </p>
                )}
              </div>

              {/* Confirm Password (Sign Up only) */}
              {isSignUp && (
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-700 uppercase tracking-widest ml-1">
                    Confirm Password
                  </label>
                  <Input
                    type="password"
                    name="confirmPassword"
                    placeholder="••••••••"
                    className={`h-12 border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-slate-900/5 focus:border-[#0f172a] transition-all text-[15px] rounded-xl placeholder:text-slate-400 ${errors.confirmPassword ? "border-red-400 focus:border-red-500 focus:ring-red-500/10" : ""}`}
                    required
                    onChange={() => clearError("confirmPassword")}
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-red-600 ml-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[#0f172a] hover:bg-black text-white font-bold rounded-xl transition-all shadow-lg shadow-slate-900/10 active:scale-[0.98] cursor-pointer text-base mt-4"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full"
                    />
                    <span>Processing...</span>
                  </div>
                ) : (
                  <span>{isSignUp ? "Create Account" : "Sign In"}</span>
                )}
              </Button>
            </form>

            {/* Toggle */}
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setErrors({});
                  setGlobalError(null);
                  setSuccessMessage(null);
                }}
                className="text-sm text-slate-500 hover:text-[#0f172a] transition-colors cursor-pointer group font-medium"
              >
                {isSignUp ? (
                  <span>Already have an account? <strong className="text-[#0f172a] group-hover:underline underline-offset-4">Sign In</strong></span>
                ) : (
                  <span>Don&apos;t have an account? <strong className="text-[#0f172a] group-hover:underline underline-offset-4">Sign Up</strong></span>
                )}
              </button>
            </div>
          </div>

          {/* Secured by */}
          <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-slate-400 uppercase tracking-[0.15em] font-bold opacity-70">
            <Shield className="h-3.5 w-3.5" />
            <span>Encrypted SOC2 Authentication</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
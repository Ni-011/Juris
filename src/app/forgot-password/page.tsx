"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Scale, ArrowLeft, Mail, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPassword } from "./actions";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setError(null);

    const result = await forgotPassword(formData);

    setLoading(false);

    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#fbfbfb] p-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[420px] bg-white border border-slate-200 shadow-sm rounded-2xl p-10 text-center"
        >
          <div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-6 w-6 text-emerald-600" />
          </div>
          <h2 className="text-xl font-serif font-bold text-[#0f172a] tracking-tight mb-2">
            Check your email
          </h2>
          <p className="text-[13px] text-slate-500 mb-6">
            We&apos;ve sent a password reset link to your email address. Click the link to reset your password.
          </p>
          <Link href="/login">
            <Button className="w-full h-12 bg-[#0f172a] hover:bg-black text-white font-bold rounded-xl">
              Back to Sign In
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#fbfbfb]">
      {/* Left panel - brand */}
      <div className="hidden lg:flex lg:w-[50%] relative overflow-hidden bg-black">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.03] blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative z-10 flex flex-col justify-between w-full p-12">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-white rounded-lg flex items-center justify-center">
              <Scale className="h-[18px] w-[18px] text-black" />
            </div>
            <span className="text-white font-serif text-xl font-bold tracking-tight">Juris</span>
          </div>
          <div className="max-w-sm">
            <h1 className="text-[44px] font-serif text-white font-bold leading-[1.05] tracking-tight mb-4">
              Reset your password
            </h1>
            <p className="text-neutral-500 text-[15px] leading-relaxed">
              We&apos;ll send you a secure link to reset your password and get you back to work.
            </p>
          </div>
          <div className="text-[11px] text-neutral-600">
            © 2026 Juris · <Link href="#" className="hover:text-neutral-400">Terms</Link> · <Link href="#" className="hover:text-neutral-400">Privacy</Link>
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="w-full lg:w-[50%] flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[420px]"
        >
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-[13px] text-slate-500 hover:text-[#0f172a] transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
          </Link>

          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-10">
            <div className="mb-8">
              <h2 className="text-2xl font-serif font-bold text-[#0f172a] tracking-tight mb-2">
                Forgot Password?
              </h2>
              <p className="text-[13px] text-slate-500 font-medium">
                Enter your email and we&apos;ll send you a reset link.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form action={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-slate-700 uppercase tracking-widest ml-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="email"
                    name="email"
                    placeholder="name@firm.com"
                    required
                    className="h-12 pl-10 border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-slate-900/5 focus:border-[#0f172a] transition-all text-[15px] rounded-xl placeholder:text-slate-400"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[#0f172a] hover:bg-black text-white font-bold rounded-xl transition-all shadow-lg shadow-slate-900/10 active:scale-[0.98] cursor-pointer text-base"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Sending...</span>
                  </div>
                ) : (
                  <span>Send Reset Link</span>
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-[13px] text-slate-500">
              Remember your password?{" "}
              <Link href="/login" className="font-bold text-[#0f172a] hover:underline underline-offset-4">
                Sign In
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

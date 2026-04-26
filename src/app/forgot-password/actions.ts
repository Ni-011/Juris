"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export async function forgotPassword(formData: FormData) {
  const email = formData.get("email") as string;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password`,
  });

  if (error) {
    console.error("[Forgot Password] Error:", error.message);
    // Don't reveal if email exists or not for security
    return { error: "Unable to send reset link. Please try again." };
  }

  // Success - don't return anything
  return null;
}

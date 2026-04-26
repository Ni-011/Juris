"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { validateForm, signupConstraints, loginConstraints } from "@/lib/validation";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function login(formData: FormData) {
  const validationErrors = validateForm(formData, loginConstraints);
  if (validationErrors) {
    return { errors: validationErrors, type: "login" as const };
  }

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    return { errors: { email: "Invalid email or password" }, type: "login" as const };
  }

  if (authData.user) {
    const userProfile = await db.query.users.findFirst({
      where: eq(users.authId, authData.user.id),
    });

    if (!userProfile) {
      await supabase.auth.signOut();
      return { errors: { email: "Account not properly set up. Please sign up again." }, type: "login" as const };
    }
  }

  redirect("/vault");
}

export async function signup(formData: FormData) {
  const validationErrors = validateForm(formData, signupConstraints);
  if (validationErrors) {
    return { errors: validationErrors, type: "signup" as const };
  }

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password !== confirmPassword) {
    return { errors: { confirmPassword: "Passwords do not match" }, type: "signup" as const };
  }

  if (password.length < 8) {
    return { errors: { password: "Password must be at least 8 characters" }, type: "signup" as const };
  }

  const email = formData.get("email") as string;
  const fullName = formData.get("fullName") as string;

  const supabase = await createClient();

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (existingUser) {
    return { errors: { email: "An account with this email already exists" }, type: "signup" as const };
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    return { errors: { email: authError.message }, type: "signup" as const };
  }

  if (authData.user) {
    await db.insert(users).values({
      authId: authData.user.id,
      email: email.toLowerCase(),
      fullName: fullName.trim(),
    });
  }

  redirect("/vault");
}

export async function signout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { User, Mail, Phone, Shield, Loader2, Save, CheckCircle, AlertCircle, UserCircle, Lock, Eye, EyeOff, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

interface ProfileData {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  createdAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [profile, setProfile] = React.useState<ProfileData | null>(null);
  const [formData, setFormData] = React.useState({
    fullName: "",
    phone: "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // Change password modal state
  const [showChangePassword, setShowChangePassword] = React.useState(false);
  const [passwordData, setPasswordData] = React.useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = React.useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordErrors, setPasswordErrors] = React.useState<Record<string, string>>({});
  const [passwordSuccess, setPasswordSuccess] = React.useState<string | null>(null);
  const [changingPassword, setChangingPassword] = React.useState(false);

  React.useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const res = await fetch("/api/profile");
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
          setFormData({
            fullName: data.profile.fullName || "",
            phone: data.profile.phone || "",
          });
        }
      } catch (e) {
        console.error("Failed to fetch profile:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Name is required";
    } else if (formData.fullName.length < 2) {
      newErrors.fullName = "Name must be at least 2 characters";
    }

    if (formData.phone && !/^[\d\s\-+()]{10,}$/.test(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    setSuccessMessage(null);
    if (!validateForm()) return;

    setSaving(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setSuccessMessage("Profile updated successfully");
      } else {
        const data = await res.json();
        setErrors({ form: data.error || "Failed to update profile" });
      }
    } catch (e) {
      setErrors({ form: "An error occurred. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const validatePasswordChange = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!passwordData.currentPassword) {
      newErrors.currentPassword = "Current password is required";
    }

    if (!passwordData.newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (passwordData.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setPasswordErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChangePassword = async () => {
    setPasswordSuccess(null);
    if (!validatePasswordChange()) return;

    setChangingPassword(true);

    try {
      const supabase = createClient();

      // First verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile?.email || "",
        password: passwordData.currentPassword,
      });

      if (signInError) {
        setPasswordErrors({ currentPassword: "Current password is incorrect" });
        setChangingPassword(false);
        return;
      }

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (updateError) {
        setPasswordErrors({ form: updateError.message });
      } else {
        setPasswordSuccess("Password changed successfully");
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setTimeout(() => {
          setShowChangePassword(false);
          setPasswordSuccess(null);
        }, 2000);
      }
    } catch (e) {
      setPasswordErrors({ form: "An error occurred. Please try again." });
    } finally {
      setChangingPassword(false);
    }
  };

  const clearError = (field: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const clearPasswordError = (field: string) => {
    setPasswordErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full bg-[#FAFAFA] overflow-hidden">
        <AppSidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#FAFAFA] overflow-hidden">
      <AppSidebar />

      <main className="flex-1 flex flex-col relative overflow-hidden max-h-screen">
        {/* Header */}
        <div className="p-4 flex items-center justify-between shrink-0 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="h-8 w-8 text-slate-400 hover:text-slate-900 transition-all cursor-pointer" />
            <h1 className="text-2xl font-serif font-semibold tracking-tight text-slate-900">
              Profile
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="max-w-2xl mx-auto space-y-6">

            {/* Profile Card */}
            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6">
                {/* Avatar and name */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-16 w-16 rounded-full bg-slate-900 flex items-center justify-center shadow-sm">
                    {profile?.fullName ? (
                      <span className="text-white text-2xl font-serif font-bold">
                        {profile.fullName.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <UserCircle className="h-10 w-10 text-white" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {profile?.fullName || "User"}
                    </h2>
                    <p className="text-sm text-slate-500">{profile?.email}</p>
                  </div>
                </div>

                {/* Success/Error messages */}
                {successMessage && (
                  <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-sm">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    {successMessage}
                  </div>
                )}
                {errors.form && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {errors.form}
                  </div>
                )}

                {/* Form fields */}
                <div className="space-y-4">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-slate-700 uppercase tracking-widest ml-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={formData.fullName}
                        onChange={(e) => {
                          setFormData({ ...formData, fullName: e.target.value });
                          clearError("fullName");
                        }}
                        className={`pl-10 h-11 border-slate-200 focus:ring-slate-300 ${errors.fullName ? "border-red-400 focus:ring-red-300" : ""}`}
                        placeholder="Your full name"
                      />
                    </div>
                    {errors.fullName && (
                      <p className="text-xs text-red-600 ml-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.fullName}
                      </p>
                    )}
                  </div>

                  {/* Email (read-only) */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-slate-700 uppercase tracking-widest ml-1">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={profile?.email || ""}
                        disabled
                        className="pl-10 h-11 border-slate-200 bg-slate-50 text-slate-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 ml-1">
                      Email cannot be changed
                    </p>
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-slate-700 uppercase tracking-widest ml-1">
                      Phone
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={formData.phone}
                        onChange={(e) => {
                          setFormData({ ...formData, phone: e.target.value });
                          clearError("phone");
                        }}
                        className={`pl-10 h-11 border-slate-200 focus:ring-slate-300 ${errors.phone ? "border-red-400 focus:ring-red-300" : ""}`}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    {errors.phone && (
                      <p className="text-xs text-red-600 ml-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.phone}
                      </p>
                    )}
                  </div>
                </div>

                {/* Save button */}
                <div className="mt-6 flex justify-end">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="gap-2 bg-slate-900 hover:bg-black text-white font-semibold rounded-xl h-10 px-6 text-[13px] cursor-pointer transition-all hover:scale-105 active:scale-95"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </div>
            </Card>

            {/* Security Card */}
            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-slate-900">Security</h3>
                    <p className="text-[12px] text-slate-500">Manage your account security</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowChangePassword(true)}
                  className="w-full justify-start h-11 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Change Password
                </Button>
              </div>
            </Card>

            {/* Account Info */}
            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-slate-900">Account Information</h3>
                    <p className="text-[12px] text-slate-500">Your account details</p>
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-slate-50">
                    <span className="text-slate-500">Account ID</span>
                    <span className="text-slate-900 font-mono text-xs">{profile?.id}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-50">
                    <span className="text-slate-500">Member since</span>
                    <span className="text-slate-900">
                      {profile?.createdAt
                        ? new Date(profile.createdAt).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Unknown"}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

          </div>
        </div>
      </main>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl font-serif font-bold text-[#0f172a] tracking-tight">
              Change Password
            </DialogTitle>
            <DialogDescription className="text-[13px] text-slate-500">
              Enter your current password and a new secure password.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4">
            {passwordSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-sm">
                <CheckCircle className="h-4 w-4 shrink-0" />
                {passwordSuccess}
              </div>
            )}

            {passwordErrors.form && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {passwordErrors.form}
              </div>
            )}

            {/* Current Password */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-slate-700 uppercase tracking-widest">
                Current Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type={showPasswords.current ? "text" : "password"}
                  value={passwordData.currentPassword}
                  onChange={(e) => {
                    setPasswordData({ ...passwordData, currentPassword: e.target.value });
                    clearPasswordError("currentPassword");
                  }}
                  className={`pl-10 pr-10 h-11 border-slate-200 ${passwordErrors.currentPassword ? "border-red-400" : ""}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordErrors.currentPassword && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {passwordErrors.currentPassword}
                </p>
              )}
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-slate-700 uppercase tracking-widest">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type={showPasswords.new ? "text" : "password"}
                  value={passwordData.newPassword}
                  onChange={(e) => {
                    setPasswordData({ ...passwordData, newPassword: e.target.value });
                    clearPasswordError("newPassword");
                  }}
                  className={`pl-10 pr-10 h-11 border-slate-200 ${passwordErrors.newPassword ? "border-red-400" : ""}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordErrors.newPassword && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {passwordErrors.newPassword}
                </p>
              )}
              <p className="text-[11px] text-slate-400">Must be at least 8 characters</p>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-slate-700 uppercase tracking-widest">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type={showPasswords.confirm ? "text" : "password"}
                  value={passwordData.confirmPassword}
                  onChange={(e) => {
                    setPasswordData({ ...passwordData, confirmPassword: e.target.value });
                    clearPasswordError("confirmPassword");
                  }}
                  className={`pl-10 pr-10 h-11 border-slate-200 ${passwordErrors.confirmPassword ? "border-red-400" : ""}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordErrors.confirmPassword && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {passwordErrors.confirmPassword}
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowChangePassword(false)}
                className="flex-1 h-11 border-slate-200 text-slate-700 font-medium rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="flex-1 h-11 bg-[#0f172a] hover:bg-black text-white font-semibold rounded-xl"
              >
                {changingPassword ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Update Password"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

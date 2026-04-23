"use client";

import React from "react";
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  FileImage,
  File,
} from "lucide-react";

const iconMap: Record<
  string,
  { icon: React.ElementType; color: string; bg: string }
> = {
  pdf: { icon: FileText, color: "text-red-600", bg: "bg-red-50" },
  docx: { icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
  txt: { icon: FileCode, color: "text-slate-600", bg: "bg-slate-50" },
  html: { icon: FileCode, color: "text-orange-600", bg: "bg-orange-50" },
  csv: { icon: FileSpreadsheet, color: "text-emerald-600", bg: "bg-emerald-50" },
  image: { icon: FileImage, color: "text-purple-600", bg: "bg-purple-50" },
};

export function FileIcon({
  docType,
  size = "md",
}: {
  docType: string;
  size?: "sm" | "md" | "lg";
}) {
  const config = iconMap[docType] || {
    icon: File,
    color: "text-slate-500",
    bg: "bg-slate-50",
  };
  const Icon = config.icon;

  const sizeClasses = {
    sm: "h-7 w-7 [&_svg]:h-3.5 [&_svg]:w-3.5",
    md: "h-9 w-9 [&_svg]:h-4.5 [&_svg]:w-4.5",
    lg: "h-11 w-11 [&_svg]:h-5 [&_svg]:w-5",
  };

  return (
    <div
      className={`rounded-lg flex items-center justify-center border border-slate-100 ${config.bg} ${sizeClasses[size]}`}
    >
      <Icon className={config.color} />
    </div>
  );
}

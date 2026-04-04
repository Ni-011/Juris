"use client";

import React from "react";

type DocumentStatus =
  | "pending"
  | "parsing"
  | "chunking"
  | "embedding"
  | "analyzing"
  | "ready"
  | "failed";

const statusConfig: Record<
  DocumentStatus,
  { label: string; color: string; bg: string; dot: string; pulse: boolean }
> = {
  pending: {
    label: "Pending",
    color: "text-slate-600",
    bg: "bg-slate-50 border-slate-200",
    dot: "bg-slate-400",
    pulse: false,
  },
  parsing: {
    label: "Parsing",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    dot: "bg-amber-500",
    pulse: true,
  },
  chunking: {
    label: "Chunking",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    dot: "bg-amber-500",
    pulse: true,
  },
  embedding: {
    label: "Embedding",
    color: "text-violet-700",
    bg: "bg-violet-50 border-violet-200",
    dot: "bg-violet-500",
    pulse: true,
  },
  analyzing: {
    label: "Analyzing",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    dot: "bg-blue-500",
    pulse: true,
  },
  ready: {
    label: "Ready",
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
    dot: "bg-emerald-500",
    pulse: false,
  },
  failed: {
    label: "Failed",
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
    dot: "bg-red-500",
    pulse: false,
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as DocumentStatus] || statusConfig.pending;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${config.bg} ${config.color}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${config.dot} ${
          config.pulse ? "status-dot-pulse" : ""
        }`}
      />
      {config.label}
    </span>
  );
}

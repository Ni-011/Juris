"use client";

import { motion } from "framer-motion";

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-6">
        {/* Minimal Logo Animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative"
        >
          {/* Subtle Outer Pulse */}
          <motion.div
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute inset-0 bg-slate-900 rounded-2xl blur-xl"
          />

          <div className="h-16 w-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-serif font-bold text-2xl relative z-10 shadow-2xl shadow-slate-200">
            J
          </div>
        </motion.div>

        {/* Minimal Text Status */}
        <div className="flex flex-col items-center gap-1">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-[13px] font-bold text-slate-900 tracking-tight"
          >
            Juris
          </motion.h2>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-2"
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">
              Initializing
            </span>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                  className="w-1 h-1 rounded-full bg-slate-300"
                />
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Very subtle progress bar at the bottom for feel */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-50 overflow-hidden">
        <motion.div
          animate={{
            x: ["-100%", "100%"]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="h-full w-1/3 bg-slate-900/10 rounded-full"
        />
      </div>
    </div>
  );
}

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-5 h-5 border-2 border-slate-100 border-t-slate-900 rounded-full"
      />
    </div>
  );
}

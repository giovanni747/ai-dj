"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export function DashboardTab() {
  return (
    <div className="h-full w-full flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
        <h2 className="text-4xl font-bold text-white mb-4">Dashboard</h2>
        <p className="text-white/60 text-lg">Your music statistics and insights coming soon...</p>
      </motion.div>
    </div>
  );
}


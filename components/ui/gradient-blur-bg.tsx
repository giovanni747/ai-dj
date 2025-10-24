"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

interface GradientBlurBgProps {
  className?: string;
  children?: React.ReactNode;
  variant?: "single" | "dual";
}

export const GradientBlurBg = ({ 
  className, 
  children, 
  variant = "dual" 
}: GradientBlurBgProps) => {
  const [count, setCount] = useState(0);

  const singleGradientStyle = {
    backgroundImage: `
      linear-gradient(to right, #f0f0f0 1px, transparent 1px),
      linear-gradient(to bottom, #f0f0f0 1px, transparent 1px),
      radial-gradient(circle 800px at 100% 200px, #d5c5ff, transparent)
    `,
    backgroundSize: "96px 64px, 96px 64px, 100% 100%",
  };

  const dualGradientStyle = {
    backgroundImage: `
      linear-gradient(to right, rgba(229,231,235,0.4) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(229,231,235,0.4) 1px, transparent 1px),
      radial-gradient(circle 500px at 20% 80%, rgba(139,92,246,0.2), transparent),
      radial-gradient(circle 500px at 80% 20%, rgba(59,130,246,0.2), transparent)
    `,
    backgroundSize: "48px 48px, 48px 48px, 100% 100%, 100% 100%",
  };

  return (
    <div className={cn("min-h-screen w-full bg-white relative", className)}>
      {/* Gradient Background */}
      <div
        className="absolute inset-0 z-0"
        style={variant === "single" ? singleGradientStyle : dualGradientStyle}
      />
      {/* Your Content/Components */}
      {children}
    </div>
  );
};

export default GradientBlurBg;

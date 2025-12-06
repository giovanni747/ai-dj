"use client";

import { motion } from "framer-motion";

interface HandWrittenTitleProps {
    title?: React.ReactNode;
    subtitle?: string;
}

function HandWrittenTitle({
    title = "Hand Written",
    subtitle = "Optional subtitle",
}: HandWrittenTitleProps) {
    const draw = {
        hidden: { pathLength: 0, opacity: 0 },
        visible: {
            pathLength: 1,
            opacity: 1,
            transition: {
                pathLength: { duration: 2.5, ease: "easeInOut" as const },
                opacity: { duration: 0.5 },
            },
        },
    };

    return (
        <div className="relative w-full max-w-4xl mx-auto py-24">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <motion.svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 1200 600"
                    initial="hidden"
                    animate="visible"
                    className="w-full h-full"
                    style={{ transform: 'scale(.9)' }}
                >
                    <title>KokonutUI</title>
                    <motion.path
                        d="M 950 90 
                           C 1250 300, 1050 480, 600 520
                           C 250 520, 150 480, 150 300
                           C 150 120, 350 80, 600 80
                           C 850 80, 950 180, 950 180"
                        fill="none"
                        strokeWidth="8"
                        stroke="white"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        variants={draw}
                        className="opacity-90"
                    />
                </motion.svg>
            </div>
            <div className="relative text-center z-10 flex flex-col items-center justify-center -mt-6">
                <motion.div
                    className="text-2xl md:text-4xl text-white tracking-tighter flex items-center gap-2 font-bold"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                >
                    {title}
                </motion.div>
                {subtitle && (
                    <motion.p
                        className="text-sm text-white/60 max-w-[280px] mx-auto leading-relaxed font-medium mt-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1, duration: 0.8 }}
                    >
                        {subtitle}
                    </motion.p>
                )}
            </div>
        </div>
    );
}

export { HandWrittenTitle }


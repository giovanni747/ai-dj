"use client";

import { AIInputWithLoading } from "@/components/ui/ai-input-with-loading";
import { useState } from "react";

export function AIInputWithLoadingDemo() {
  const [messages, setMessages] = useState<string[]>([]);

  const simulateResponse = async (message: string) => {
    await new Promise(resolve => setTimeout(resolve, 3000));
    setMessages(prev => [...prev, message]);
  };

  return (
    <div className="space-y-8 min-w-[350px] sm:min-w-[500px] md:min-w-[690px] w-full">
        <div className="space-y-4">
          <div className="max-w-4xl w-full mx-auto px-4">
            <div className="flex flex-col items-end space-y-2 w-full">
              {messages.map((msg, i) => (
                <div key={i} className="inline-block px-4 py-2 bg-gray-100 rounded-2xl text-gray-900 text-sm max-w-[65%] break-word opacity-100">
                  {msg}
                </div>
              ))}
            </div>
          </div>
          <AIInputWithLoading 
            onSubmit={simulateResponse}
            loadingDuration={3000}
          />
        </div>
    </div>
  );
}

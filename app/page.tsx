import { AIInputWithLoadingDemo } from "@/components/ui/ai-input-demo";
import { GradientBlurBg } from "@/components/ui/gradient-blur-bg";

export default function Home() {
  return (
    <GradientBlurBg variant="dual">
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-left">
          <h1>AI DJ Assistant</h1>
          <AIInputWithLoadingDemo />
        </div>
      </div>
    </GradientBlurBg>
  );
}

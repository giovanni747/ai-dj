import Loader from "@/components/kokonutui/loader";

export default function Loading() {
  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 flex min-h-screen items-center justify-center">
        <Loader 
          title="Loading..." 
          subtitle="Please wait"
          size="md"
        />
      </div>
    </div>
  );
}


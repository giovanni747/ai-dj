"use client";

import { useEffect, useState } from "react";
import { useRive } from "@rive-app/react-canvas";

/**
 * Debug component to inspect Rive file contents
 * Add this temporarily to see what's available in your Rive file
 */
export function RiveDebug({ src = "/dj_avatar.riv" }: { src?: string }) {
  const [info, setInfo] = useState<any>(null);
  const { rive } = useRive({
    src,
    autoplay: true,
  });

  useEffect(() => {
    if (!rive) return;

    try {
      const riveInfo: any = {
        artboards: [],
        animations: [],
        stateMachines: [],
        stateMachineInputs: {},
      };

      // Access properties using type assertion since some may be private
      const riveAny = rive as any;

      // Try to get artboard names
      try {
        if (riveAny.artboardNames) {
          riveInfo.artboards = riveAny.artboardNames;
        } else if (riveAny.artboard?.name) {
          riveInfo.artboards = [riveAny.artboard.name];
        }
      } catch (e) {
        console.warn("Could not get artboard names:", e);
      }

      // Try to get animation names
      try {
        if (riveAny.animationNames) {
          riveInfo.animations = riveAny.animationNames;
        } else if (riveAny.artboard?.animationNames) {
          riveInfo.animations = riveAny.artboard.animationNames;
        }
      } catch (e) {
        console.warn("Could not get animation names:", e);
      }

      // Try to get state machine names
      try {
        if (riveAny.stateMachineNames) {
          riveInfo.stateMachines = riveAny.stateMachineNames;
        }
      } catch (e) {
        console.warn("Could not get state machine names:", e);
      }

      // Get state machine inputs if available
      try {
        if (riveInfo.stateMachines && riveInfo.stateMachines.length > 0) {
          riveInfo.stateMachines.forEach((smName: string) => {
            try {
              const sm = riveAny.stateMachineInputs?.(smName);
              if (sm && Array.isArray(sm)) {
                riveInfo.stateMachineInputs[smName] = sm.map((input: any) => ({
                  name: input.name,
                  type: input.type, // 'boolean', 'number', 'trigger'
                  value: input.value,
                }));
              }
            } catch (e) {
              riveInfo.stateMachineInputs[smName] = `Error: ${e}`;
            }
          });
        }
      } catch (e) {
        console.warn("Could not get state machine inputs:", e);
      }

      // Log the raw rive object for inspection
      console.log("🎨 Rive Object:", rive);
      console.log("🎨 Rive File Info:", riveInfo);

      setInfo(riveInfo);
    } catch (error) {
      console.error("Error getting Rive info:", error);
      setInfo({
        artboards: [],
        animations: [],
        stateMachines: [],
        stateMachineInputs: {},
        error: String(error),
      });
    }
  }, [rive]);

  if (!info) {
    return <div className="p-4 text-white">Loading Rive file...</div>;
  }

  return (
    <div className="p-4 bg-black/80 text-white text-xs font-mono max-w-2xl">
      <h2 className="text-lg font-bold mb-4">Rive File Debug Info</h2>
      
      <div className="mb-4">
        <h3 className="font-bold text-yellow-400">Artboards:</h3>
        <ul className="list-disc list-inside ml-2">
          {info.artboards.map((name: string) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>

      <div className="mb-4">
        <h3 className="font-bold text-yellow-400">Animations:</h3>
        <ul className="list-disc list-inside ml-2">
          {info.animations.map((name: string) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>

      <div className="mb-4">
        <h3 className="font-bold text-yellow-400">State Machines:</h3>
        <ul className="list-disc list-inside ml-2">
          {info.stateMachines.map((name: string) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>

      <div className="mb-4">
        <h3 className="font-bold text-yellow-400">State Machine Inputs:</h3>
        {Object.entries(info.stateMachineInputs).map(([smName, inputs]: [string, any]) => (
          <div key={smName} className="ml-2 mb-2">
            <div className="font-semibold text-green-400">{smName}:</div>
            {Array.isArray(inputs) ? (
              <ul className="list-disc list-inside ml-4">
                {inputs.map((input: any, idx: number) => (
                  <li key={idx}>
                    {input.name} ({input.type}) = {String(input.value)}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="ml-4 text-red-400">{String(inputs)}</div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 p-2 bg-gray-800 rounded">
        <div className="font-bold mb-1">Check browser console for full object</div>
        <div className="text-gray-400">Open DevTools (F12) → Console tab</div>
      </div>
    </div>
  );
}


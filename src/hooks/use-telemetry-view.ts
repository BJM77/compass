import { useEffect, useRef } from "react";
import { telemetry } from "@/lib/telemetry";

export function useTelemetryView(userId: string | undefined, viewKey: string) {
  const mountTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    mountTimeRef.current = Date.now();

    return () => {
      if (!userId) return;
      const dwellTimeMs = Date.now() - mountTimeRef.current;
      telemetry.trackView(userId, viewKey, dwellTimeMs);
    };
  }, [userId, viewKey]);
}

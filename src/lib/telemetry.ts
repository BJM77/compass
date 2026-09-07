import { doc, writeBatch, serverTimestamp, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface TelemetryEvent {
  userId: string;
  viewKey: string;
  action: "view_enter" | "view_exit" | "click" | "feature_usage";
  dwellTimeMs?: number;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

const BATCH_SIZE_LIMIT = 10;
const FLUSH_INTERVAL_MS = 30000;
const DWELL_TIME_THRESHOLD_MS = 3000;

class TelemetryService {
  private buffer: TelemetryEvent[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.startTimer();
    }
  }

  private startTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  public trackView(userId: string, viewKey: string, dwellTimeMs?: number, metadata?: Record<string, unknown>) {
    // Filter out pass-through navigation if dwell time is under 3 seconds
    if (dwellTimeMs !== undefined && dwellTimeMs < DWELL_TIME_THRESHOLD_MS) {
      return;
    }

    const event: TelemetryEvent = {
      userId,
      viewKey,
      action: "view_enter",
      dwellTimeMs,
      metadata,
      timestamp: new Date().toISOString(),
    };

    this.buffer.push(event);

    if (this.buffer.length >= BATCH_SIZE_LIMIT) {
      this.flush();
    }
  }

  public async flush() {
    if (this.buffer.length === 0) return;

    const eventsToFlush = [...this.buffer];
    this.buffer = [];

    // Fire-and-forget: wrap in try/catch, silently drop on failure without disrupting UX
    try {
      const batch = writeBatch(db);
      const viewCounts: Record<string, number> = {};

      for (const event of eventsToFlush) {
        // Raw event record
        const eventRef = doc(db, "telemetryEvents", `${event.userId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
        batch.set(eventRef, {
          ...event,
          createdAt: serverTimestamp(),
        });

        // Tally view counts for pre-aggregation
        viewCounts[event.viewKey] = (viewCounts[event.viewKey] || 0) + 1;
      }

      // Update pre-aggregates using FieldValue.increment()
      for (const [viewKey, count] of Object.entries(viewCounts)) {
        const aggregateRef = doc(db, "telemetryAggregates", viewKey);
        batch.set(
          aggregateRef,
          {
            viewKey,
            viewCount: increment(count),
            lastUpdated: serverTimestamp(),
          },
          { merge: true }
        );
      }

      await batch.commit();
    } catch (error) {
      console.warn("Telemetry batch flush skipped/failed silently:", error);
    }
  }
}

export const telemetry = new TelemetryService();

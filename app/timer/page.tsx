"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import Button from "@/components/Button";

type TimerState = {
  phaseIndex: number;
  phaseStartedAt: number; // epoch ms when the current phase began/resumed
  paused: boolean;
  pausedRemaining: number; // seconds left when paused
};

const STORAGE_KEY = "sundays_timer_state";
const CHANNEL_NAME = "sundays-timer-sync";

// Phases shared across all windows
const phases = [
  { duration: 45 * 60, label: "45 Minutes of Deep Work" },
  { duration: 10 * 60, label: "10 Minutes to Talk" },
];


/** Format time as MM:SS */
function formatTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/** Format end time as 12hr AM/PM */
function formatTime12(date: Date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
}

function buildInitialState(): TimerState {
  return {
    phaseIndex: 0,
    phaseStartedAt: Date.now(),
    paused: false,
    pausedRemaining: phases[0].duration,
  };
}

export default function TimerPage() {
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(Date.now());
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const readStoredState = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as TimerState) : null;
    } catch {
      return null;
    }
  };

  const persistState = (next: TimerState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    channelRef.current?.postMessage({ type: "state", state: next });
  };

  const updateTimerState = (updater: (prev: TimerState) => TimerState) => {
    setTimerState((prev: TimerState | null) => {
      const base = prev ?? buildInitialState();
      const next = updater(base);
      persistState(next);
      return next;
    });
  };

  const computeRemaining = (state: TimerState, current: number) => {
    const duration = phases[state.phaseIndex].duration;
    if (state.paused) return state.pausedRemaining;
    const elapsed = Math.floor((current - state.phaseStartedAt) / 1000);
    return Math.max(duration - elapsed, 0);
  };

  // Keep a ticking "now" so all windows compute the same displayed value
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Initial state load (shared across windows)
  useEffect(() => {
    const stored = readStoredState();
    const initial = stored ?? buildInitialState();
    setTimerState(initial);
    if (!stored) {
      persistState(initial);
    }
  }, []);

  // BroadcastChannel for real-time sync across windows
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
      return;
    }
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "state") {
        setTimerState(event.data.state as TimerState);
      }
    };
    channel.addEventListener("message", handler);
    return () => {
      channel.removeEventListener("message", handler);
      channel.close();
    };
  }, []);

  // Storage event fallback (fires on other tabs)
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue) as TimerState;
          setTimerState(parsed);
        } catch {
          // ignore invalid payloads
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const remaining = useMemo(() => {
    if (!timerState) return phases[0].duration;
    return computeRemaining(timerState, now);
  }, [timerState, now]);

  const endTime = useMemo(() => new Date(now + remaining * 1000), [now, remaining]);

  const advancePhase = useCallback(() => {
    updateTimerState((prev) => {
      const nextPhase = (prev.phaseIndex + 1) % phases.length;
      const nextState: TimerState = {
        phaseIndex: nextPhase,
        phaseStartedAt: Date.now(),
        paused: false,
        pausedRemaining: phases[nextPhase].duration,
      };
      return nextState;
    });
  }, []);

  // Automatically advance when the shared timer hits zero
  useEffect(() => {
    if (!timerState || timerState.paused) return;
    if (remaining <= 0) {
      advancePhase();
    }
  }, [remaining, timerState, advancePhase]);

  const togglePause = () => {
    if (!timerState) return;
    if (timerState.paused) {
      const duration = phases[timerState.phaseIndex].duration;
      const resumedStart =
        Date.now() - (duration - timerState.pausedRemaining) * 1000;
      updateTimerState((prev) => ({
        ...prev,
        paused: false,
        phaseStartedAt: resumedStart,
        pausedRemaining: duration,
      }));
      return;
    }

    updateTimerState((prev) => ({
      ...prev,
      paused: true,
      pausedRemaining: remaining,
    }));
  };

  const restartPhase = () => {
    updateTimerState((prev) => ({
      ...prev,
      paused: false,
      phaseStartedAt: Date.now(),
      pausedRemaining: phases[prev.phaseIndex].duration,
    }));
  };

  const effectiveState = timerState ?? buildInitialState();

  return (
    <main
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "#fcfaf7",
        backgroundImage:
          "linear-gradient(#ede7ff 1px, transparent 1px), linear-gradient(to right, #ede7ff 1px, #fcfaf7 1px)",
        backgroundSize: "20px 20px",
      }}
    >
      <Link href="/" className="absolute top-4 left-6 md:left-12">
        <Image
          src="/smiley.png"
          alt="Logo"
          width={32}
          height={32}
          className="opacity-80 hover:opacity-100 transition-opacity"
        />
      </Link>
      <h1 style={{ fontFamily: "PP Mondwest", fontSize: "1.5rem" }}>
        {phases[effectiveState.phaseIndex].label}
      </h1>
      <div
        style={{
          fontFamily: "PP Mondwest",
          color: "#3600cf",
          fontSize: "clamp(40px, 15vw, 200px)",
          margin: "24px 0",
        }}
      >
        {mounted ? formatTime(remaining) : "\u00A0"}
      </div>
      <p style={{ fontFamily: "PP Mondwest" }}>
        {mounted ? `Ends at ${formatTime12(endTime)}` : "\u00A0"}
      </p>
      <div style={{ display: "flex", gap: "24px", marginTop: "12px" }}>
        <Button variant="dark" size="md" onClick={togglePause}>
          {effectiveState.paused ? "Resume" : "Pause"}
        </Button>
        <Button size="md" className="bg-stone-100 border-stone-300 hover:bg-stone-200" onClick={restartPhase}>
          Restart
        </Button>
        <Button size="md" className="bg-stone-100 border-stone-300 hover:bg-stone-200" onClick={advancePhase}>
          Skip
        </Button>
      </div>
    </main>
  );
}

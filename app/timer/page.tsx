"use client";

import React, { useEffect, useState } from "react";

export default function TimerPage() {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [remaining, setRemaining] = useState(45 * 60);
  const [paused, setPaused] = useState(false);
  const [spotifyReady, setSpotifyReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [player, setPlayer] = useState<any>(null);

  // Phases
  const phases = [
    { duration: 45 * 60, label: "45 Minutes of Deep Work", music: false },
    { duration: 10 * 60, label: "10 Minutes to Talk", music: true },
  ];

  const playlistUri = "spotify:playlist:2F0pDOIUewAIJ37vjztRiN";

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

  /** Phase logic */
  const switchPhase = () => {
    const next = (phaseIndex + 1) % phases.length;
    setPhaseIndex(next);
    setRemaining(phases[next].duration);
    if (phases[next].music) {
      playPlaylist(playlistUri);
    } else {
      player?.pause();
    }
  };

  /** Timer logic */
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          switchPhase();
          return phases[(phaseIndex + 1) % phases.length].duration;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [paused, phaseIndex]);

  /** Spotify SDK loader */
  useEffect(() => {
    const token = localStorage.getItem("spotify_access_token");
    if (!token) return;

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    (window as any).onSpotifyWebPlaybackSDKReady = () => {
      const player = new (window as any).Spotify.Player({
        name: "Sundays Timer Player",
        getOAuthToken: (cb: (token: string) => void) => cb(token),
        volume: 0.5,
      });
      setPlayer(player);

      player.addListener("ready", ({ device_id }: any) => {
        console.log("Ready with Device ID", device_id);
        setDeviceId(device_id);
        setSpotifyReady(true);
      });

      player.connect();
    };
  }, []);

  /** Play playlist when phase changes to music phase */
  async function playPlaylist(uri: string) {
    if (!deviceId) return;
    const token = localStorage.getItem("spotify_access_token");
    if (!token) return;
    await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
      {
        method: "PUT",
        body: JSON.stringify({ context_uri: uri }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
  }

  /** Current end time */
  const endTime = new Date(Date.now() + remaining * 1000);

  return (
    <main
      style={{
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
      <h1 style={{ fontFamily: "PP Mondwest", fontSize: "1.5rem" }}>
        {phases[phaseIndex].label}
      </h1>
      <div
        style={{
          fontFamily: "PP Mondwest",
          color: "#3600cf",
          fontSize: "clamp(40px, 15vw, 200px)",
        }}
      >
        {formatTime(remaining)}
      </div>
      <p style={{ fontFamily: "PP Neue Montreal" }}>
        Ends at {formatTime12(endTime)}
      </p>
      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={() => setPaused((p) => !p)}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button onClick={() => setRemaining(phases[phaseIndex].duration)}>
          Restart
        </button>
        <button onClick={switchPhase}>Skip</button>
      </div>
      {phases[phaseIndex].music && (
        <div style={{ marginTop: "2rem", fontFamily: "PP Neue Montreal" }}>
          🎵 Now Playing: Sundays Playlist
        </div>
      )}
    </main>
  );
}

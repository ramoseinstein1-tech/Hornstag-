"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type VideoPlayerHandle = {
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, {
  src: string;
  /** Seeks here once THIS src's metadata finishes loading — for callers
   * that change `src` and want to land on a specific position as soon as
   * it's ready, without racing the video element's own async load. An
   * imperative seekTo() call made right after changing `src` would often
   * target the outgoing element before the new source has attached. */
  seekOnLoadSeconds?: number;
  onTimeUpdate?: (seconds: number) => void;
  onDurationChange?: (seconds: number) => void;
}>(function VideoPlayer({ src, seekOnLoadSeconds, onTimeUpdate, onDurationChange }, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useImperativeHandle(ref, () => ({
    seekTo(seconds: number) {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = seconds;
      setCurrentTime(seconds);
    },
    getCurrentTime() {
      return videoRef.current?.currentTime ?? 0;
    },
  }));

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTime = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
    };
    const handleMeta = () => {
      setDuration(video.duration);
      onDurationChange?.(video.duration);
      if (seekOnLoadSeconds != null) {
        video.currentTime = seekOnLoadSeconds;
        setCurrentTime(seekOnLoadSeconds);
      }
    };
    video.addEventListener("timeupdate", handleTime);
    video.addEventListener("loadedmetadata", handleMeta);
    video.addEventListener("play", () => setPlaying(true));
    video.addEventListener("pause", () => setPlaying(false));
    return () => {
      video.removeEventListener("timeupdate", handleTime);
      video.removeEventListener("loadedmetadata", handleMeta);
    };
    // Intentionally keyed only on `src` — seekOnLoadSeconds should apply
    // once per source load, not re-fire just because the target value
    // was updated for some other reason while the same src is loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }

  function handleSeekBar(e: React.ChangeEvent<HTMLInputElement>) {
    const video = videoRef.current;
    if (!video) return;
    const seconds = Number(e.target.value);
    video.currentTime = seconds;
    setCurrentTime(seconds);
  }

  return (
    <div className="hs-panel sheen-top overflow-hidden p-0">
      <video ref={videoRef} src={src} className="aspect-video w-full bg-black" />
      <div className="flex items-center gap-3 border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-border-strong text-text transition-colors hover:border-orange/50 hover:text-orange-bright"
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={handleSeekBar}
          className="h-1 flex-1 accent-[var(--orange)]"
          aria-label="Seek"
        />
        <span className="font-mono-tech text-[0.62rem] tracking-[0.08em] text-text-faint">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
});

export default VideoPlayer;

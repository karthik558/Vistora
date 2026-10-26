"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface PreloaderProps {
  isLoading: boolean;
  onFinish?: () => void;
  message?: string;
}

export default function Preloader({
  isLoading,
  onFinish,
  message = "Initializing operations workspace…",
}: PreloaderProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  const steps = [
    "Initializing operations workspace…",
    "Loading verified hotel properties & stays…",
    "Synchronizing guest experience records…",
    "Workspace ready",
  ];

  useEffect(() => {
    const timer1 = setTimeout(() => setStep(1), 350);
    const timer2 = setTimeout(() => setStep(2), 700);
    const timer3 = setTimeout(() => setStep(3), 1050);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setFading(true);
      const timer = setTimeout(() => {
        setVisible(false);
        if (onFinish) onFinish();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isLoading, onFinish]);

  if (!visible) return null;

  return (
    <div
      className={`preloader-overlay ${fading ? "preloader-fade-out" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Loading Vistora Workspace"
    >
      <div className="preloader-content">
        {/* Brand Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
          <Image
            src="/vistora_wordmark_white.webp"
            alt="Vistora"
            width={160}
            height={38}
            priority
            style={{ height: "36px", width: "auto", objectFit: "contain" }}
          />
        </div>
        <p className="preloader-sub" style={{ marginTop: "2px" }}>GUEST EXPERIENCE OPERATIONS</p>

        {/* Progress Bar */}
        <div className="preloader-track">
          <div
            className="preloader-bar"
            style={{
              width: !isLoading ? "100%" : step === 0 ? "25%" : step === 1 ? "55%" : step === 2 ? "85%" : "98%",
            }}
          />
        </div>

        {/* Dynamic Status Message */}
        <div className="preloader-status">
          <span className="preloader-dot" />
          <span>{steps[step] || message}</span>
        </div>
      </div>
    </div>
  );
}

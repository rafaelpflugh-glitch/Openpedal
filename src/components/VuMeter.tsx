import React, { useEffect, useRef } from 'react';
import { OpenPedalEngine } from '../audio/OpenPedalEngine';

interface VuMeterProps {
  engine: OpenPedalEngine;
  active: boolean;
}

export const VuMeter: React.FC<VuMeterProps> = ({ engine, active }) => {
  const inBarRef = useRef<HTMLDivElement>(null);
  const outBarRef = useRef<HTMLDivElement>(null);
  const inClipRef = useRef<HTMLSpanElement>(null);
  const outClipRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let rafId = 0;
    const wave = new Float32Array(256);

    const draw = () => {
      if (active && engine.isInitialized()) {
        const { inDb, outDb, inClip, outClip } = engine.getMeters();
        const inPct = Math.max(0, Math.min(100, ((inDb + 60) / 60) * 100));
        const outPct = Math.max(0, Math.min(100, ((outDb + 60) / 60) * 100));

        if (inBarRef.current) inBarRef.current.style.width = `${inPct}%`;
        if (outBarRef.current) outBarRef.current.style.width = `${outPct}%`;
        if (inClipRef.current) inClipRef.current.classList.toggle('is-clipping', inClip);
        if (outClipRef.current) outClipRef.current.classList.toggle('is-clipping', outClip);

        const canvas = canvasRef.current;
        if (canvas) {
          const ctx2d = canvas.getContext('2d');
          if (ctx2d) {
            engine.getOutputWaveform(wave);
            ctx2d.fillStyle = '#0c1017';
            ctx2d.fillRect(0, 0, canvas.width, canvas.height);

            // Center line
            ctx2d.strokeStyle = 'rgba(148, 163, 184, 0.16)';
            ctx2d.lineWidth = 1;
            ctx2d.beginPath();
            ctx2d.moveTo(0, canvas.height / 2);
            ctx2d.lineTo(canvas.width, canvas.height / 2);
            ctx2d.stroke();

            // Waveform trace
            ctx2d.strokeStyle = '#38bdf8';
            ctx2d.lineWidth = 1.6;
            ctx2d.beginPath();
            const stepX = canvas.width / (wave.length - 1);
            for (let i = 0; i < wave.length; i++) {
              const x = i * stepX;
              const y = (0.5 - wave[i] * 0.44) * canvas.height;
              if (i === 0) ctx2d.moveTo(x, y);
              else ctx2d.lineTo(x, y);
            }
            ctx2d.stroke();
          }
        }
      }
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [engine, active]);

  return (
    <div className="vu-scope-widget">
      <div className="vu-bars">
        <div className="vu-row">
          <span className="vu-tag">IN</span>
          <div className="vu-track">
            <div ref={inBarRef} className="vu-fill" />
          </div>
          <span ref={inClipRef} className="vu-clip" title="Clip de entrada" />
        </div>
        <div className="vu-row">
          <span className="vu-tag">OUT</span>
          <div className="vu-track">
            <div ref={outBarRef} className="vu-fill" />
          </div>
          <span ref={outClipRef} className="vu-clip" title="Clip de saída" />
        </div>
      </div>
      <canvas ref={canvasRef} width={118} height={32} className="mini-scope" />
    </div>
  );
};

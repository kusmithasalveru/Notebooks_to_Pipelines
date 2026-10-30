/**
 * Cinematic Loading Screen
 *
 * Shows brand animation and real initialization progress.
 * Progress is driven by actual backend health + initial data fetch.
 * Respects prefers-reduced-motion.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { health, listRuns } from '../api';

const MIN_DURATION_MS = 1500; // minimum brand impression time

// Particle system for cinematic background
function ParticleCanvas({ prefersReducedMotion }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;

    const resize = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialize particles
    const particleCount = Math.min(40, Math.floor((width * height) / 20000));
    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.5 + 0.1,
      hue: 195 + Math.random() * 20, // cyan range
    }));

    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // Draw particles only - no O(n^2) connections for performance
      particlesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, 60%, ${p.alpha})`;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    if (!prefersReducedMotion) {
      animate();
    } else {
      // Draw static frame
      particlesRef.current.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, 60%, ${p.alpha})`;
        ctx.fill();
      });
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [prefersReducedMotion]);

  return <canvas ref={canvasRef} className="loading-screen__canvas" />;
}

function LoadingScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('health'); // health | runs | complete
  const [error, setError] = useState(null);
  const [startTime] = useState(Date.now());
  const animationRef = useRef(null);
  const completedRef = useRef(false);

  const prefersReducedMotion = useReducedMotion();

  // Smooth progress animation toward target
  const animateProgress = useCallback((target, duration = 600) => {
    if (prefersReducedMotion) {
      setProgress(target);
      return;
    }
    const start = progress;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease-in-out cubic
      setProgress(start + (target - start) * eased);
      if (t < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    animate();
  }, [progress, prefersReducedMotion]);

  // Fetch health and runs concurrently, track progress
  useEffect(() => {
    let cancelled = false;

    const runInitialization = async () => {
      try {
        // Stage 1: Health check + runs list concurrently
        setStage('health');
        animateProgress(30, 400);

        // Launch both requests in parallel - health is fast, runs may take longer
        const [healthData, runsData] = await Promise.all([
          health().catch(e => { throw new Error('Backend unavailable: ' + e.message); }),
          listRuns().catch(e => { console.warn('Runs list fetch failed:', e.message); return []; }),
        ]);
        if (cancelled) return;

        // Stage 2: Complete
        setStage('complete');
        animateProgress(100, 400);

        // Enforce minimum duration for brand impression
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, MIN_DURATION_MS - elapsed);

        setTimeout(() => {
          if (!cancelled && !completedRef.current) {
            completedRef.current = true;
            onComplete();
          }
        }, remaining);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'Initialization failed');
        animateProgress(100, 300);
      }
    };

    runInitialization();

    return () => {
      cancelled = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [animateProgress, startTime, onComplete]);

  // Reduced motion detection
  function useReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReduced(mediaQuery.matches);
      const handler = (e) => setReduced(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }, []);
    return reduced;
  }

  if (error) {
    return (
      <div className="loading-screen loading-screen--error" role="alert">
        <div className="loading-screen__card">
          <div className="loading-screen__brand">
            <span className="loading-screen__mark" aria-hidden="true" />
            <span className="loading-screen__name">Turning Notebooks into Pipelines</span>
          </div>
          <p className="loading-screen__error">{error}</p>
          <button className="loading-screen__retry" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const ringProgress = progress / 100;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference * (1 - ringProgress);

  return (
    <div className="loading-screen" role="status" aria-label="Loading application">
      <div className="loading-screen__bg" aria-hidden="true">
        <ParticleCanvas prefersReducedMotion={prefersReducedMotion} />
      </div>

      <div className="loading-screen__card">
        {/* Brand mark with entrance animation */}
        <div className="loading-screen__brand">
          <span className="loading-screen__mark" aria-hidden="true" />
          <span className="loading-screen__name">Turning Notebooks into Pipelines</span>
        </div>

        <p className="loading-screen__tagline">Notebook Pipeline</p>

        {/* Progress ring */}
        <div className="loading-screen__progress-wrap">
          <svg className="loading-screen__progress-svg" viewBox="0 0 100 100" aria-hidden="true">
            <circle
              className="loading-screen__progress-bg"
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="rgba(0, 212, 255, 0.15)"
              strokeWidth="3"
            />
            <circle
              className="loading-screen__progress-ring"
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#00d4ff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                transform: 'rotate(-90deg)',
                transformOrigin: 'center',
                transition: prefersReducedMotion ? 'none' : 'stroke-dashoffset 0.4s ease-out',
              }}
            />
          </svg>
          <span className="loading-screen__progress-text">
            {stage === 'health' && 'Connecting to backend…'}
            {stage === 'runs' && 'Loading run history…'}
            {stage === 'complete' && 'Ready'}
          </span>
        </div>

        <p className="loading-screen__hint">Initializing…</p>
      </div>
    </div>
  );
}

export default LoadingScreen;
/**
 * Premium Demo Entry Screen
 *
 * Shown after LoadingScreen completes. Not real authentication.
 * Clicking "Enter Application" transitions to the main dashboard.
 */
import React, { useState, useEffect, useRef } from 'react';

// Particle system for cinematic background (shared with LoadingScreen)
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

    // Initialize particles - slightly more for welcome screen
    const particleCount = Math.min(50, Math.floor((width * height) / 18000));
    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.5 + 0.1,
      hue: 190 + Math.random() * 30, // cyan-teal range
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

  return <canvas ref={canvasRef} className="welcome-screen__canvas" />;
}

function WelcomeScreen({ onEnter }) {
  const [visible, setVisible] = useState(false);
  const [entering, setEntering] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Staggered entrance animation
  useEffect(() => {
    if (prefersReducedMotion) {
      setVisible(true);
      return;
    }
    // Small delay for cross-fade from loading screen
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, [prefersReducedMotion]);

  const handleEnter = () => {
    if (entering) return;
    setEntering(true);
    // Exit animation
    if (!prefersReducedMotion) {
      setTimeout(() => onEnter(), 350);
    } else {
      onEnter();
    }
  };

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

  return (
    <div
      className={`welcome-screen ${visible ? 'welcome-screen--visible' : ''} ${entering ? 'welcome-screen--exiting' : ''}`}
      role="main"
      aria-label="Welcome to Capstone Notebook Pipeline"
    >
      <div className="welcome-screen__bg" aria-hidden="true">
        <ParticleCanvas prefersReducedMotion={prefersReducedMotion} />
      </div>

      <div className="welcome-screen__card">
        <div className="welcome-screen__brand">
          <span className="welcome-screen__mark" aria-hidden="true" />
          <span className="welcome-screen__name">Turning Notebooks into Pipelines</span>
        </div>

        <p className="welcome-screen__subtitle">Notebook Pipeline</p>

        <p className="welcome-screen__description">
          Transform notebooks into reproducible data runs with one click.
        </p>

        <button
          className="welcome-screen__enter-btn"
          onClick={handleEnter}
          disabled={entering}
          aria-busy={entering}
        >
          <span className="welcome-screen__btn-text">Enter Application</span>
          <svg
            className="welcome-screen__btn-arrow"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden="true"
          >
            <path d="M5 12h14M12 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <p className="welcome-screen__footnote">
          Demo entry screen — this is not real authentication.
        </p>
      </div>
    </div>
  );
}

export default WelcomeScreen;
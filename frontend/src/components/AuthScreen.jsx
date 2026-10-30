/**
 * Demo entry screen — not real authentication.
 *
 * Reuses the visual language of K:\AuthScreen\AuthScreen\Loginpagestyle.css
 * (dark #1a1a2e background, cyan #00d4ff accents, Poppins-style typography,
 * sliding panels with staggered transitions, blur-on-reveal) but rebuilt as
 * a React component with local-only styling. The original files under
 * K:\AuthScreen\AuthScreen\ are untouched.
 *
 * External CDN/font dependencies are replaced with system fonts and inline
 * SVG icons so the app works fully offline.
 */
import React, { useState } from 'react';

function AuthScreen({ onEnter }) {
  const [isRegister, setIsRegister] = useState(false);

  return (
    <div className="auth-wrapper" role="main">
      <div className="background-shape" aria-hidden="true" />
      <div className="secondary-shape" aria-hidden="true" />

      {/* Sign-in panel */}
      <section className={`credentials-panel signin ${isRegister ? 'inactive' : ''}`} aria-labelledby="signin-title">
        <h2 id="signin-title" className="slide-element">Login</h2>
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            onEnter();
          }}
          noValidate
        >
          <div className="field-wrapper slide-element">
            <input
              id="signin-username"
              type="text"
              required
              autoComplete="username"
              aria-label="Username"
            />
            <label htmlFor="signin-username">Username</label>
            <svg className="field-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M4 21c0-4 4-6 8-6s8 2 8 6" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>

          <div className="field-wrapper slide-element">
            <input
              id="signin-password"
              type="password"
              required
              autoComplete="current-password"
              aria-label="Password"
            />
            <label htmlFor="signin-password">Password</label>
            <svg className="field-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="15" r="2" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>

          <div className="field-wrapper slide-element">
            <button type="submit" className="submit-button">
              Login
            </button>
          </div>

          <div className="switch-link slide-element">
            <p>
              Don't have an account?{' '}
              <a
                href="#"
                role="button"
                tabIndex={0}
                className="register-trigger"
                onClick={(e) => {
                  e.preventDefault();
                  setIsRegister(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsRegister(true);
                  }
                }}
              >
                Sign Up
              </a>
            </p>
          </div>
        </form>
      </section>

      {/* Welcome section */}
      <section className="welcome-section signin" aria-hidden="true">
        <h2 className="slide-element">WELCOME BACK!</h2>
      </section>

      {/* Sign-up panel */}
      <section className={`credentials-panel signup ${isRegister ? 'active' : ''}`} aria-labelledby="signup-title">
        <h2 id="signup-title" className="slide-element">Register</h2>
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            onEnter();
          }}
          noValidate
        >
          <div className="field-wrapper slide-element">
            <input
              id="signup-username"
              type="text"
              required
              autoComplete="username"
              aria-label="Username"
            />
            <label htmlFor="signup-username">Username</label>
            <svg className="field-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M4 21c0-4 4-6 8-6s8 2 8 6" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>

          <div className="field-wrapper slide-element">
            <input
              id="signup-email"
              type="email"
              required
              autoComplete="email"
              aria-label="Email"
            />
            <label htmlFor="signup-email">Email</label>
            <svg className="field-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="m3 7 9 6 9-6" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>

          <div className="field-wrapper slide-element">
            <input
              id="signup-password"
              type="password"
              required
              autoComplete="new-password"
              aria-label="Password"
            />
            <label htmlFor="signup-password">Password</label>
            <svg className="field-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="15" r="2" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>

          <div className="field-wrapper slide-element">
            <button type="submit" className="submit-button">
              Register
            </button>
          </div>

          <div className="switch-link slide-element">
            <p>
              Already have an account?{' '}
              <a
                href="#"
                role="button"
                tabIndex={0}
                className="login-trigger"
                onClick={(e) => {
                  e.preventDefault();
                  setIsRegister(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsRegister(false);
                  }
                }}
              >
                Sign In
              </a>
            </p>
          </div>
        </form>
      </section>

      {/* Welcome section for signup */}
      <section className="welcome-section signup" aria-hidden="true">
        <h2 className="slide-element">WELCOME!</h2>
      </section>

      <footer className="footer">
        <p>
          <strong>Demo entry screen</strong> — this is not real authentication.
          Click <em>Sign In</em> or <em>Sign Up</em> to enter the application.
        </p>
      </footer>
    </div>
  );
}

export default AuthScreen;
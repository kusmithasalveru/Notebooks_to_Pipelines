/**
 * Application shell: sidebar navigation + main content area.
 *
 * Hash routing lives in App; Layout is a controlled shell that receives the
 * active hash and backend status as props.
 */
import React from 'react';

const NAV_ITEMS = [
  { hash: '#/studio', label: 'Studio', icon: 'play' },
  { hash: '#/runs', label: 'Run History', icon: 'list' },
  { hash: '#/compare', label: 'Comparison', icon: 'compare' },
];

function navigate(hash) {
  if (typeof window !== 'undefined') {
    window.location.hash = hash;
  }
}

function Layout({ children, currentHash, backendStatus }) {
  const activeHash = currentHash || '#/studio';

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="sidebar__brand">
          <span className="brand__mark" aria-hidden="true" />
          <span className="brand__name">Capstone</span>
        </div>

        <nav className="sidebar__nav" aria-label="Views">
          {NAV_ITEMS.map((item) => {
            const isActive = activeHash === item.hash;
            return (
              <a
                key={item.hash}
                href={item.hash}
                className={'nav-link' + (isActive ? ' nav-link--active' : '')}
                aria-current={isActive ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(item.hash);
                }}
              >
                <svg className="nav-link__icon" viewBox="0 0 24 24" aria-hidden="true">
                  {renderNavIcon(item.icon)}
                </svg>
                <span className="nav-link__label">{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <span className="backend-status" aria-live="polite">
            Backend: {backendStatus || 'checking…'}
          </span>
        </div>
      </aside>

      <main className="main-content" role="main">
        {children}
      </main>
    </div>
  );
}

function renderNavIcon(name) {
  switch (name) {
    case 'play':
      return (
        <>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M10 8l6 4-6 4V8z" fill="currentColor" />
        </>
      );
    case 'list':
      return (
        <>
          <circle cx="8" cy="7" r="1.5" fill="currentColor" />
          <circle cx="8" cy="12" r="1.5" fill="currentColor" />
          <circle cx="8" cy="17" r="1.5" fill="currentColor" />
          <path d="M12 7h9M12 12h9M12 17h9" stroke="currentColor" strokeWidth="2" />
        </>
      );
    case 'compare':
      return (
        <>
          <path d="M9 3h6v18H9z" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M15 3h6v18h-6z" fill="none" stroke="currentColor" strokeWidth="2" />
        </>
      );
    default:
      return null;
  }
}

export default Layout;
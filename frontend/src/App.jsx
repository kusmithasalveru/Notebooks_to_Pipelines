import React, { useState, useEffect, useCallback } from 'react';
import { health } from './api';
import LoadingScreen from './components/LoadingScreen.jsx';
import WelcomeScreen from './components/WelcomeScreen.jsx';
import Layout from './components/Layout.jsx';
import Studio from './components/Studio.jsx';
import RunHistory from './components/RunHistory.jsx';
import RunDetails from './components/RunDetails.jsx';
import Comparison from './components/Comparison.jsx';
import './styles/styles.css';

function App() {
  const [phase, setPhase] = useState('loading'); // loading | welcome | app
  const [backendStatus, setBackendStatus] = useState('checking…');
  const [currentHash, setCurrentHash] = useState(
    typeof window !== 'undefined' && window.location.hash
      ? window.location.hash
      : '#/studio'
  );

  const handleWelcomeEnter = useCallback(() => {
    setPhase('app');
  }, []);

  const handleLoadingComplete = useCallback(() => {
    setPhase('welcome');
  }, []);

  // Check backend health for status display
  useEffect(() => {
    let cancelled = false;
    health()
      .then((data) => {
        if (!cancelled) setBackendStatus('online (' + data.status + ')');
      })
      .catch((err) => {
        if (!cancelled) setBackendStatus('offline: ' + err.message);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onHashChange = () => setCurrentHash(window.location.hash || '#/studio');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Phase 1: Loading Screen
  if (phase === 'loading') {
    return <LoadingScreen onComplete={handleLoadingComplete} />;
  }

  // Phase 2: Welcome Screen
  if (phase === 'welcome') {
    return <WelcomeScreen onEnter={handleWelcomeEnter} />;
  }

  // Phase 3: Main Application
  let view;
  if (currentHash === '#/runs') {
    view = <RunHistory />;
  } else if (currentHash === '#/compare') {
    view = <Comparison />;
  } else if (currentHash.startsWith('#/details/')) {
    view = <RunDetails />;
  } else {
    view = <Studio />;
  }

  return (
    <Layout currentHash={currentHash} backendStatus={backendStatus}>
      {view}
    </Layout>
  );
}

export default App;
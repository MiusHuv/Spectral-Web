import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from '../context/AppContext';
import { CartProvider } from '../contexts/CartContext';
import HomePage from './pages/NewHomePage';
import ComponentsDemo from './pages/ComponentsDemo';
import MeteoritesPageReal from './pages/MeteoritesPageReal';
import AsteroidsPageReal from './pages/AsteroidsPageReal';
import AsteroidDetailPage from './pages/AsteroidDetailPage';
import AsteroidObservationsPage from './pages/AsteroidObservationsPage';
import SpectrumViewerPage from './pages/SpectrumViewerPage';
import ComparePage from './pages/ComparePage';
import EnhancedErrorBoundary from './common/EnhancedErrorBoundary';
import ApiConnectionTest from './debug/ApiConnectionTest';
import CacheMonitor from './debug/CacheMonitor';
import SpectralDiagnostics from './debug/SpectralDiagnostics';
import './App.css';

const App: React.FC = () => {
  const [showCacheMonitor, setShowCacheMonitor] = useState(false);
  const [showSpectralDiagnostics, setShowSpectralDiagnostics] = useState(false);
  const [debugUiEnabled] = useState(() => {
    if (import.meta.env.VITE_SHOW_DEBUG_UI === 'true') {
      return true;
    }

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('debug') === 'true') {
        return true;
      }
    }

    return false;
  });

  // Add keyboard shortcuts for debug panels
  React.useEffect(() => {
    if (!debugUiEnabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey) {
        switch (event.key) {
          case 'C':
            event.preventDefault();
            setShowCacheMonitor(true);
            break;
          case 'D':
            event.preventDefault();
            setShowSpectralDiagnostics(true);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [debugUiEnabled]);

  return (
    <EnhancedErrorBoundary
      showDiagnostics={debugUiEnabled}
      enableLogging={true}
      onError={(error, errorInfo, context) => {
        console.error('Application Error:', { error, errorInfo, context });
      }}
    >
      <AppProvider>
        <CartProvider>
          <Router>
            <div className="app">
              {debugUiEnabled && <ApiConnectionTest />}
              {debugUiEnabled && (
                <CacheMonitor
                  isVisible={showCacheMonitor}
                  onClose={() => setShowCacheMonitor(false)}
                />
              )}
              {debugUiEnabled && (
                <SpectralDiagnostics
                  isVisible={showSpectralDiagnostics}
                  onClose={() => setShowSpectralDiagnostics(false)}
                />
              )}
              <Routes>
                {/* Main pages */}
                <Route path="/" element={<HomePage />} />
                <Route path="/demo" element={<ComponentsDemo />} />
                <Route path="/meteorites" element={<MeteoritesPageReal />} />
                <Route path="/asteroids" element={<AsteroidsPageReal />} />
                <Route path="/asteroids/:asteroidId" element={<AsteroidDetailPage />} />
                <Route path="/asteroids/:asteroidId/observations" element={<AsteroidObservationsPage />} />
                <Route path="/spectrum-viewer" element={<SpectrumViewerPage />} />
                <Route path="/compare" element={<ComparePage />} />
              </Routes>
            </div>
          </Router>
        </CartProvider>
      </AppProvider>
    </EnhancedErrorBoundary>
  );
};

export default App;

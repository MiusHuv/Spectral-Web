import React from 'react';
import { useAppContext } from '../../context/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import TaxonomyTree from '../taxonomy/TaxonomyTree';
import SimpleSpectralChart from '../spectral/SimpleSpectralChart';
import PropertiesPanel from '../properties/PropertiesPanel';
import './HomePage.css';

const HomePage: React.FC = () => {
  const { state } = useAppContext();

  if (state.loading) {
    return <LoadingSpinner message="Loading application..." />;
  }

  if (state.error) {
    return <ErrorMessage message={state.error} />;
  }

  // Helper function to get proper asteroid name
  const getAsteroidDisplayName = (asteroid: any): string => {
    if (asteroid?.proper_name) {
      return asteroid.proper_name;
    }
    if (asteroid?.official_number) {
      return `(${asteroid.official_number})`;
    }
    return `小行星 ${asteroid?.id || 'Unknown'}`;
  };

  return (
    <div className="home-page">
      {/* Clean Apple-style Layout */}
      <div className="app-container">
        {/* Left Sidebar - Classification */}
        <div className="sidebar">
          <div className="sidebar-header">
            <h2>Asteroids</h2>
            <p>Select to analyze</p>
          </div>
          <TaxonomyTree />
        </div>

        {/* Main Content Area */}
        <div className="main-content">
          {state.selectedAsteroids.length > 0 ? (
            <>
              {/* Clean Selection Bar */}
              <div className="selection-bar">
                <div className="selection-info">
                  <span className="count">{state.selectedAsteroids.length}</span>
                  <span className="label">selected</span>
                </div>
                <div className="selected-items">
                  {state.selectedAsteroids.slice(0, 2).map(id => {
                    const asteroid = state.asteroidData[id];
                    return (
                      <span key={id} className="item-chip">
                        {getAsteroidDisplayName(asteroid)}
                      </span>
                    );
                  })}
                  {state.selectedAsteroids.length > 2 && (
                    <span className="more-chip">+{state.selectedAsteroids.length - 2}</span>
                  )}
                </div>
              </div>

              {/* Main Visualization */}
              <div className="visualization-grid">
                <div className="chart-section">
                  <SimpleSpectralChart 
                    selectedAsteroids={state.selectedAsteroids}
                    asteroidData={state.asteroidData}
                  />
                </div>
                
                <div className="details-section">
                  <div className="details-container">
                    <div className="details-scroll-area">
                      <PropertiesPanel />
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-content">
                <div className="empty-graphic">
                  <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                    <circle cx="60" cy="60" r="50" stroke="#E5E7EB" strokeWidth="2" strokeDasharray="8 8"/>
                    <circle cx="60" cy="60" r="8" fill="#9CA3AF"/>
                    <circle cx="35" cy="45" r="4" fill="#D1D5DB"/>
                    <circle cx="85" cy="35" r="3" fill="#D1D5DB"/>
                    <circle cx="80" cy="80" r="5" fill="#D1D5DB"/>
                  </svg>
                </div>
                <h3>Select asteroids to begin</h3>
                <p>Choose from the classification tree to view spectral data and properties</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomePage;

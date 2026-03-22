import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CartIndicator from '../common/CartIndicator';
import './NewHomePage.css';

interface AsteroidStats {
  total_asteroids: number;
  total_observations: number;
  bus_demeo_classes: number;
  tholen_classes: number;
}

const NewHomePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [asteroidStats, setAsteroidStats] = useState<AsteroidStats | null>(null);

  useEffect(() => {
    // Load asteroid stats
    fetch('/api/v2/asteroids/stats')
      .then(res => res.json())
      .then(data => setAsteroidStats(data.stats))
      .catch(err => console.error('Failed to load asteroid stats:', err));
  }, []);

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    // Try to determine if it's a number (asteroid) or name (could be either)
    const isNumber = /^\d+$/.test(query);
    
    if (isNumber) {
      // Likely an asteroid number, go to asteroids page with search
      navigate(`/asteroids?search=${encodeURIComponent(query)}`);
    } else {
      // Could be meteorite name or asteroid name/classification
      // Try both APIs to see which has results
      try {
        const [meteoriteRes, asteroidRes] = await Promise.all([
          fetch(`/api/meteorites?search=${encodeURIComponent(query)}&page=1&page_size=1`),
          fetch(`/api/v2/asteroids?search=${encodeURIComponent(query)}&page=1&page_size=1`)
        ]);

        const meteoriteData = await meteoriteRes.json();
        const asteroidData = await asteroidRes.json();

        const meteoriteCount = meteoriteData.pagination?.total || 0;
        const asteroidCount = asteroidData.pagination?.total || 0;

        // Navigate to the page with more results, or meteorites if tied
        if (asteroidCount > meteoriteCount) {
          navigate(`/asteroids?search=${encodeURIComponent(query)}`);
        } else if (meteoriteCount > 0) {
          navigate(`/meteorites?search=${encodeURIComponent(query)}`);
        } else {
          // No results, default to asteroids page with search
          navigate(`/asteroids?search=${encodeURIComponent(query)}`);
        }
      } catch (err) {
        console.error('Search error:', err);
        // Fallback to asteroids page
        navigate(`/asteroids?search=${encodeURIComponent(query)}`);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="new-home-page">
      {/* Header */}
      <div className="home-header">
        <div className="home-header-content">
          <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
            <CartIndicator />
          </div>
          <h1 className="home-title">Asteroid & Meteorite Spectral Database</h1>
          <p className="home-subtitle">
            Professional spectral data library for asteroids and meteorites
          </p>
        </div>
      </div>

      {/* Search Section */}
      <div className="home-search-section">
        <div className="search-box">
          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder="Search by name, number, or classification..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <button className="search-btn" onClick={handleSearch}>
              Search
            </button>
          </div>
          <p className="search-hint">
            Try searching for "Ceres", "Carbonaceous Chondrite", or "S-type"
          </p>
        </div>
      </div>

      {/* Data Cards */}
      <div className="home-cards-section">
        <div className="cards-grid">
          {/* Meteorite Card */}
          <div className="data-card" onClick={() => navigate('/meteorites')}>
            <div className="card-icon">🪨</div>
            <h2 className="card-title">Meteorite Data</h2>
            <p className="card-description">
              Browse spectral data from thousands of meteorite specimens with detailed
              classification and spectral information
            </p>
            <div className="card-stats">
              <div className="stat-item">
                <div className="stat-value">38,625</div>
                <div className="stat-label">Specimens</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">Multiple</div>
                <div className="stat-label">Types</div>
              </div>
            </div>
            <button 
              className="card-action"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/meteorites');
              }}
            >
              Browse Meteorites
            </button>
          </div>

          {/* Asteroid Card */}
          <div className="data-card" onClick={() => navigate('/asteroids')}>
            <div className="card-icon">🌌</div>
            <h2 className="card-title">Asteroid Data</h2>
            <p className="card-description">
              Explore asteroids with complete orbital parameters,
              physical properties, and spectral observations
            </p>
            <div className="card-stats">
              <div className="stat-item">
                <div className="stat-value">{asteroidStats?.total_asteroids?.toLocaleString() || 'Loading...'}</div>
                <div className="stat-label">Asteroids</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{asteroidStats?.total_observations?.toLocaleString() || 'Loading...'}</div>
                <div className="stat-label">Observations</div>
              </div>
            </div>
            <button 
              className="card-action"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/asteroids');
              }}
            >
              Browse Asteroids
            </button>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="home-quick-links">
        <h3 className="quick-links-title">Quick Links</h3>
        <div className="quick-links-grid">
          <a href="/meteorites?main_label=Carbonaceous%20Chondrite" className="quick-link-card">
            <div className="quick-link-title">Carbonaceous Chondrite</div>
            <div className="quick-link-description">
              728 meteorite specimens
            </div>
          </a>

          <a href="/asteroids?bus_demeo_class=S" className="quick-link-card">
            <div className="quick-link-title">S-type Asteroids</div>
            <div className="quick-link-description">
              413 silicaceous asteroids
            </div>
          </a>

          <a href="/asteroids?bus_demeo_class=C" className="quick-link-card">
            <div className="quick-link-title">C-type Asteroids</div>
            <div className="quick-link-description">
              127 carbonaceous asteroids
            </div>
          </a>

          <a href="/meteorites?main_label=Achondrites" className="quick-link-card">
            <div className="quick-link-title">Achondrites</div>
            <div className="quick-link-description">
              683 meteorite specimens
            </div>
          </a>
        </div>
      </div>
    </div>
  );
};

export default NewHomePage;

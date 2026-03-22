import React from 'react';
import './Header.css';

const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="header-content">
        <h1 className="header-title">Asteroid Spectral Visualization</h1>
        <p className="header-subtitle">
          Explore asteroid taxonomic classifications and spectral data
        </p>
      </div>
    </header>
  );
};

export default Header;
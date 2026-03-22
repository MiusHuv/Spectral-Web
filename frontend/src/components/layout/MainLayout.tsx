import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import './MainLayout.css';

const MainLayout: React.FC = () => {
  return (
    <div className="main-layout">
      <Header />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
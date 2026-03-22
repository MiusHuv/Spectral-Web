import React, { useState } from 'react';

const InteractionTest: React.FC = () => {
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [systemType, setSystemType] = useState<'bus_demeo' | 'tholen'>('bus_demeo');

  const mockItems = [
    { id: 1, name: 'Asteroid 1', classification: 'A' },
    { id: 2, name: 'Asteroid 2', classification: 'B' },
    { id: 3, name: 'Asteroid 3', classification: 'C' },
  ];

  const handleItemSelect = (id: number) => {
    console.log('Selecting item:', id);
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleSectionToggle = (section: string) => {
    console.log('Toggling section:', section);
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const handleSystemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    console.log('System changed:', e.target.value);
    setSystemType(e.target.value as 'bus_demeo' | 'tholen');
  };

  const handleClearAll = () => {
    console.log('Clearing all selections');
    setSelectedItems([]);
  };

  return (
    <div style={{ 
      padding: '20px', 
      border: '2px solid #28a745', 
      borderRadius: '8px', 
      margin: '20px',
      backgroundColor: '#f8f9fa',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h3>Interaction Test Component</h3>
      
      {/* System Selector */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="system-select" style={{ marginRight: '10px' }}>
          Classification System:
        </label>
        <select 
          id="system-select"
          value={systemType} 
          onChange={handleSystemChange}
          style={{
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        >
          <option value="bus_demeo">Bus-DeMeo</option>
          <option value="tholen">Tholen</option>
        </select>
        <span style={{ marginLeft: '10px', color: '#666' }}>
          Current: {systemType}
        </span>
      </div>

      {/* Selection Info */}
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
        <strong>Selected Items: {selectedItems.length}</strong>
        {selectedItems.length > 0 && (
          <button 
            onClick={handleClearAll}
            style={{
              marginLeft: '10px',
              padding: '4px 8px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Expandable Section */}
      <div style={{ marginBottom: '20px' }}>
        <div 
          onClick={() => handleSectionToggle('test-section')}
          style={{
            padding: '12px',
            backgroundColor: '#007bff',
            color: 'white',
            borderRadius: '4px',
            cursor: 'pointer',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span style={{ 
            transform: expandedSections.includes('test-section') ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}>
            ▶
          </span>
          Test Section (Click to expand)
        </div>
        
        {expandedSections.includes('test-section') && (
          <div style={{ 
            marginTop: '10px', 
            padding: '15px', 
            border: '1px solid #ddd', 
            borderRadius: '4px',
            backgroundColor: 'white'
          }}>
            <h4>Mock Asteroids</h4>
            {mockItems.map(item => (
              <div key={item.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                padding: '8px',
                marginBottom: '5px',
                backgroundColor: selectedItems.includes(item.id) ? '#e3f2fd' : 'transparent',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={selectedItems.includes(item.id)}
                  onChange={() => handleItemSelect(item.id)}
                  style={{ cursor: 'pointer' }}
                />
                <span>{item.name} ({item.classification})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Debug Info */}
      <div style={{ 
        padding: '10px', 
        backgroundColor: '#fff3cd', 
        border: '1px solid #ffeaa7',
        borderRadius: '4px',
        fontSize: '12px'
      }}>
        <strong>Debug Info:</strong><br />
        Selected IDs: [{selectedItems.join(', ')}]<br />
        Expanded Sections: [{expandedSections.join(', ')}]<br />
        System: {systemType}
      </div>
    </div>
  );
};

export default InteractionTest;
import React, { useState, useEffect } from 'react';

const ApiConnectionTest: React.FC = () => {
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (message: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testConnection = async () => {
    setLoading(true);
    setResults([]);
    
    try {
      // Test 1: Basic fetch to backend health
      addResult('Testing backend health...');
      const healthResponse = await fetch('/health');
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        addResult(`✓ Backend health: ${healthData.status}`);
      } else {
        addResult(`✗ Backend health failed: ${healthResponse.status}`);
      }

      // Test 2: Test classifications API
      addResult('Testing classifications API...');
      const classResponse = await fetch('/api/classifications');
      if (classResponse.ok) {
        const classData = await classResponse.json();
        addResult(`✓ Classifications API: ${classData.systems.length} systems`);
      } else {
        addResult(`✗ Classifications API failed: ${classResponse.status}`);
      }

      // Test 3: Test Bus-DeMeo asteroids
      addResult('Testing Bus-DeMeo asteroids...');
      const asteroidsResponse = await fetch('/api/classifications/bus_demeo/asteroids?limit=5');
      if (asteroidsResponse.ok) {
        const asteroidsData = await asteroidsResponse.json();
        addResult(`✓ Bus-DeMeo asteroids: ${asteroidsData.classes.length} classes`);
        
        if (asteroidsData.classes.length > 0) {
          const firstClass = asteroidsData.classes[0];
          addResult(`  First class: ${firstClass.name} with ${firstClass.asteroids.length} asteroids`);
          
          if (firstClass.asteroids.length > 0) {
            const firstAsteroid = firstClass.asteroids[0];
            addResult(`  First asteroid: ${firstAsteroid.display_name} (ID: ${firstAsteroid.id})`);
          }
        }
      } else {
        addResult(`✗ Bus-DeMeo asteroids failed: ${asteroidsResponse.status}`);
      }

    } catch (error) {
      addResult(`✗ Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      width: '400px', 
      background: 'white', 
      border: '1px solid #ccc', 
      borderRadius: '8px', 
      padding: '16px',
      zIndex: 9999,
      maxHeight: '500px',
      overflow: 'auto',
      fontSize: '12px',
      fontFamily: 'monospace'
    }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>API Connection Test</h3>
      
      <button 
        onClick={testConnection} 
        disabled={loading}
        style={{
          marginBottom: '10px',
          padding: '5px 10px',
          background: loading ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Testing...' : 'Test Connection'}
      </button>

      <div style={{ 
        background: '#f8f9fa', 
        padding: '10px', 
        borderRadius: '4px',
        maxHeight: '300px',
        overflow: 'auto'
      }}>
        {results.length === 0 ? (
          <div>No results yet...</div>
        ) : (
          results.map((result, index) => (
            <div key={index} style={{ 
              marginBottom: '4px',
              color: result.includes('✓') ? 'green' : result.includes('✗') ? 'red' : 'black'
            }}>
              {result}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ApiConnectionTest;
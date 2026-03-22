import React, { useState } from 'react';

const ButtonTest: React.FC = () => {
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState('');

  const handleClick = () => {
    setCount(prev => prev + 1);
    setMessage(`Button clicked ${count + 1} times`);
    console.log('Button clicked!', count + 1);
  };

  const handleReset = () => {
    setCount(0);
    setMessage('Reset!');
    console.log('Reset clicked!');
  };

  return (
    <div style={{ 
      padding: '20px', 
      border: '2px solid #007bff', 
      borderRadius: '8px', 
      margin: '20px',
      backgroundColor: '#f8f9fa'
    }}>
      <h3>Button Test Component</h3>
      <p>Count: {count}</p>
      <p>Message: {message}</p>
      
      <button 
        onClick={handleClick}
        style={{
          padding: '10px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginRight: '10px',
          fontSize: '16px'
        }}
      >
        Click Me
      </button>
      
      <button 
        onClick={handleReset}
        style={{
          padding: '10px 20px',
          backgroundColor: '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        Reset
      </button>
    </div>
  );
};

export default ButtonTest;
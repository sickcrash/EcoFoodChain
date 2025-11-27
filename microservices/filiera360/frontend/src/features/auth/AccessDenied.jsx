import React from 'react';
import { useNavigate } from 'react-router-dom';

const AccessDenied = () => {
  const navigate = useNavigate();

  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <h2>Access Denied</h2>
      <p>You do not have permission to access this page.</p>
      <button
        className="btn btn-primary"
        onClick={() => navigate('/')}
      >
        Return to Home
      </button>
    </div>
  );
};

export default AccessDenied;

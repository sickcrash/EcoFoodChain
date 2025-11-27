import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ allowedRoles, children }) => {
  const userRole = localStorage.getItem('role');
  const location = useLocation();

  if (location.pathname === '/scan-product') {
    return children;
  }

  if (!userRole || !allowedRoles.includes(userRole)) {
    return (
      <Navigate
        to="/access-denied"
        replace
      />
    );
  }

  return children;
};

export default ProtectedRoute;

import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from '../features/auth/Login';
import SignUp from '../features/auth/SignUp';
import Account from '../features/account/Account';
// import AddProduct from '../features/products/AddProduct';
import ScanProduct from '../features/products/ScanProduct';
import Navbar from '../components/layout/Navbar';
import ForgotPassword from '../features/auth/ForgotPassword';
import About from '../pages/About';
import ResetPassword from '../features/auth/ResetPassword';
import AccessDenied from '../features/auth/AccessDenied';
import ProtectedRoute from '../features/auth/ProtectedRoute';
import ChangePassword from '../features/auth/ChangePassword';
import AddProduct from "../features/products/addProduct/AddProduct";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  return (
    <Router basename={process.env.PUBLIC_URL}>
      <Navbar />

      <Routes>
        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />
        <Route
          path="/about"
          element={<About />}
        />
        <Route
          path="/reset-password/:token"
          element={<ResetPassword />}
        />
        <Route
          path="/login"
          element={isLoggedIn ? <Navigate to="/add-product" /> : <Login setIsLoggedIn={setIsLoggedIn} />}
        />
        <Route
          path="/signup"
          element={isLoggedIn ? <Navigate to="/add-product" /> : <SignUp />}
        />
        <Route
          path="/add-product"
          element={
            isLoggedIn ? (
              <ProtectedRoute allowedRoles={['producer', 'operator']}>
                <AddProduct />
              </ProtectedRoute>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/scan-product"
          element={<ScanProduct />}
        />
        <Route
          path="/scan-product/:id"
          element={<ScanProduct />}
        />
        <Route
          path="/account"
          element={isLoggedIn ? <Account setIsLoggedIn={setIsLoggedIn} /> : <Navigate to="/login" />}
        />
        <Route
          path="/"
          element={<Navigate to={isLoggedIn ? '/add-product' : '/login'} />}
        />
        <Route
          path="/access-denied"
          element={<AccessDenied />}
        />
        <Route
          path="/change-password"
          element={<ChangePassword />}
        />
      </Routes>
    </Router>
  );
}

export default App;

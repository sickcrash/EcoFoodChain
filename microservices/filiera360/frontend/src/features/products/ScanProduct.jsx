// ScanProduct.js
import React, { useEffect, useState } from 'react';
import DataSensors from './components/DataSensors';
import Certifications from '../products/components/Certifications';
// import ProductMovements from './components/ProductMovements';
import { useNavigate } from 'react-router-dom';
import ProductList from "./productList/ProductList";

function ScanProduct() {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  return (
    <div className="container mt-4">
      {!isLoggedIn && (
        <>
          {/* Logo a sinistra */}
          <div
            style={{
              position: 'relative',
            }}
          >
            <img
              src={require('../../assets/logo_filiera360.png')}
              style={{
                width: '8vw',
              }}
            />
          </div>
          <p
            className="mt-3"
            style={{ marginBottom: '-2vw', color: 'grey' }}
          >
            👤 Already have an account?{' '}
            <span
              onClick={() => navigate('/login')}
              style={{ color: 'blue', cursor: 'pointer' }}
            >
              Login
            </span>
          </p>
        </>
      )}
      <ProductList
        onProductSelect={setSelectedProduct}
        onBatchSelect={setSelectedBatch}
      />
      {selectedProduct && (
        <div
          className="mt-4"
          id="customForm"
        >
          {/*<DataSensors productId={selectedProduct} />
          <ProductMovements productId={selectedProduct} />*/}
          <Certifications productId={selectedProduct} />
        </div>
      )}
      <br />
      <br />
      {selectedProduct ? (
        <p
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{ fontSize: '1vw', textDecoration: 'underline', cursor: 'pointer' }}
        >
          ☝️ back to top
        </p>
      ) : null}
      <br />
      <br />
    </div>
  );
}

export default ScanProduct;

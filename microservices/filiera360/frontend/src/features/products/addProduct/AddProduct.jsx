import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Components
import ProductForm from './components/ProductForm';
import BatchForm from './components/BatchForm';
import RecentlyScanned from './components/RecentlyScanned'; // djhjsjssjddj

const AddProduct = () => {
  const navigate = useNavigate();
  const [manufacturer, setManufacturer] = useState('');
  const [operator, setOperator] = useState('');
  const [role, setRole] = useState('');
  const [viewProduct, setViewProduct] = useState(false);
  const [viewBatch, setViewBatch] = useState(false);

  useEffect(() => {
    const manufacturer = localStorage.getItem('manufacturer') || '';
    const role = localStorage.getItem('role');

    if (role !== 'producer' && role !== 'operator') {
      navigate('/access-denied');
    }

    setManufacturer(manufacturer);
    setRole(role || '');
    setOperator(manufacturer); // Da sostituire con altro gruppo in futuro
  }, []);

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          {role === 'producer' && (
            <ProductForm
              manufacturer={manufacturer}
              viewProduct={viewProduct}
              setViewProduct={setViewProduct}
              setViewBatch={setViewBatch}
            />
          )}
          <br />
          {(role === 'producer' || role === 'operator') && (

            <div>
              <BatchForm
                operator={manufacturer}
                viewBatch={viewBatch}
                setViewBatch={setViewBatch}
                setViewProduct={setViewProduct}
              />
              <br />
            </div>
          )}
        </div>
      </div>
      <RecentlyScanned />
    </div>
  );
};

export default AddProduct;

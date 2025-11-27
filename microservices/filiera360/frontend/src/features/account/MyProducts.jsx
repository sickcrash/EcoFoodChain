import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';


const MyProducts = ({ onProductsSelect }) => {
  const [manufacturer, setManufacturer] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [products, setProducts] = useState([]);
  const [message, setMessage] = useState('');
  const [visibleCount, setVisibleCount] = useState(3); // Mostra inizialmente 3
  const navigate = useNavigate();




  // ✅ Recupera manufacturer da localStorage o altro metodo
  useEffect(() => {
    const storedManufacturer = localStorage.getItem('manufacturer'); // o sessionStorage, o dal JWT decodificato, ecc.
    if (storedManufacturer) {
      setManufacturer(storedManufacturer);
    } else {
      setMessage('Manufacturer not found');
    }
  }, []);



  // ✅ Chiama l’API quando manufacturer è disponibile
  useEffect(() => {
    if (manufacturer) {
      handleSearchProduct();
    }
  }, [manufacturer]);
  const handleSearchProduct = async () => {
    try {
      const response = await axios.get(
        `api/getProductsByManufacturer?manufacturer=${manufacturer}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200) {
        const data = response.data;
        console.log('📦 Dati ricevuti:', data);

        const productsData = Array.isArray(data)
          ? data
          : typeof data === 'string'
            ? JSON.parse(data)
            : [];

        setProducts(productsData);

        if (productsData.length === 0) {
          setMessage('No products found for this manufacturer');
        } else {
          setMessage('');
          if (onProductsSelect) onProductsSelect(manufacturer);
        }
      } else {
        setProducts([]);
        setMessage('No products found for this manufacturer');
      }
    } catch (error) {
      console.error('Errore durante la ricerca:', error);
      setProducts([]);
      setMessage('There are currently no products available.');
    }
  };


  return (
    <div className="search-product-container">

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center', // centro orizzontale
          alignItems: 'flex-start',     // centro verticale
          width: '100%',       // altezza minima per centrare verticalmente
          gap: '20px',
          padding: '20px'
        }}
      >
        {products.slice(0, visibleCount).map((product, index) => (
          <div
            key={index}
            style={{
              border: '1px solid #ccc',
              padding: '10px',
              width: '280px',
              borderRadius: '8px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              backgroundColor: '#fff',
              margin: '0 auto'
            }}
          >
            <h3>{product.Name}</h3>
            <p><strong>Id:</strong> {product.ID}</p>
            <p><strong>Expiry Date:</strong> {product.ExpiryDate}</p>
            <p><strong>Ingredients:</strong> {product.Ingredients}</p>

            <button
              className="btn btn-sm btn-outline-primary"
              onClick={() => {
                setItemCode(product.ID);
                try {
                  document.getElementById("itemCode").value = product.ID;
                } catch { }
                window.scrollTo({ top: 0, behavior: 'smooth' });
                navigate('/scan-product');
              }}
            >
              View Details
            </button>
          </div>
        ))}
      </div>
      {visibleCount < products.length && (
        <button
          className="btn btn-secondary mt-3"
          onClick={() => setVisibleCount(prev => prev + 5)} // Mostra altri 3
        >
          Load More
        </button>
      )}



      {message && (
        <p
          style={{
            color: message === 'There are currently no products available.' ? 'black' : 'red',
            textAlign: 'center',
            marginTop: '0px'
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default MyProducts;
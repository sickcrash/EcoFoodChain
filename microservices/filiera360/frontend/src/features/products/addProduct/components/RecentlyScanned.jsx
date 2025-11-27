import React, { useEffect, useState } from 'react';
import { Card, Row, Col } from 'react-bootstrap';
import { fetchRecentlySearched } from '../../../../services/productService';

const RecentlyScanned = ({ products, onProductClick, showQRCode = true }) => {
  const [recentlyScanned, setRecentlyScanned] = useState(() => {
    // Load recently scanned products from localStorage
    const savedScanned = localStorage.getItem('recentlyScannedProducts');
    return savedScanned ? JSON.parse(savedScanned) : [];
  });

  useEffect(() => {
    const loadRecentlySearched = async () => {
      try {
        const userId = localStorage.getItem('email') || 'default';
        const data = await fetchRecentlySearched(userId);
        setRecentlyScanned(data);
      } catch (error) {}
    };

    loadRecentlySearched();
  }, []);

  if (!recentlyScanned.length) return null;

  return (
    <div className="row mt-4 mb-4">
      <div className="col-12">
        <p style={{ fontWeight: 'bold' }}>Recent uploads/scans 🕒</p>
        <Row
          xs={1}
          md={2}
          lg={3}
          className="g-4"
        >
          {recentlyScanned.map((scannedProduct) => (
            <Col key={scannedProduct.ID}>
              <Card className="h-100 shadow-sm">
                <Card.Body>
                  <Card.Title>{scannedProduct.Name}</Card.Title>
                  <Card.Text>
                    <small className="text-muted">ID: {scannedProduct.ID}</small>
                    <br />
                    <small className="text-muted">Manufacturer: {scannedProduct.Manufacturer}</small>
                    <br />
                    <small className="text-muted">Created: {scannedProduct.CreationDate}</small>
                  </Card.Text>
                  <div className="d-flex justify-content-between align-items-center">
                    <small className="text-muted">{new Date(scannedProduct.timestamp).toLocaleDateString()}</small>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
};

export default RecentlyScanned;

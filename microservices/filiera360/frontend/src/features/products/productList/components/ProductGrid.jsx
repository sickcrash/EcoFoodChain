import React from 'react';
import { Card, Row, Col } from 'react-bootstrap';

const ProductGrid = ({
                         products,
                         title,
                         onProductSelect,
                         onRemoveProduct = null,
                         showRemoveButton = false
                     }) => {
    if (products.length === 0) return null;

    return (
        <div className="row mt-4 mb-4">
            <div className="col-12">
                <p style={{ fontWeight: 'bold' }}>{title}</p>
                <Row xs={1} md={2} lg={3} className="g-4">
                    {products.map((product) => (
                        <Col key={product.ID}>
                            <Card className="h-100 shadow-sm">
                                <Card.Body>
                                    <Card.Title>{product.Name}</Card.Title>
                                    <Card.Text>
                                        <small className="text-muted">ID: {product.ID}</small>
                                        <br />
                                        <small className="text-muted">Manufacturer: {product.Manufacturer}</small>
                                        <br />
                                        <small className="text-muted">Created: {product.CreationDate}</small>
                                    </Card.Text>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <button
                                            className="btn btn-sm btn-outline-primary"
                                            onClick={() => onProductSelect(product)}
                                        >
                                            View Details
                                        </button>
                                        {showRemoveButton && (
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => onRemoveProduct(product.ID)}
                                            >
                                                <ion-icon name="heart-dislike-outline"></ion-icon>
                                            </button>
                                        )}
                                        {!showRemoveButton && product.timestamp && (
                                            <small className="text-muted">
                                                {new Date(product.timestamp).toLocaleDateString()}
                                            </small>
                                        )}
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

export default ProductGrid;
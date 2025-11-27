import React from 'react';
import { Table } from 'react-bootstrap';
import { QRCodeCanvas } from 'qrcode.react';
import Viewer3D from '../../Viewer3D';
import DataSensors from '../../components/DataSensors';
import { getLastUpdate, getFirstUpdate } from '../../../../utils/dateUtils';

const ProductDetails = ({
  product,
  productHistory,
  itemCode,
  glbFile,
  liked,
  onLikeToggle,
  onDownloadHistory
}) => {
  return (
    <div className="row justify-content-center mt-5">
      <div className="col-md-8">
        <div className="card shadow">
          <div className="card-body">
            <h4 className="card-title">General Information ℹ️</h4>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div></div>
              <button
                className={`btn ${liked ? 'btn-danger' : 'btn-outline-danger'}`}
                onClick={onLikeToggle}
                title={liked ? 'Unlike this product' : 'Like this product'}
              >
                <ion-icon name={liked ? 'heart' : 'heart-outline'}></ion-icon>
                {liked ? ' Liked' : ' Like'}
              </button>
            </div>
            
            {glbFile ? (
              <div style={{ marginBlock: '2vw' }}>
                <Viewer3D externalGlbFile={glbFile} />
              </div>
            ) : (
              <p style={{ color: 'grey' }}>no 3D preview available</p>
            )}
            
            <Table striped bordered hover>
              <tbody>
                {product.Name && (
                  <tr><th>Name</th><td>{product.Name}</td></tr>
                )}
                {product.ID && (
                  <tr><th>ID</th><td>{product.ID}</td></tr>
                )}
                {product.Manufacturer && (
                  <tr><th>Manufacturer</th><td>{product.Manufacturer}</td></tr>
                )}
                {product.SowingDate && (
                  <tr><th>Sowing Date</th><td>{product.SowingDate}</td></tr>
                )}
                {product.HarvestDate && (
                  <tr><th>Harvest Date</th><td>{product.HarvestDate}</td></tr>
                )}
                {product.Ingredients && (
                  <tr><th>Ingredients</th><td>{product.Ingredients}</td></tr>
                )}
                {product.Nutritional_information && (
                  <tr><th>Nutritional Information</th><td>{product.Nutritional_information}</td></tr>
                )}
                {product.Allergens && (
                  <tr><th>Allergens</th><td>{product.Allergens}</td></tr>
                )}
                {product.PesticideUse && (
                  <tr><th>Pesticide Use</th><td>{product.PesticideUse}</td></tr>
                )}
                {product.FertilizerUse && (
                  <tr><th>Fertilizer Use</th><td>{product.FertilizerUse}</td></tr>
                )}
                {product.CountryOfOrigin && (
                  <tr><th>Country Of Origin</th><td>{product.CountryOfOrigin}</td></tr>
                )}
                {product.CustomObject && Object.entries(product.CustomObject).map(([key, value]) => (
                  <tr key={key}><th>{key}</th><td>{value}</td></tr>
                ))}
                <tr><th>N. Updates *</th><td>{productHistory.length}</td></tr>
                <tr><th>Last Date *</th><td>{getLastUpdate(productHistory) || 'No updates available'}</td></tr>
                <tr><th>First Update *</th><td>{getFirstUpdate(productHistory) || 'No updates available'}</td></tr>
              </tbody>
            </Table>
            
            <br />
            <DataSensors productId={product.ID} />
            <br /><br /><br />
            
            <QRCodeCanvas
              value={`${window.location.origin}/scan-product/${itemCode}`}
              style={{ marginBottom: '2vw' }}
            />
            
            <p>
              Note: The data marked with <b>(*)</b> is generated automatically by the server through the blockchain,
              ensuring transparency and reliability. These values are not provided by the manufacturer.
            </p>
            
            <button className="btn btn-primary mt-3" onClick={onDownloadHistory}>
              Click here to see all the product updates
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;
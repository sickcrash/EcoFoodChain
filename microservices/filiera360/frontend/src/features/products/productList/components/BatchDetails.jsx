import React from 'react';
import { Table } from 'react-bootstrap';
import { QRCodeCanvas } from 'qrcode.react';
import Viewer3D from '../../Viewer3D';
import DataSensors from '../../components/DataSensors';
import { getLastUpdate, getFirstUpdate } from '../../../../utils/dateUtils';

const BatchDetails = ({
                          batch,
                          batchProduct,
                          batchHistory,
                          itemCodeBatch,
                          glbFile,
                          onDownloadHistory
                      }) => {
    return (
        <div className="row justify-content-center mt-5">
            <div className="col-md-8">
                <div className="card shadow">
                    <div className="card-body">
                        <h4 className="card-title">General Information ℹ️</h4>
                        <Table striped bordered hover>
                            <tbody>
                            {batch.ID && <tr><th>ID</th><td>{batch.ID}</td></tr>}
                            {batch.ProductId && <tr><th>Product Id</th><td>{batch.ProductId}</td></tr>}
                            {batch.Operator && <tr><th>Operator</th><td>{batch.Operator}</td></tr>}
                            {batch.BatchNumber && <tr><th>Batch Number</th><td>{batch.BatchNumber}</td></tr>}
                            {batch.Quantity && <tr><th>Quantity</th><td>{batch.Quantity}</td></tr>}
                            {batch.ProductionDate && <tr><th>Production Date</th><td>{batch.ProductionDate}</td></tr>}
                            {batch.State && <tr><th>Status</th><td>{batch.State}</td></tr>}
                            {batch.CustomObject && Object.entries(batch.CustomObject).map(([key, value]) => (
                                <tr key={key}><th>{key}</th><td>{value}</td></tr>
                            ))}
                            <tr><th>N. Updates *</th><td>{batchHistory.length}</td></tr>
                            <tr><th>Last Date *</th><td>{getLastUpdate(batchHistory) || 'No updates available'}</td></tr>
                            <tr><th>First Update *</th><td>{getFirstUpdate(batchHistory) || 'No updates available'}</td></tr>
                            </tbody>
                        </Table>

                        <br />
                        <QRCodeCanvas
                            value={`${window.location.origin}/scan-product/${itemCodeBatch}`}
                            style={{ marginBottom: '2vw' }}
                        />

                        <p>
                            Note: The data marked with <b>(*)</b> is generated automatically by the server through the blockchain,
                            ensuring transparency and reliability. These values are not provided by the operator.
                        </p>

                        <button className="btn btn-primary mt-3" onClick={onDownloadHistory}>
                            Click here to see all the batch updates
                        </button>
                    </div>
                </div>
            </div>

            {/* Product Information for Batch */}
            {batchProduct && (
                <div className="row justify-content-center mt-5">
                    <div className="col-md-8">
                        <div className="card shadow">
                            <div className="card-body">
                                <h4 className="card-title">Product Information ℹ️</h4>
                                {glbFile ? (
                                    <div style={{ marginBlock: '2vw' }}>
                                        <Viewer3D externalGlbFile={glbFile} />
                                    </div>
                                ) : (
                                    <p style={{ color: 'grey' }}>no 3D preview available</p>
                                )}

                                <Table striped bordered hover>
                                    <tbody>
                                    {batchProduct.Name && <tr><th>Name</th><td>{batchProduct.Name}</td></tr>}
                                    <tr><th>ID</th><td>{batchProduct.ID}</td></tr>
                                    {batchProduct.Manufacturer && <tr><th>Manufacturer</th><td>{batchProduct.Manufacturer}</td></tr>}
                                    {batchProduct.SowingDate && <tr><th>Sowing Date</th><td>{batchProduct.SowingDate}</td></tr>}
                                    {batchProduct.HarvestDate && <tr><th>Harvest Date</th><td>{batchProduct.HarvestDate}</td></tr>}
                                    {batchProduct.Ingredients && <tr><th>Ingredients</th><td>{batchProduct.Ingredients}</td></tr>}
                                    {batchProduct.Nutritional_information && <tr><th>Nutritional Information</th><td>{batchProduct.Nutritional_information}</td></tr>}
                                    {batchProduct.Allergens && <tr><th>Allergens</th><td>{batchProduct.Allergens}</td></tr>}
                                    {batchProduct.PesticideUse && <tr><th>Pesticide Use</th><td>{batchProduct.PesticideUse}</td></tr>}
                                    {batchProduct.FertilizerUse && <tr><th>Fertilizer Use</th><td>{batchProduct.FertilizerUse}</td></tr>}
                                    {batchProduct.CountryOfOrigin && <tr><th>Country Of Origin</th><td>{batchProduct.CountryOfOrigin}</td></tr>}
                                    {batchProduct.CustomObject && Object.entries(batchProduct.CustomObject).map(([key, value]) => (
                                        <tr key={key}><th>{key}</th><td>{value}</td></tr>
                                    ))}
                                    </tbody>
                                </Table>

                                <br />
                                <DataSensors productId={batchProduct.ID} />
                                <br /><br /><br />

                                <QRCodeCanvas
                                    value={`${window.location.origin}/scan-product/${batchProduct.ID}`}
                                    style={{ marginBottom: '2vw' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BatchDetails;
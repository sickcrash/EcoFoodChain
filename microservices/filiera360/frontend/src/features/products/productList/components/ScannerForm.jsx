import React from 'react';
import { Card } from 'react-bootstrap';
import QrScanner from 'react-qr-scanner';

const ScannerForm = ({
                         title,
                         subtitle,
                         itemCode,
                         setItemCode,
                         onSubmit,
                         message,
                         showCamera,
                         setShowCamera,
                         onImageUpload,
                         onQrScan,
                         onError,
                         inputId,
                         uploaderId,
                         submitLabel
                     }) => {
    return (
        <form onSubmit={onSubmit} className="row justify-content-center">
            <div className="col-md-6">
                <div className="card shadow">
                    <div className="card-body">
                        <Card.Header>
                            <h4>{title}</h4>
                            <p style={{ color: 'grey' }}>{subtitle}</p>
                        </Card.Header>
                        <br />
                        <div className="form-group d-flex align-items-center">
                            <input
                                type="text"
                                onChange={(e) => setItemCode(e.target.value)}
                                className="form-control me-2"
                                id={inputId}
                                placeholder={`Enter ${title.toLowerCase()} Item Code`}
                            />
                            <input
                                type="file"
                                id={uploaderId}
                                onChange={onImageUpload}
                                onError={onError}
                                style={{ display: 'none' }}
                            />
                            <label
                                htmlFor={uploaderId}
                                className="btn btn-secondary me-1"
                                style={{ backgroundColor: 'silver', border: 0 }}
                            >
                                <ion-icon name="cloud-upload-outline"></ion-icon>
                                <i className="ion-ios-upload" />
                            </label>
                            <div
                                className="btn btn-secondary"
                                title="Scan QR Code"
                                style={{ backgroundColor: 'silver', border: 0 }}
                                onClick={() => setShowCamera(!showCamera)}
                            >
                                <ion-icon name="camera-outline"></ion-icon>
                            </div>
                        </div>
                        {showCamera && (
                            <QrScanner
                                style={{ width: '100%', paddingTop: '2vw' }}
                                delay={300}
                                onError={onError}
                                onScan={onQrScan}
                            />
                        )}
                        <input
                            type="submit"
                            className="btn btn-primary mt-3 w-100"
                            id="scanButton"
                            value={submitLabel}
                        />
                        {message && <p className="mt-3 text-muted">{message}</p>}
                    </div>
                </div>
            </div>
        </form>
    );
};

export default ScannerForm;
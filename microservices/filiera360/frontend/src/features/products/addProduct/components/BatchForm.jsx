import { Button, Card, Form } from 'react-bootstrap';
import { QRCodeCanvas } from 'qrcode.react';
import React, { useState } from 'react';
import { INPUT_WIDTH, PLACEHOLDER_TEXT } from '../constants';
import { buildBatchData, validateBatchId, validateQuantity } from '../../../../utils/formHelpers';
import { uploadBatch } from '../../../../services/batchService';
import { addToRecentlyScanned } from '../../../../services/productService';
import Papa from 'papaparse';
import { parseCustomObject } from '../../../../utils/upload/csvParser';
import { useBatchForm } from '../hooks/useBatchForm';

const BatchForm = ({ operator, viewBatch, setViewBatch, setViewProduct }) => {
  const {
    idBatch,
    setIdBatch,
    productId,
    setProductId,
    batchNumber,
    setBatchNumber,
    quantity,
    setQuantity,
    productionDate,
    setProductionDate,
    state,
    setState,
    customBatchFields,
    setCustomBatchFields,
    resetForm,
  } = useBatchForm(operator);

  const [csvBatchFile, setCsvBatchFile] = useState(null);
  const [lastAdded, setLastAdded] = useState('');
  const [message, setMessage] = useState('');

  const addCustomBatchField = () => setCustomBatchFields([...customBatchFields, { key: '', value: '' }]);

  const updateCustomBatchField = (index, key, value) => {
    const newBatchFields = [...customBatchFields];
    newBatchFields[index] = { key, value };
    setCustomBatchFields(newBatchFields);
  };

  const removeCustomBatchField = (index) => {
    setCustomBatchFields(customBatchFields.filter((_, i) => i !== index));
  };

  const handleCsvBatchChange = (e) => {
    setCsvBatchFile(e.target.files[0]);
  };

  const handleUploadBatch = async (e) => {
    e.preventDefault();

    try {
      if (!validateBatchId(idBatch) || !validateQuantity(quantity)) return;

      const batchData = buildBatchData({
        idBatch,
        productId,
        operator,
        batchNumber,
        quantity,
        productionDate,
        state,
        customBatchFields,
      });
      await uploadBatch(batchData);
      setLastAdded(batchData.ID); 
      setMessage('Batch uploaded successfully!');
      await addToRecentlyScanned(batchData);
      resetForm(batchData.ID);
      setViewBatch(false);
    } catch (err) {
      setMessage(err.response?.data?.message || err.message);
    }
  };

  const handleCsvUploadBatch = async (e) => {
    e.preventDefault()
    if (!csvBatchFile) {
      setMessage('Please upload a CSV file first.');
      return;
    }

    Papa.parse(csvBatchFile, {
      complete: async (result) => {
        for (let row of result.data) {
          const batchFields = {
            idBatch: row[0],
            productId: row[1],
            operator,
            batchNumber: row[2],
            quantity: row[3],
            productionDate: row[4],
            state: row[5],
            customBatchFields: parseCustomObject(row[6]),
          };

          const batchData = buildBatchData(batchFields);

          try {
            await uploadBatch(batchData);
            console.log(`Batch ${batchData.ID} uploaded successfully!`);
          } catch (error) {
            console.error(`Error uploading batch ${batchData.ID}`, error);
            setMessage(`Error uploading batch ${batchData.ID}`);
          }
        }

        setMessage('CSV Batch upload completed successfully!');
        setCsvBatchFile(null);
        setViewBatch(false);
      },
      header: false,
    });
  };

  return (
    <div className="card shadow">
      <div className="card-body">
        <Card.Header>
          <h4>Upload Batch 📦</h4>
          <p style={{ color: 'grey' }}>
            ℹ️ Add your batch and complete its details to enhance traceability and transparency
            <br />
          </p>
        </Card.Header>
        <br />
        {message && !viewBatch && (
          <div>
            {lastAdded && (
              <div>
                <br />
                <QRCodeCanvas
                  value={`${window.location.origin}/scan-product/${lastAdded}`}
                  style={{ marginBottom: '2vw' }}
                />
                <p>
                  Batch ID: <b>{lastAdded}</b>
                </p>
              </div>
            )}
          </div>
        )}
        {!viewBatch && (
          <button
            className="btn btn-primary mt-3 w-100"
            onClick={() => {
              setViewBatch(true);
              setViewProduct(false);
              setMessage('');
            }}
          >
            + New Batch
          </button>
        )}
        {viewBatch && (
          <Card.Body>
            {/* CSV File Upload */}
            <Form.Group
              className="d-flex align-items-center mb-3"
              style={{ marginTop: '1vw' }}
            >
              <Form.Label
                style={{ width: INPUT_WIDTH }}
                className="me-3"
              >
                Upload CSV Batch
              </Form.Label>
              <div
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2vw',
                  border: '1px dashed silver',
                  borderRadius: '1vw',
                  padding: '1vw',
                }}
              >
                {csvBatchFile ? (
                  <ion-icon
                    name="trash-outline"
                    style={{ cursor: 'pointer', color: 'grey' }}
                    onClick={() => {
                      document.getElementById('csvBatchFile').value = '';
                      setCsvBatchFile('');
                    }}
                  />
                ) : (
                  <ion-icon
                    name="folder-outline"
                    style={{ color: 'grey' }}
                  ></ion-icon>
                )}
                <label
                  htmlFor="csvBatchFile"
                  style={{
                    color: 'grey',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  {csvBatchFile ? JSON.stringify(csvBatchFile.name) : 'upload data Batch from CSV file'}
                </label>
                <input
                  style={{ display: 'none' }}
                  id="csvBatchFile"
                  type="file"
                  accept=".csv"
                  onChange={handleCsvBatchChange}
                />
                {csvBatchFile && (
                  <Button
                    variant="primary"
                    style={{ borderRadius: '2vw', paddingBlock: '0' }}
                    onClick={handleCsvUploadBatch}
                    disabled={!csvBatchFile}
                    type="submit"
                  >
                    Submit
                  </Button>
                )}
              </div>
            </Form.Group>
            {csvBatchFile && <p>{message}</p>}
            {/* Separator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                margin: '20px 0',
              }}
            >
              <hr
                style={{
                  flex: 1,
                  border: 'none',
                  borderTop: '1px solid #666',
                }}
              />
              <span
                style={{
                  margin: '0 10px',
                  color: '#666',
                  fontWeight: 'bold',
                }}
              >
                or
              </span>
              <hr
                style={{
                  flex: 1,
                  border: 'none',
                  borderTop: '1px solid #666',
                }}
              />
            </div>

            <Form onSubmit={handleUploadBatch}>
              {/* Display basic fields */}
              <Form.Group
                controlId="id"
                className="d-flex align-items-center mb-3"
              >
                <Form.Label
                  style={{ width: INPUT_WIDTH }}
                  className="me-3"
                >
                  ID Lotto
                </Form.Label>
                <Form.Control
                  type="text"
                  value={idBatch}
                  onChange={(e) => setIdBatch(e.target.value)}
                  placeholder={'LXXX'}
                  required
                />
              </Form.Group>
              {/* Product Id */}
              <Form.Group
                controlId="productId"
                className="d-flex align-items-center mb-3"
              >
                <Form.Label
                  style={{ width: INPUT_WIDTH }}
                  className="me-3"
                >
                  ID Prodotto
                </Form.Label>
                <Form.Control
                  type="text"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  placeholder={PLACEHOLDER_TEXT}
                  required
                />
              </Form.Group>
              {/*Batch Number*/}
              <Form.Group
                controlId="batchNumber"
                className="d-flex align-items-center mb-3"
              >
                <Form.Label
                  style={{ width: INPUT_WIDTH }}
                  className="me-3"
                >
                  Numero del lotto
                </Form.Label>
                <Form.Control
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder={PLACEHOLDER_TEXT}
                  required
                />
              </Form.Group>
              {/* Quantity*/}
              <Form.Group
                controlId="quantity"
                className="d-flex align-items-center mb-3"
              >
                <Form.Label
                  style={{ width: INPUT_WIDTH }}
                  className="me-3"
                >
                  Peso in kg
                </Form.Label>
                <Form.Control
                  type="text"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  placeholder={PLACEHOLDER_TEXT}
                />
              </Form.Group>

              <Form.Group
                controlId="productionDate"
                className="d-flex align-items-center mb-3"
              >
                <Form.Label
                  style={{ width: INPUT_WIDTH }}
                  className="me-3"
                >
                  Data di produzione
                </Form.Label>
                <Form.Control
                  type="date"
                  value={productionDate}
                  onChange={(e) => setProductionDate(e.target.value)}
                  placeholder={PLACEHOLDER_TEXT}
                />
              </Form.Group>
              <Form.Group
                controlId="state"
                className="d-flex align-items-center mb-3"
              >
                <Form.Label
                  style={{ width: INPUT_WIDTH }}
                  className="me-3"
                >
                  Stato
                </Form.Label>
                <Form.Select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  required
                >
                  <option
                    value=""
                    disabled
                  >
                    -- Select Status --
                  </option>
                  <option value="Shipped">Shipped</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Retired">Retired</option>
                  <option value="Reported">Reported</option>
                </Form.Select>
              </Form.Group>
              {/* Separator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  margin: '20px 0',
                }}
              >
                <hr
                  style={{
                    flex: 1,
                    border: 'none',
                    borderTop: '1px solid #666',
                  }}
                />
                <span
                  style={{
                    margin: '0 10px',
                    color: '#666',
                    fontWeight: 'bold',
                  }}
                ></span>
                <hr
                  style={{
                    flex: 1,
                    border: 'none',
                    borderTop: '1px solid #666',
                  }}
                />
              </div>
              <h5>Custom Batch Fields</h5>
              <p style={{ color: 'gray' }}>edit existing custom fields or add new ones</p>
              {customBatchFields.map((field, index) => (
                <div
                  key={index}
                  className="d-flex mb-2 align-items-center"
                >
                  <Form.Control
                    type="text"
                    placeholder="Batch Field Name"
                    value={field.key}
                    onChange={(e) => updateCustomBatchField(index, e.target.value, field.value)}
                    className="me-2"
                  />
                  <Form.Control
                    type="text"
                    placeholder="Value"
                    value={field.value}
                    onChange={(e) => updateCustomBatchField(index, field.key, e.target.value)}
                  />
                  {/* Pulsante di rimozione con icona*/}
                  <button
                    type="button"
                    className="btn btn-light btn-sm ms-2 p-1"
                    onClick={() => removeCustomBatchField(index)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontSize: '18px',
                      cursor: 'pointer',
                      color: '#ff4d4d',
                    }}
                  >
                    ✖️
                  </button>
                </div>
              ))}

              <Button
                variant="primary"
                onClick={addCustomBatchField}
                className="my-3 d-block mx-auto"
              >
                + Add Batch Field
              </Button>

              {/* Separator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  margin: '20px 0',
                }}
              >
                <hr
                  style={{
                    flex: 1,
                    border: 'none',
                    borderTop: '1px solid #666',
                  }}
                />
                <span
                  style={{
                    margin: '0 10px',
                    color: '#666',
                    fontWeight: 'bold',
                  }}
                ></span>
                <hr
                  style={{
                    flex: 1,
                    border: 'none',
                    borderTop: '1px solid #666',
                  }}
                />
              </div>
              <Button
                variant="primary"
                type="submit"
                disabled={!idBatch || !productId || !batchNumber || !quantity || !productionDate || !state}
              >
                Upload Batch
              </Button>
              {message && <p style={{ marginTop: '1vw', fontStyle: 'italic' }}>{message}</p>}
            </Form>
          </Card.Body>
        )}
      </div>
      <br />
    </div>
  );
};

export default BatchForm;

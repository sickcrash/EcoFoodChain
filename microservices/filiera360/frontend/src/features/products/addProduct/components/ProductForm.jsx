import React, { useEffect, useState } from 'react';
import { Button, Card, Form } from 'react-bootstrap';
import { QRCodeCanvas } from 'qrcode.react';
import Viewer3D from '../../Viewer3D';
import AddSensorData from '../../components/update/AddSensorData';
import AddCertification from '../../AddCertification';
import { handleMultiFileUpload } from '../../../../utils/upload/handleMultiFileUpload';
import { addToRecentlyScanned, uploadModel, uploadProduct } from '../../../../services/productService';
import { INPUT_WIDTH, PLACEHOLDER_TEXT } from '../constants';
import { buildProductData, validateDates } from '../../../../utils/formHelpers';
import { useProductForm } from '../hooks/useProductForm';

const ProductForm = ({
  manufacturer,
  viewProduct,
  setViewProduct,
  setViewBatch
}) => {
  const {
    id,
    setId,
    name,
    setName,
    harvestDate,
    setHarvestDate,
    ingredients,
    setIngredients,
    allergens,
    setAllergens,
    nutritionalInformation,
    setNutritionalInformation,
    sowingDate,
    setSowingDate,
    pesticideUse,
    setPesticideUse,
    fertilizerUse,
    setFertilizerUse,
    countryOfOrigin,
    setCountryOfOrigin,
    glbFile,
    setGlbFile,
    sensorData,
    setSensorData,
    customFields,
    setCustomFields,
    getProductData,
    resetForm,
  } = useProductForm(manufacturer);

  const [showInfo, setShowInfo] = useState(false);
  const [message, setMessage] = useState('');
  const [lastAdded, setLastAdded] = useState('');
  const [showAddSensor, setShowAddSensor] = useState(false);
  const [showAddCertification, setShowAddCertification] = useState(false);
  const [csvFile, setCsvFile] = useState(null);

  useEffect(() => {
    setShowAddSensor(false);
  }, [harvestDate, sowingDate]);

  const handleUploadProduct = async (e) => {
    e.preventDefault();

    try {
      // 1. Verifica se la data di scadenza è maggiore della data di raccolta
      validateDates(sowingDate, harvestDate);

      // 2. Costruzione oggetto prodotto
      const productData = buildProductData({
        id: id,
        name: name,
        manufacturer: manufacturer,
        sowingDate: sowingDate,
        harvestDate: harvestDate,
        nutritionalInformation: nutritionalInformation,
        countryOfOrigin: countryOfOrigin,
        ingredients: ingredients || 'n/a',
        allergens: allergens || 'n/a',
        pesticideUse: pesticideUse,
        fertilizerUse: fertilizerUse,
        sensorData: sensorData,
        customFields: customFields,
      });

      // 3. Upload prodotto
      await uploadProduct(productData);
      setMessage('Product uploaded successfully!');

      // 4. Aggiorna stato UI
      await addToRecentlyScanned(productData);
      setLastAdded(productData.ID);
      resetForm();
      setViewProduct(false);
      setViewBatch(false);
      setCsvFile(null);

      // 5. Upload modello 3D se presente
      if (glbFile) {
        try {
          await uploadModel(id, glbFile);
          console.log('Model uploaded successfully!');
        } catch {
          console.error('Failed to upload 3D model.');
        }
      }
    } catch (err) {
      setMessage(err.response?.data?.message || err.message);
    }
  };

  // Metodo per aggiornare il nuovo campo personalizzato
  const updateCustomField = (index, key, value) => {
    const updated = [...customFields];
    updated[index] = { key, value };
    setCustomFields(updated);
  };

  const removeCustomField = (index) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const addCustomField = () => {
    setCustomFields([...customFields, { key: '', value: '' }]);
  };

  return (
    <div className="card shadow">
      <div className="card-body">
        <Card.Header>
          <h4>Upload Product 🌱</h4>
          <p style={{ color: 'grey' }}>
            ℹ️ Add your product and complete its details to enhance traceability and transparency
            <br />
            🖼️ Insert and visualize your product with a 3D model
          </p>
        </Card.Header>

        {/* Mostra QR code se appena aggiunto */}
        {message && !viewProduct && (
          <div>
            {lastAdded && (
              <div>
                <br/>
                <QRCodeCanvas
                  value={`${window.location.origin}/scan-product/${lastAdded}`}
                  style={{ marginBottom: '2vw' }}
                />
                <p>
                  Product ID: <b>{lastAdded}</b>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bottone per aprire il form */}
        {!viewProduct && (
          <Button
            className="btn btn-primary mt-3 w-100"
            onClick={() => {
              setViewProduct(true);
              setViewBatch(false);
              setMessage('');
            }}
          >
            + New Product
          </Button>
        )}

        {!viewProduct && (
          <>
            {message && <p style={{fontStyle: 'italic', marginTop: '1vw' }}>{message}</p>}
            <button
              style={{
                backgroundColor: '#6c757d',
                border: '1px solid #6c757d',
                color: 'white',
                marginTop: '10px',
                width: '100%',
              }}
              className="btn mt-2"
              onClick={() => document.getElementById('multiFileInput').click()}
            >
              📁 or upload CSV/JSON/XML
            </button>
            <input
              id="multiFileInput"
              type="file"
              accept=".csv,.json,.xml"
              style={{ display: 'none' }}
              onChange={handleMultiFileUpload}
            />
          </>
        )}

        {/* FORM */}
        {viewProduct && (
          <Card.Body>
            {/* CSV File Upload */}
            {/*
                    <Form.Group
                      className="d-flex align-items-center mb-3"
                      style={{ marginTop: "1vw" }}
                    >
                      <Form.Label
                        style={{ width: inputWidth }}
                        className="me-3"
                      >
                        Upload CSV
                      </Form.Label>
                      <Form
                        style={{
                          display: "flex",
                          width: "100%",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "2vw",
                          border: "1px dashed silver",
                          borderRadius: "1vw",
                          padding: "1vw",
                        }}
                      >
                        {csvFile ? (
                          <ion-icon
                            name="trash-outline"
                            style={{ cursor: "pointer", color: "grey" }}
                            onClick={() => {
                              document.getElementById("csvFile").value = "";
                              setCsvFile("");
                            }}
                          />
                        ) : (
                          <ion-icon
                            name="folder-outline"
                            style={{ color: "grey" }}
                          ></ion-icon>
                        )}
                        <label
                          htmlFor="csvFile"
                          style={{
                            color: "grey",
                            textDecoration: "underline",
                            cursor: "pointer",
                          }}
                        >
                          {csvFile
                            ? JSON.stringify(csvFile.name)
                            : "upload data Batch from CSV file"}
                        </label>
                        <input
                          style={{ display: "none" }}
                          id="csvFile"
                          type="file"
                          accept=".csv"
                          onChange={handleCsvChange}
                        />
                        {csvFile && (
                          <Button
                            variant="primary"
                            style={{ borderRadius: "2vw", paddingBlock: "0" }}
                            onClick={handleCsvUpload}
                            disabled={!csvFile}
                          >
                            Submit
                          </Button>
                        )}
                      </Form>
                    </Form.Group>
                    {csvFile && <p>{messageProduct}</p>}

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        margin: "20px 0",
                      }}
                    >
                      <hr
                        style={{
                          flex: 1,
                          border: "none",
                          borderTop: "1px solid #666",
                        }}
                      />
                      <span
                        style={{
                          margin: "0 10px",
                          color: "#666",
                          fontWeight: "bold",
                        }}
                      >
                        or
                      </span>
                      <hr
                        style={{
                          flex: 1,
                          border: "none",
                          borderTop: "1px solid #666",
                        }}
                      />
                    </div>
                    */}
            <Form onSubmit={handleUploadProduct}>
              {/* Display basic fields */}
              <Form.Group
                controlId="id"
                className="d-flex align-items-center mb-3"
              >
                <Form.Label
                  style={{ width: INPUT_WIDTH }}
                  className="me-3"
                >
                  ID
                </Form.Label>
                <Form.Control
                  type="text"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder={PLACEHOLDER_TEXT}
                  required
                />
              </Form.Group>
              {/* Name Field */}
              <Form.Group
                controlId="name"
                className="d-flex align-items-center mb-3"
              >
                <Form.Label
                  style={{ width: INPUT_WIDTH }}
                  className="me-3"
                >
                  Nome
                </Form.Label>
                <Form.Control
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={PLACEHOLDER_TEXT}
                  required
                />
              </Form.Group>
              {/*Sowing Date Field*/}
              <Form.Group
                controlId="sowingDate"
                className="d-flex align-items-center mb-3"
              >
                <Form.Label
                  style={{ width: INPUT_WIDTH }}
                  className="me-3"
                >
                  <span
                    title="Production Start Date refers to the sowing date or, more generally, the date when the production for that year’s product begins"
                    style={{ marginLeft: '6px', cursor: 'help' }}
                    onClick={() => setShowInfo((prev) => !prev)}
                  >
                    (ℹ️) Inizio produzione
                  </span>
                  {showInfo && (
                    <div style={{ marginLeft: '10px', fontSize: '0.9em', color: 'grey' }}>
                      Production Start Date refers to the sowing date or, more generally, the date when the production
                      for that year’s product begins
                    </div>
                  )}
                </Form.Label>
                <Form.Control
                  type="date"
                  value={sowingDate}
                  onChange={(e) => setSowingDate(e.target.value)}
                />
              </Form.Group>
              {/* Harvest Date Field*/}
              <Form.Group
                controlId="harvestDate"
                className="d-flex align-items-center mb-3"
              >
                <Form.Label
                  style={{ width: INPUT_WIDTH }}
                  className="me-3"
                >
                  Data di raccolta
                </Form.Label>
                <Form.Control
                  type="date"
                  value={harvestDate}
                  onChange={(e) => setHarvestDate(e.target.value)}
                  required
                />
              </Form.Group>

              <Form.Group
                controlId="nutritionalInformation"
                className="d-flex align-items-center mb-3"
              >
                <Form.Label
                  style={{ width: INPUT_WIDTH }}
                  className="me-3"
                >
                  Informazioni nutrizionali
                </Form.Label>
                <Form.Control
                  type="text"
                  value={nutritionalInformation}
                  onChange={(e) => setNutritionalInformation(e.target.value)}
                  placeholder={PLACEHOLDER_TEXT}
                />
              </Form.Group>

              <Form.Group
                controlId="countryOfOrigin"
                className="d-flex align-items-center mb-3"
              >
                <Form.Label
                  style={{ width: INPUT_WIDTH }}
                  className="me-3"
                >
                  Origine
                </Form.Label>
                <Form.Control
                  type="text"
                  value={countryOfOrigin}
                  onChange={(e) => setCountryOfOrigin(e.target.value)}
                  placeholder={PLACEHOLDER_TEXT}
                />
              </Form.Group>
              <Form.Group
                controlId="pesticideUse"
                className="d-flex align-items-center mb-3"
              >
                <Form.Label
                  style={{ width: INPUT_WIDTH }}
                  className="me-3"
                >
                  Uso di pesticidi
                </Form.Label>
                <Form.Control
                  type="text"
                  value={pesticideUse}
                  onChange={(e) => setPesticideUse(e.target.value)}
                  placeholder={PLACEHOLDER_TEXT}
                />
              </Form.Group>
              <Form.Group
                controlId="fertilizerUse"
                className="d-flex align-items-center mb-3"
              >
                <Form.Label
                  style={{ width: INPUT_WIDTH }}
                  className="me-3"
                >
                  Uso di fertilizzanti
                </Form.Label>
                <Form.Control
                  type="text"
                  value={fertilizerUse}
                  onChange={(e) => setFertilizerUse(e.target.value)}
                  placeholder={PLACEHOLDER_TEXT}
                />
              </Form.Group>
              <Form.Group
                controlId="ingredients"
                className="d-flex align-items-center mb-3"
              >
                <Form.Label
                  style={{ width: INPUT_WIDTH, color: 'grey' }}
                  className="me-3"
                >
                  Ingredienti (se presenti)
                </Form.Label>
                <Form.Control
                  type="text"
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  placeholder={PLACEHOLDER_TEXT}
                />
              </Form.Group>
              <Form.Group
                controlId="allergens"
                className="d-flex align-items-center mb-3"
              >
                <Form.Label
                  style={{ width: INPUT_WIDTH, color: 'grey' }}
                  className="me-3"
                >
                  Allergeni (se presenti)
                </Form.Label>
                <Form.Control
                  type="text"
                  value={allergens}
                  onChange={(e) => setAllergens(e.target.value)}
                  placeholder={PLACEHOLDER_TEXT}
                />
              </Form.Group>
              {/* Upload 3D Model */}
              <div className="mb-3">
                <Viewer3D onGlbUpload={setGlbFile} />
              </div>
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
              <h5>Custom Fields</h5>
              {customFields.map((field, index) => (
                <div
                  key={index}
                  className="d-flex mb-2 align-items-center"
                >
                  <Form.Control
                    type="text"
                    placeholder="Field Name"
                    value={field.key}
                    onChange={(e) => updateCustomField(index, e.target.value, field.value)}
                    className="me-2"
                  />
                  <Form.Control
                    type="text"
                    placeholder="Value"
                    value={field.value}
                    onChange={(e) => updateCustomField(index, field.key, e.target.value)}
                  />
                  {/* Pulsante di rimozione con icona*/}
                  <button
                    type="button"
                    className="btn btn-light btn-sm ms-2 p-1"
                    onClick={() => removeCustomField(index)}
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
                onClick={addCustomField}
                className="my-3 d-block mx-auto"
              >
                + Add Field
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
              {/* ----------------------------- SENSOR DATA ----------------------------- */}
              <div className="text-center mt-4">
                <h5>Sensors 🌡️</h5>
                <p style={{ color: 'grey' }}>
                  ℹ️ Sensor data are processed and extracted from the Databoom server. To retrieve it, you need to enter
                  the sowing date and harvest date
                  <br />
                </p>
                <Button
                  variant="outline-success"
                  onClick={() => setShowAddSensor(!showAddSensor)}
                  className="mb-3"
                  disabled={!harvestDate || !sowingDate}
                >
                  {showAddSensor ? 'Cancel' : '+ Add Sensor Data'}
                </Button>
                {showAddSensor && (
                  <AddSensorData
                    productId={id}
                    sowingDate={sowingDate}
                    harvestDate={harvestDate}
                    onAddSensorData={(data) => setSensorData(data)}
                  />
                )}
              </div>

              {/* --------------------------- CERTIFICATIONS --------------------------- */}
              <div className="text-center mt-4">
                <h5>Certifications ✅</h5>
                <p style={{ color: 'grey' }}>
                  ℹ️ In order to insert certifications, the product must already have been uploaded
                  <br />
                </p>
                <Button
                  variant="outline-primary"
                  onClick={() => setShowAddCertification(!showAddCertification)}
                  className="mb-3"
                >
                  {showAddCertification ? 'Cancel' : '+ Add Certification'}
                </Button>
                {showAddCertification && (
                  <AddCertification
                    productId={id}
                    onAddCertification={(data) => console.log('Certification added:', data)}
                  />
                )}
              </div>
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
                disabled={
                  !id ||
                  !name ||
                  !harvestDate ||
                  !sowingDate ||
                  !nutritionalInformation ||
                  !pesticideUse ||
                  !countryOfOrigin ||
                  !fertilizerUse
                }
              >
                Upload Product
              </Button>
              {message && <p style={{ marginTop: '1vw', color: 'red' }}>{message}</p>}
            </Form>
          </Card.Body>
        )}
      </div>
    </div>
  );
};

export default ProductForm;

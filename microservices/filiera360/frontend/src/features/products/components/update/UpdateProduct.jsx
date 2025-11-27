import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, Form, Button } from 'react-bootstrap';
import '../../../../styles/App.css';
import Viewer3D from '../../../products/Viewer3D';
import AddSensorData from './AddSensorData';

const UpdateProduct = ({ productId, onProductUpdate }) => {
  const [name, setName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [harvestDate, setHarvestDate] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [allergens, setAllergens] = useState('');
  const [nutritionalInformation, setNutritionalInformation] = useState('');
  const [sowingDate, setSowingDate] = useState('');
  const [pesticideUse, setPesticideUse] = useState('');
  const [fertilizerUse, setFertilizerUse] = useState('');
  const [countryOfOrigin, setCountryOfOrigin] = useState('');
  const [message, setMessage] = useState('');
  const [customFields, setCustomFields] = useState([]);
  const [sensorData, setSensorData] = useState([]);
  const [showForm, setShowForm] = useState(false); // Stato per gestire la visibilità del modulo
  const [glbFile, setGlbFile] = useState('');
  const [showAddSensor, setShowAddSensor] = useState(false);
  const inputWidth = '30%'; // larghezza fissa per le etichette
  const placeholderText = '+ add new'; // testo del placeholder per tutti i campi

  useEffect(() => {
    setManufacturer(localStorage.getItem('manufacturer'));
  }, []);

  useEffect(() => {
    setShowAddSensor(false);
  }, [harvestDate, sowingDate]);

  const resetForm = () => {
    setName('');
    setHarvestDate('');
    setSowingDate('');
    setIngredients('');
    setAllergens('');
    setNutritionalInformation('');
    setCustomFields([]); // Ensure it's an array
    setSensorData([]);
    setMessage('');
    setShowForm(false);
    setGlbFile('');
  };

  // Metodo per aggiungere un nuovo campo personalizzato con chiave-valore
  const addCustomField = () => {
    setCustomFields([...customFields, { key: '', value: '' }]);
  };
  // Metodo per aggiornare il nuovo campo personalizzato
  const updateCustomField = (index, key, value) => {
    const newFields = [...customFields];
    newFields[index] = { key, value };
    setCustomFields(newFields);
  };
  // Funzione per rimuovere un campo personalizzato
  const removeCustomField = (index) => {
    const newFields = customFields.filter((_, i) => i !== index); // Filtra il campo da rimuovere
    setCustomFields(newFields);
  };

  useEffect(() => {
    resetForm();
  }, [productId]);

  // Gestire l'invio del modulo
  const handleUpdateProduct = async () => {
    // Oggetto contenente tutti i dati del prodotto da aggiornare
    const productData = {
      ID: productId,
      Name: name,
      Manufacturer: manufacturer,
      HarvestDate: harvestDate,
      Ingredients: ingredients,
      Allergens: allergens,
      Nutritional_information: nutritionalInformation,
      SowingDate: sowingDate,
      PesticideUse: pesticideUse,
      FertilizerUse: fertilizerUse,
      Certifications: [],
      SensorData: sensorData,
      CountryOfOrigin: countryOfOrigin,
      CustomObject: customFields.reduce((obj, field) => {
        if (field.key.trim()) obj[field.key] = field.value;
        return obj;
      }, {}),
    };
    // Verifica se la data di scadenza è maggiore della data di raccolta
    if (new Date(harvestDate) <= new Date(sowingDate)) {
      // Se la condizione è vera, mostra un alert con il messaggio di errore
      alert('Harvest Date must be at least one day after Sowing Date');
      return; // Termina la funzione
    }

    console.log('Sending updated product data:', productData);

    // Funzione per convertire il file GLB in base64
    const convertFileToBase64 = async (glbFile) => {
      console.log('Converting blob URL to base64...');
      return fetch(glbFile)
        .then((response) => response.blob())
        .then((blob) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        })
        .catch((error) => {
          console.error('Error fetching blob:', error);
          throw new Error('Failed to convert blob URL to base64.');
        });
    };

    // Funzione per fare POST del modello 3D aggiornato
    const uploadModel = async () => {
      try {
        const base64File = await convertFileToBase64(glbFile);
        const postData = {
          ID: productId,
          ModelBase64: base64File,
        };
        console.log('Uploading updated model for product: ' + productId);

        const token = localStorage.getItem('token');
        const response = await axios.post('api/uploadModel', postData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Model uploaded successfully!');
      } catch (error) {
        console.error('Failed to upload model.');
      }
    };

    // Aggiornamento del prodotto e, se presente, caricamento del modello 3D
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('api/updateProduct', productData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(response.data.message || 'Product updated successfully');
      alert('Product updated successfully');

      // Effettua l'upload del modello solo se è stato specificato
      if (glbFile) await uploadModel();

      // Richiama la funzione per aggiornare lo stato e reimpostare il form
      onProductUpdate();
      resetForm();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to update product. Please try again.');
      console.error('Error updating product:', error);
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card shadow">
            <br />
            <div
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1vw',
              }}
            >
              <h3>Update Product ✏️</h3>
              <Button
                variant="primary"
                onClick={() => setShowForm(!showForm)} // Toggle per mostrare/nascondere il modulo
                style={{ backgroundColor: showForm ? 'darkgray' : '#a6d05f', border: 0 }}
              >
                {showForm ? 'Cancel' : 'Set new fields'}
              </Button>
            </div>
            {showForm && (
              <Card.Body style={{ paddingBottom: '0' }}>
                <Form>
                  {/* Hidden Product ID */}
                  <Form.Control
                    type="hidden"
                    value={productId}
                  />

                  {/* Name Field */}
                  <Form.Group
                    controlId="name"
                    className="d-flex align-items-center mb-3"
                  >
                    <Form.Label
                      style={{ width: inputWidth }}
                      className="me-3"
                    >
                      Nome
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={placeholderText}
                    />
                  </Form.Group>

                  {/* Sowing Date Field */}
                  <Form.Group
                    controlId="sowingDate"
                    className="d-flex align-items-center mb-3"
                  >
                    <Form.Label
                      style={{ width: inputWidth }}
                      className="me-3"
                    >
                      Inizio produzione
                    </Form.Label>
                    <Form.Control
                      type="date"
                      value={sowingDate}
                      onChange={(e) => setSowingDate(e.target.value)}
                      placeholder={placeholderText}
                    />
                  </Form.Group>
                  {/* Harvest Date Field */}
                  <Form.Group
                    controlId="harvestDate"
                    className="d-flex align-items-center mb-3"
                  >
                    <Form.Label
                      style={{ width: inputWidth }}
                      className="me-3"
                    >
                      Data di raccolta
                    </Form.Label>
                    <Form.Control
                      type="date"
                      value={harvestDate}
                      onChange={(e) => setHarvestDate(e.target.value)}
                      placeholder={placeholderText}
                    />
                  </Form.Group>

                  {/* Upload and view 3D model */}
                  <Viewer3D onGlbUpload={setGlbFile} />
                  <br />

                  {/* Ingredients Field */}
                  <Form.Group
                    controlId="ingredients"
                    className="d-flex align-items-center mb-3"
                  >
                    <Form.Label
                      style={{ width: inputWidth }}
                      className="me-3"
                    >
                      Ingredienti
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={ingredients}
                      onChange={(e) => setIngredients(e.target.value)}
                      placeholder={placeholderText}
                    />
                  </Form.Group>

                  {/* Allergens Field */}
                  <Form.Group
                    controlId="allergens"
                    className="d-flex align-items-center mb-3"
                  >
                    <Form.Label
                      style={{ width: inputWidth }}
                      className="me-3"
                    >
                      Allergeni
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={allergens}
                      onChange={(e) => setAllergens(e.target.value)}
                      placeholder={placeholderText}
                    />
                  </Form.Group>

                  {/* Nutritional Information Field */}
                  <Form.Group
                    controlId="nutritionalInformation"
                    className="d-flex align-items-center mb-3"
                  >
                    <Form.Label
                      style={{ width: inputWidth }}
                      className="me-3"
                    >
                      Informazioni nutrizionali
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={nutritionalInformation}
                      onChange={(e) => setNutritionalInformation(e.target.value)}
                      placeholder={placeholderText}
                    />
                  </Form.Group>

                  <Form.Group
                    controlId="pesticideUse"
                    className="d-flex align-items-center mb-3"
                  >
                    <Form.Label
                      style={{ width: inputWidth }}
                      className="me-3"
                    >
                      Uso di pesticidi 
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={pesticideUse}
                      onChange={(e) => setPesticideUse(e.target.value)}
                      placeholder={placeholderText}
                    />
                  </Form.Group>
                  <Form.Group
                    controlId="fertilizerUse"
                    className="d-flex align-items-center mb-3"
                  >
                    <Form.Label
                      style={{ width: inputWidth }}
                      className="me-3"
                    >
                      Uso di fertilizzanti
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={fertilizerUse}
                      onChange={(e) => setFertilizerUse(e.target.value)}
                      placeholder={placeholderText}
                    />
                  </Form.Group>
                  <Form.Group
                    controlId="countryOfOrigin"
                    className="d-flex align-items-center mb-3"
                  >
                    <Form.Label
                      style={{ width: inputWidth }}
                      className="me-3"
                    >
                      Origine
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={countryOfOrigin}
                      onChange={(e) => setCountryOfOrigin(e.target.value)}
                      placeholder={placeholderText}
                    />
                  </Form.Group>
                  {/* Separator */}
                  <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
                    <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #666' }} />
                    <span style={{ margin: '0 10px', color: '#666', fontWeight: 'bold' }}></span>
                    <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #666' }} />
                  </div>
                  {/* Custom Fields */}
                  <h5>Custom Fields</h5>
                  <p style={{ color: 'gray' }}>edit existing custom fields or add new ones</p>

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

                  {/* Pulsante "Add Field" posizionato fuori dal ciclo map */}
                  <Button
                    variant="primary"
                    onClick={addCustomField}
                    className="my-3 d-block mx-auto"
                  >
                    + Add Field
                  </Button>

                  {/* Separator */}
                  <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
                    <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #666' }} />
                    <span style={{ margin: '0 10px', color: '#666', fontWeight: 'bold' }}></span>
                    <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #666' }} />
                  </div>

                  {/* ----------------------------- SENSOR DATA ----------------------------- */}
                  <div className="text-center mt-4">
                    <h5>Sensors 🌡️</h5>
                    <p style={{ color: 'grey' }}>
                      ℹ️ Sensor data are processed and extracted from the Databoom server. To retrieve it, you need to
                      enter the sowing date and harvest date
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
                        productId={productId}
                        /*onAddSensorData={(data) => console.log("Sensor added:", data)}*/ sowingDate={sowingDate}
                        harvestDate={harvestDate}
                        onAddSensorData={(data) => setSensorData(data)}
                      />
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="d-flex justify-content-center mt-3">
                    <Button
                      variant="primary"
                      onClick={handleUpdateProduct}
                      style={{ width: '200px', margin: '2vw' }}
                    >
                      Update Product
                    </Button>
                  </div>

                  {/* Display Message */}
                  {message && <p className="mt-3 text-muted text-center">{message}</p>}
                </Form>
              </Card.Body>
            )}
            <br />
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateProduct;

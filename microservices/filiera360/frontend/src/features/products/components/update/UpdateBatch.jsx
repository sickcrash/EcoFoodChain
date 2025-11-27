import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, Form, Button } from 'react-bootstrap';
import '../../../../styles/App.css';

const UpdateBatch = ({ productId, batchId, onBatchUpdate }) => {
  const [operator, setOperator] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [productionDate, setProductionDate] = useState('');
  const [state, setState] = useState('');
  // Statici
  const [message, setMessage] = useState('');
  const [customFields, setCustomFields] = useState([]);
  const [showForm, setShowForm] = useState(false); // Stato per gestire la visibilità del modulo
  const inputWidth = '30%'; // larghezza fissa per le etichette
  const placeholderText = '+ add new'; // testo del placeholder per tutti i campi

  useEffect(() => {
    setOperator(localStorage.getItem('manufacturer'));
  }, []);

  const resetForm = () => {
    // setProductId('');
    // setOperator('');
    setBatchNumber('');
    setQuantity('');
    setProductionDate('');
    setState('');
    setCustomFields([]); // Ensure it's an array
    setMessage('');
    setShowForm(false);
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
  }, [batchId]);

  // Gestire l'invio del modulo
  const handleUpdateBatch = async () => {
    const batchData = {
      ID: batchId,
      ProductId: productId || '',
      Operator: operator || '',
      BatchNumber: batchNumber || '',
      Quantity: quantity || '',
      ProductionDate: productionDate || '',
      State: state || '',
      CustomObject: customFields

        .filter((field) => field.key.trim())

        .map((field) => ({ [field.key]: field.value })),
    };

    console.log(' Dati inviati a updateBatch:', JSON.stringify(batchData, null, 2));

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('api/updateBatch', batchData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log(' Risposta dal backend:', response.data);
      setMessage(response.data.message || 'Batch updated successfully');
      alert('Batch updated successfully');

      onBatchUpdate();
      resetForm();
    } catch (error) {
      console.error('Errore aggiornamento batch:', error.response?.data || error);
      setMessage(error.response?.data?.message || 'Failed to update batch. Please try again.');
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
              <h3>Update Batch ✏️</h3>
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
                  {/* Hidden Batch ID */}
                  <Form.Control
                    type="hidden"
                    value={batchId}
                  />

                  {/* <Form.Group controlId="productId" className="d-flex align-items-center mb-3">
                        <Form.Label style={{ width: inputWidth }} className="me-3">Product Id</Form.Label>
                        <Form.Control
                          type="text"
                          value={productId}
                          onChange={(e) => setProductId(e.target.value)}
                          placeholder={placeholderText}
                        />
                      </Form.Group> */}
                  {/*

                      <Form.Group controlId="operator" className="d-flex align-items-center mb-3">
                        <Form.Label style={{ width: inputWidth }} className="me-3">Operator</Form.Label>
                        <Form.Control
                          type="text"
                          value={operator}
                          onChange={(e) => setOperator(e.target.value)}
                          placeholder={placeholderText}
                        />
                      </Form.Group> */}

                  <Form.Group
                    controlId="batchNumber"
                    className="d-flex align-items-center mb-3"
                  >
                    <Form.Label
                      style={{ width: inputWidth }}
                      className="me-3"
                    >
                      Numero del lotto
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={batchNumber}
                      onChange={(e) => setBatchNumber(e.target.value)}
                      placeholder={placeholderText}
                    />
                  </Form.Group>
                  <Form.Group
                    controlId="quantity"
                    className="d-flex align-items-center mb-3"
                  >
                    <Form.Label
                      style={{ width: inputWidth }}
                      className="me-3"
                    >
                      Peso in kg
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder={placeholderText}
                    />
                  </Form.Group>
                  <Form.Group
                    controlId="productionDate"
                    className="d-flex align-items-center mb-3"
                  >
                    <Form.Label
                      style={{ width: inputWidth }}
                      className="me-3"
                    >
                      Data di produzione
                    </Form.Label>
                    <Form.Control
                      type="date"
                      value={productionDate}
                      onChange={(e) => setProductionDate(e.target.value)}
                      placeholder={placeholderText}
                    />
                  </Form.Group>
                  <Form.Group
                    controlId="state"
                    className="d-flex align-items-center mb-3"
                  >
                    <Form.Label
                      style={{ width: inputWidth }}
                      className="me-3"
                    >
                      Status
                    </Form.Label>
                    <Form.Control
                      type="state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
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

                  {/* Submit Button */}
                  <div className="d-flex justify-content-center mt-3">
                    <Button
                      variant="primary"
                      onClick={handleUpdateBatch}
                      style={{ width: '200px', margin: '2vw' }}
                    >
                      Update Batch
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

export default UpdateBatch;

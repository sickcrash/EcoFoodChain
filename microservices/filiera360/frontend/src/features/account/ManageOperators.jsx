import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, Button } from 'react-bootstrap';

export const ManageOperators = () => {
  const [operators, setOperators] = useState([]);
  const [newOperator, setNewOperator] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Funzione per caricare la lista operatori dal backend
  const fetchOperators = async () => {
    try {
      const response = await axios.get(`api/operators`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      // estrai solo le email dagli oggetti operatori
      const operatorEmails = (response.data.operators || []).map((op) => (typeof op === 'string' ? op : op.email));
      setOperators(operatorEmails);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchOperators();
  }, []);

  const handleDeleteOperator = async (operator) => {
    try {
      await axios.post(
        `api/operators/delete`,
        {
          email: operator,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        },
      );
      // Ricarica la lista aggiornata dal backend
      fetchOperators();
    } catch (error) {
      setErrorMessage('Error deleting operator: ' + error.toString());
      console.error(error);
    }
  };

  const handleCreateOperator = async () => {
    if (!newOperator || newOperator.trim() === '') {
      setErrorMessage('Operator name cannot be empty');
      return;
    }
    try {
      const response = await axios.post(
        `api/operators/add`,
        {
          email: newOperator,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        },
      );
      if (response.status !== 201) {
        setErrorMessage('Error creating operator');
        return;
      }
      setNewOperator('');
      // Ricarica la lista aggiornata dal backend
      fetchOperators();
    } catch (error) {
      setErrorMessage('Error creating operator: ' + error.toString());
      console.error(error);
    }
  };

  return (
    <div className="row justify-content-center my-4">
      <div className="col">
        <div className="card shadow">
          <div className="card-body">
            <Card.Header style={{ textAlign: 'center' }}>
              <h4>Operators 👷</h4>
            </Card.Header>
            <br />
            <div className="card shadow flex flex-row justify-content-between align-items-center p-3 bg-white rounded">
              <div className="input-group mr-2">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Add new operator"
                  value={newOperator}
                  onChange={(e) => setNewOperator(e.target.value)}
                />
              </div>
              <Button
                variant="success"
                onClick={handleCreateOperator}
              >
                +
              </Button>
            </div>
            {errorMessage && (
              <div
                className="text text-danger"
                style={{ textAlign: 'center' }}
              >
                {errorMessage}
              </div>
            )}
            <hr />
            {operators?.map((operator, index) => (
              <div
                key={index}
                className="card shadow flex flex-row justify-content-between align-items-center p-3 mb-2 bg-white rounded"
              >
                <div>{operator}</div>
                <Button
                  variant="danger"
                  onClick={() => handleDeleteOperator(operator)}
                >
                  🗑️
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

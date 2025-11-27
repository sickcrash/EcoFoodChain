import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import AddSensorData from './update/AddSensorData';
import { Button, Card } from 'react-bootstrap';

const DataSensors = ({ productId }) => {
  const [sensors, setSensors] = useState([]);
  const [productManufacturer, setProductManufacturer] = useState('');

  const fetchSensors = useCallback(async () => {
    try {
      const response = await axios.get(`api/getAllSensorData?productId=${productId}`);
      setSensors(response.data);
    } catch (error) {
      console.error('Failed to fetch sensor data', error);
    }

    const getProductManufacturer = async () => {
      try {
        const response = await axios.get(`api/getProduct?productId=${productId}`);
        if (response.status === 200) {
          setProductManufacturer(response.data.Manufacturer);
        } else {
          console.log('Product not found.');
        }
      } catch (error) {
        console.log('Failed to fetch product details.');
      }
    };
    getProductManufacturer();
  }, [productId]);

  useEffect(() => {
    fetchSensors();
  }, [fetchSensors]);

  const addSensorData = (newSensorData) => {
    setSensors((prevSensors) => [...prevSensors, newSensorData]);
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card shadow">
            <br />
            <h3>Sensor Data 🌡️</h3>
            <Card.Body>
              <ul
                className="list-group"
                style={{ maxHeight: '20vw', overflowY: 'auto' }}
              >
                {sensors.length > 0 ? (
                  sensors.map((sensor, index) => (
                    <li
                      key={index}
                      className="list-group-item"
                    >
                      <strong>Sensor:</strong> {sensor.SensorName}
                      <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
                        {Object.entries(sensor.Signals).map(([signalId, value], idx) => (
                          <li key={idx}>
                            <strong>{signalId}:</strong> {value}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))
                ) : (
                  <li className="list-group-item">No sensor data available.</li>
                )}
              </ul>
            </Card.Body>
          </div>
        </div>
      </div>
    </div>
  );
};
export default DataSensors;

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, Form, Button } from 'react-bootstrap';
//import Papa from 'papaparse';  // Assicurati di avere papaparse installato

const AddSensorData = ({ productId, onAddSensorData, sowingDate, harvestDate }) => {
  const [sensor_id, setSensor_id] = useState('');
  const [message, setMessage] = useState('');
  const [devices, setDevices] = useState([]);
  const [signals, setSignals] = useState([]); // array con { signal_id, signal_name, average }
  const [signalValues, setSignalValues] = useState({}); // { signal_id: value }
  const [deviceForms, setDeviceForms] = useState([]);
  const [loading, setLoading] = useState(false);

  const inputWidth = '30%'; // Larghezza fissa per le etichette
  const placeholderText = '+ add new'; // Placeholder universale per i campi di input

  useEffect(() => {
    setSensor_id('');
    setMessage('');
    setSignals([]);
    setSignalValues({});
  }, [productId]);

  useEffect(() => {
    axios
      .get('api/getDataboomDevices')
      .then((res) => setDevices(res.data))
      .catch((err) => console.error('Errore nel recuperare devices:', err));
  }, []);

  const handleAddDevice = () => {
    setDeviceForms((prev) => [
      ...prev,
      {
        sensor_id: '',
        signals: [],
        signalValues: {},
      },
    ]);
  };

  const handleDeviceSelect = async (deviceIndex, selectedDeviceId) => {
    if (!sowingDate || !harvestDate) return;

    setLoading(true);

    try {
      const res = await axios.get('api/getDataboomSignalAverages', {
        params: {
          device_id: selectedDeviceId,
          start_date: `${sowingDate}T00:00:00Z`,
          end_date: `${harvestDate}T23:59:59Z`,
        },
      });

      const signals = res.data || [];
      const filteredSignals = signals.filter(
        (signal) => signal.average !== null && signal.average !== undefined && signal.average !== '',
      );
      if (filteredSignals.length === 0) {
        const updatedForms = [...deviceForms];
        updatedForms[deviceIndex] = {
          sensor_id: selectedDeviceId,
          signals: [],
          signalValues: {},
          empty: true,
        };
        setDeviceForms(updatedForms);
        return;
      }

      const initialValues = {};
      filteredSignals.forEach((signal) => {
        initialValues[signal.signal_id] = signal.average ?? '';
      });

      const updatedForms = [...deviceForms];
      updatedForms[deviceIndex] = {
        sensor_id: selectedDeviceId,
        signals,
        signalValues: initialValues,
        empty: false,
      };
      setDeviceForms(updatedForms);
    } catch (err) {
      console.error('Errore nel recuperare segnali:', err);
      setSignals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSignalChange = (deviceIndex, signal_id, value) => {
    const updatedForms = [...deviceForms];
    updatedForms[deviceIndex].signalValues[signal_id] = value;
    setDeviceForms(updatedForms);
  };

  const handleAddSensorData = async () => {
    const validForms = deviceForms.filter(
      (df) => !df.empty && df.sensor_id && Object.values(df.signalValues).every((val) => val !== ''),
    );
    if (validForms.length === 0) {
      setMessage('⚠️ No valid device with sensor data to add.');
      return;
    }

    const allValid = deviceForms.every(
      (df) => df.sensor_id && Object.values(df.signalValues).every((val) => val !== ''),
    );

    if (!allValid) {
      setMessage('⚠️ Complete all fields before submitting.');
      return;
    }

    const formattedData = deviceForms.map((df) => ({
      SensorId: df.sensor_id,
      Signals: df.signalValues,
    }));

    onAddSensorData(formattedData);
    setMessage('✅ All sensor data added and ready for upload.');
  };

  return (
    <Card.Body>
      <div className="d-flex justify-content-center">
        <Button
          variant="success"
          onClick={handleAddDevice}
        >
          + Add Device
        </Button>
      </div>

      {deviceForms.map((deviceForm, index) => (
        <div
          key={index}
          className="border rounded p-3 mt-4"
        >
          <Form.Group
            controlId={`device-${index}`}
            className="d-flex align-items-center mb-3"
          >
            <Form.Label
              style={{ width: inputWidth }}
              className="me-3"
            >
              Select Device
            </Form.Label>
            <Form.Select
              onChange={(e) => handleDeviceSelect(index, e.target.value)}
              value={deviceForm.sensor_id}
            >
              <option value="">Select a device...</option>
              {devices.map((device) => (
                <option
                  key={device._id}
                  value={device._id}
                >
                  {device.description || device.label || 'Unnamed'}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          {loading && (
            <div style={{ color: 'grey' }}>
              <strong>Waiting...</strong> Retrieving sensor data.
            </div>
          )}

          {deviceForm.empty ? (
            <div className="text-danger mt-2">No sensor data available in the selected period.</div>
          ) : (
            deviceForm.signals.map((signal) => (
              <Form.Group
                key={signal.signal_id}
                className="d-flex align-items-center mb-3"
              >
                <Form.Label
                  style={{ width: inputWidth }}
                  className="me-3"
                >
                  {signal.signal_name}
                </Form.Label>
                <Form.Control
                  type="number"
                  onChange={(e) => handleSignalChange(signal.signal_id, e.target.value)}
                  value={deviceForm.signalValues[signal.signal_id]}
                  disabled
                />
              </Form.Group>
            ))
          )}
        </div>
      ))}

      <div className="d-flex justify-content-center mt-4">
        <Button
          variant="primary"
          onClick={handleAddSensorData}
          disabled={deviceForms.length === 0}
        >
          Add Sensor Data
        </Button>
      </div>

      {message && <p className="text-center mt-3 text-muted">{message}</p>}
    </Card.Body>
  );
};

export default AddSensorData;

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Button } from 'react-bootstrap';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const { token } = useParams(); // Ottieni il token dalla URL
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!password) {
      setMessage('Password is required');
      return;
    }

    try {
      const response = await fetch(`api/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      // Verifica se la risposta è OK
      if (response.ok) {
        // Se la risposta è OK, tenta di leggere il corpo della risposta in JSON
        const data = await response.json();

        // Controlla se il messaggio è 'Password updated successfully'
        if (data.message === 'Password updated successfully') {
          setMessage('Password updated successfully');
          setTimeout(() => navigate('/login'), 3000);
        } else {
          setMessage(data.message || 'Error updating password');
        }
      } else {
        // Se la risposta non è OK, mostra un messaggio di errore
        const data = await response.json();
        setMessage(data.message || 'Error updating password');
      }
    } catch (err) {
      setMessage('Error: ' + err.message);
    }
  };

  // Mostra il modulo solo se il token è valido
  useEffect(() => {
    const validateToken = async () => {
      try {
        const response = await fetch(`api/reset-password/${token}`);
        const data = await response.json();

        if (data.message === 'Token is valid, proceed with password reset') {
          setMessage(''); // Reset messaggio
        } else {
          setMessage(data.message);
        }
      } catch (err) {
        setMessage('Error: ' + err.message);
      }
    };

    validateToken();
  }, [token]);

  return (
    <div className="container mt-5">
      <h3>Reset Password</h3>
      {message === '' ? (
        <Form onSubmit={handleSubmit}>
          <Form.Group>
            <Form.Label>New Password</Form.Label>
            <Form.Control
              type="password"
              placeholder="Enter your new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Form.Group>
          <Button
            type="submit"
            className="mt-3"
          >
            Reset Password
          </Button>
        </Form>
      ) : (
        <div>{message}</div>
      )}
    </div>
  );
};

export default ResetPassword;

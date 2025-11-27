import React, { useState } from 'react';
import { Button, Form } from 'react-bootstrap';

const ChangePassword = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage('All fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('New passwords do not match.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('api/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccess(true);
        setMessage('Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setSuccess(false);
        setMessage(data.message || 'Error changing password.');
      }
    } catch (err) {
      setSuccess(false);
      setMessage('Error: ' + err.message);
    }
  };

  return (
    <div
      className="container mt-5"
      style={{ width: '50%' }}
    >
      <h3 style={{ marginTop: '2vw' }}>🔑 Change Password</h3>
      <br />
      <Form onSubmit={handleSubmit}>
        <Form.Group>
          <Form.Label>Current Password</Form.Label>
          <Form.Control
            type="password"
            placeholder="Enter your current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </Form.Group>
        <Form.Group className="mt-3">
          <Form.Label>New Password</Form.Label>
          <Form.Control
            type="password"
            placeholder="Enter your new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </Form.Group>
        <Form.Group className="mt-3">
          <Form.Label>Confirm New Password</Form.Label>
          <Form.Control
            type="password"
            placeholder="Confirm your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </Form.Group>
        <Button
          type="submit"
          className="mt-3"
        >
          Change Password
        </Button>
      </Form>
      {message && <div className={`mt-3 ${success ? 'text-success' : 'text-danger'}`}>{message}</div>}
    </div>
  );
};

export default ChangePassword;

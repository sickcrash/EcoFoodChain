import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SignUp = () => {
  const [email, setEmail] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [inviteToken, setInviteToken] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const getPlaceholder = () => {
    switch (role) {
      case 'producer':
        return 'Manufacturer Name';
      case 'operator':
        return 'Operator Name';
      default:
        return 'User Name';
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();

    if (role === 'producer' && !inviteToken) {
      setMessage('The invitation token is required for producers.');
      return;
    }

    try {
      const response = await axios.post('api/signup', {
        manufacturer,
        email,
        password,
        role,
        inviteToken: role === 'producer' ? inviteToken : null,
      });
      const data = response.data;

      alert('Registration successful!');
      navigate('/login');
    } catch (error) {
      if (error.response && error.response.data) {
        // Se il server ha restituito un messaggio di errore
        setMessage(error.response.data.message);
      } else {
        // Altrimenti, un errore generico
        setMessage('An error occurred. Please try again.');
      }
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div
          className="col-md-6"
          style={{ textAlign: 'center' }}
        >
          <br />
          <div className="card shadow">
            <div className="card-body">
              <h3 className="card-title">Sign Up</h3>
              <br />
              <form onSubmit={handleSignUp}>
                <div className="form-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder={getPlaceholder()}
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group mt-3">
                  <input
                    type="email"
                    className="form-control"
                    placeholder="E-mail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group mt-3">
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group mt-3">
                  <label>👷 Role:</label>
                  <select
                    className="form-control"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    required
                  >
                    <option value="producer">Producer</option>
                    <option value="operator">Operator</option>
                    <option value="user">User</option>
                  </select>
                </div>

                {role === 'producer' && (
                  <div className="form-group mt-3">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Invitation Token"
                      value={inviteToken}
                      onChange={(e) => setInviteToken(e.target.value)}
                      required
                    />
                  </div>
                )}
                <button
                  className="btn btn-primary mt-3 w-100"
                  type="submit"
                >
                  Sign Up
                </button>
              </form>
              {message && <p className="mt-3 text-muted">{message}</p>}
              <p className="mt-3">
                Already have an account?{' '}
                <span
                  onClick={() => navigate('/login')}
                  style={{ color: 'blue', cursor: 'pointer' }}
                >
                  Login
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
      <br />
    </div>
  );
};

export default SignUp;

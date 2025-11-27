import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = ({ setIsLoggedIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(''); // Nuovo stato per OTP
  const [message, setMessage] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false); // Stato per sapere se l'OTP è stato inviato
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // Richiesta di login
      const response = await axios.post('api/login', {
        email,
        password,
      });
      const data = response.data;

      if (response.status == 200 && !data.access_token) {
        setIsOtpSent(true);
        setMessage(
          "Login successful! Please enter the OTP sent to your email. Remember to check your spam folder if you can't find the email.",
        );
        return;
      }

      console.log('Response from login:', response.data); // LOG della risposta del server
      // Salviamo i dati nel localStorage
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('manufacturer', data.manufacturer);
      localStorage.setItem('email', data.email);
      // Store user ID for liked products
      localStorage.setItem('userId', data.email);
      localStorage.setItem('role', data.role);

      setIsLoggedIn(true);
      navigate('/account');
    } catch (error) {
      if (error.response && error.response.data) {
        setMessage(error.response.data.message);
      } else {
        setMessage('An error occurred. Please try again.');
      }
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    try {
      // Verifica dell'OTP
      const response = await axios.post('api/verify-otp', {
        email,
        otp: parseInt(otp, 10),
      });
      const data = response.data;

      if (data.message === 'OTP validated successfully.') {
        //prima era if (data success)
        // Se OTP è corretto, redirigiamo l'utente
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('manufacturer', data.manufacturer);
        localStorage.setItem('email', data.email);
        // Store user ID for liked products
        localStorage.setItem('userId', data.email);
        localStorage.setItem('role', data.role);

        setIsLoggedIn(true);
        navigate('/account');
      } else {
        setMessage('Invalid OTP. Please try again.');
      }
    } catch (error) {
      setMessage('An error occurred while verifying the OTP.');
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
              <h3 className="card-title">Login</h3>
              <br />
              {/* Form per Login */}
              {!isOtpSent ? (
                <form onSubmit={handleLogin}>
                  <div className="form-group">
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
                      id="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    className="btn btn-primary mt-3 w-100"
                    type="submit"
                  >
                    Login
                  </button>
                </form>
              ) : (
                // Form per OTP
                <form onSubmit={handleOtpSubmit}>
                  <div className="form-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    className="btn btn-primary mt-3 w-100"
                    type="submit"
                  >
                    Verify OTP
                  </button>
                </form>
              )}

              <p className="mt-3">
                Don’t have an account?{' '}
                <span
                  onClick={() => navigate('/signup')}
                  style={{ color: 'blue', cursor: 'pointer' }}
                >
                  Sign Up
                </span>
              </p>

              {message && <p className="mt-3 text-muted">{message}</p>}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: '2vw',
                }}
              >
                <p className="mt-3">
                  <span
                    onClick={() => navigate('/forgot-password')}
                    style={{ color: 'darkgrey', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    🫣 Forgot your password?
                  </span>
                </p>
                <p className="mt-3">
                  <span
                    onClick={() => navigate('/scan-product')}
                    style={{
                      color: 'darkgrey',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    🔓 Continue without logging in
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p
        className="mt-3"
        style={{ textDecoration: 'underline', color: 'grey', paddingTop: '3vw' }}
      >
        <span
          onClick={() => navigate('/about')}
          style={{ color: 'darkgrey', cursor: 'pointer', textDecoration: 'underline' }}
        >
          ⚠️ Disclaimer & Info
        </span>
      </p>
    </div>
  );
};

export default Login;

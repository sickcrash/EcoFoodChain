import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';

function Navbar() {
  const [role, setRole] = useState(undefined);
  const [isProducer, setIsProducer] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 960);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 960);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setRole(localStorage.getItem('role'));
    console.log(localStorage.getItem('role'));
    if (localStorage.getItem('role') === 'producer' || localStorage.getItem('role') === 'operator') {
      setIsProducer(true);
    }
  }, []);

  return isMobile ? <MobileNavbar isProducer={isProducer} /> : <DesktopNavbar isProducer={isProducer} />;
}

function DesktopNavbar({ isProducer }) {
  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        width: '100%',
        top: 0,
        zIndex: 1000,
      }}
    >
      {/* Logo a sinistra */}
      <div
        style={{
          position: 'absolute',
        }}
      >
        <img
          src={require('../../assets/logo_filiera360.png')}
          style={{
            width: '6vw',
          }}
          alt="Logo"
        />
      </div>

      {/* Icone di navigazione */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '3rem',
          width: '100%',
        }}
      >
        {isProducer && (
          <NavItem
            to="/add-product"
            icon="add-circle-outline"
            label="Add"
          />
        )}
        <NavItem
          to="/scan-product"
          icon="scan-outline"
          label="Scan Product"
        />
        <NavItem
          to="/account"
          icon="person-circle-outline"
          label="Account"
        />
      </div>
    </nav>
  );
}

function MobileNavbar({ isProducer }) {
  return (
    <>
      {/* Logo in alto */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          textAlign: 'center',
          backgroundColor: '#ffffff',
          padding: '0.5rem 0',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
        }}
      >
        <img
          src={require('../../assets/logo_filiera360.png')}
          style={{ width: '25%', maxWidth: '120px' }}
          alt="Logo"
        />
      </div>

      {/* Contenuto che si sposta in basso per evitare sovrapposizione con la navbar mobile */}
      <div
        style={{
          marginTop: '75px',
          paddingBottom: '10px',
        }}
      >
        {}
      </div>

      {/* Navbar in basso */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: '100%',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          backgroundColor: '#f8f9fa',
          boxShadow: '0 -4px 8px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
        }}
      >
        {isProducer && (
          <NavItem
            to="/add-product"
            icon="add-circle-outline"
            label="Add"
          />
        )}
        <NavItem
          to="/scan-product"
          icon="scan-outline"
          label="Scan"
        />
        <NavItem
          to="/account"
          icon="person-circle-outline"
          label="Account"
        />
      </nav>
    </>
  );
}

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textDecoration: 'none',
        color: isActive ? '#007bff' : '#6c757d',
        transition: 'color 0.3s ease',
      })}
    >
      <ion-icon
        name={icon}
        style={{ fontSize: '24px', marginBottom: '4px' }}
      ></ion-icon>
      <span style={{ fontSize: '12px' }}>{label}</span>
    </NavLink>
  );
}

export default Navbar;

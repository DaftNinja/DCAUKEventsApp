import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../api';
import './Navbar.css';

export default function Navbar({
  showBack  = false,
  backTo    = '/events',
  backLabel = '← Back to Events',
  hideNav   = false,
}) {
  const navigate = useNavigate();
  const role    = localStorage.getItem('role') || 'member';
  const isAdmin = role === 'admin';
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    localStorage.removeItem('role');
    navigate('/');
  }

  function go(path) {
    setMenuOpen(false);
    navigate(path);
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="navbar-left">
          <button className="navbar-logo" onClick={() => navigate('/')}>
            <img src="/logo.png" alt="theventguide.com" className="navbar-logo-img" />
          </button>
          {showBack && (
            <button className="navbar-back" onClick={() => navigate(backTo)}>
              {backLabel}
            </button>
          )}
        </div>

        {!hideNav && (
          <>
            {/* Desktop nav */}
            <div className="navbar-right navbar-desktop">
              <button className="navbar-link" onClick={() => navigate('/events')}>Events</button>
              <button className="navbar-link" onClick={() => navigate('/events/past')}>Past Events</button>
              <button className="navbar-link" onClick={() => navigate('/news')}>News</button>
              <button className="navbar-link" onClick={() => navigate('/groups')}>Groups</button>
              <button className="navbar-link" onClick={() => navigate('/members')}>Members</button>
              <button className="navbar-link navbar-submit" onClick={() => navigate('/events/submit')}>+ Submit event</button>
              {isAdmin && (
                <button className="navbar-link navbar-admin" onClick={() => navigate('/admin')}>Admin</button>
              )}
              <button className="navbar-link" onClick={() => navigate('/profile')}>My Profile</button>
              <button className="navbar-link navbar-signout" onClick={handleLogout}>Sign out</button>
            </div>

            {/* Hamburger button (mobile) */}
            <button
              className={`navbar-hamburger ${menuOpen ? 'open' : ''}`}
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Menu"
            >
              <span /><span /><span />
            </button>
          </>
        )}
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <>
          <div className="navbar-overlay" onClick={() => setMenuOpen(false)} />
          <div className="navbar-mobile-menu">
            <button className="navbar-mobile-link" onClick={() => go('/events')}>Events</button>
            <button className="navbar-mobile-link" onClick={() => go('/events/past')}>Past Events</button>
            <button className="navbar-mobile-link" onClick={() => go('/news')}>News</button>
            <button className="navbar-mobile-link" onClick={() => go('/groups')}>Groups</button>
            <button className="navbar-mobile-link" onClick={() => go('/members')}>Members</button>
            <button className="navbar-mobile-link navbar-submit" onClick={() => go('/events/submit')}>+ Submit event</button>
            {isAdmin && (
              <button className="navbar-mobile-link navbar-admin" onClick={() => go('/admin')}>Admin</button>
            )}
            <button className="navbar-mobile-link" onClick={() => go('/profile')}>My Profile</button>
            <button className="navbar-mobile-link navbar-mobile-signout" onClick={handleLogout}>Sign out</button>
          </div>
        </>
      )}
    </nav>
  );
}

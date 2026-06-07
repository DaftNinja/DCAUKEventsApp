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
    setMenuOpen(false);
  }

  function go(path) {
    navigate(path);
    setMenuOpen(false);
  }

  const navItems = [
    { label: 'Events',         path: '/events' },
    { label: 'News',           path: '/news' },
    { label: 'Groups',         path: '/groups' },
    { label: 'Members',        path: '/members' },
    { label: '+ Submit event', path: '/events/submit', className: 'navbar-submit' },
    ...(isAdmin ? [{ label: 'Admin', path: '/admin', className: 'navbar-admin' }] : []),
    { label: 'My Profile',     path: '/profile' },
  ];

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="navbar-left">
            <button className="navbar-logo" onClick={() => go('/')}>
              DCA<span>UK</span>
            </button>
            {showBack && !menuOpen && (
              <button className="navbar-back" onClick={() => go(backTo)}>
                {backLabel}
              </button>
            )}
          </div>

          {!hideNav && (
            <>
              {/* Desktop nav */}
              <div className="navbar-right navbar-desktop">
                {navItems.map(item => (
                  <button
                    key={item.path}
                    className={`navbar-link ${item.className || ''}`}
                    onClick={() => go(item.path)}
                  >
                    {item.label}
                  </button>
                ))}
                <button className="navbar-link navbar-signout" onClick={handleLogout}>
                  Sign out
                </button>
              </div>

              {/* Hamburger button — mobile only */}
              <button
                className={`navbar-hamburger ${menuOpen ? 'open' : ''}`}
                onClick={() => setMenuOpen(o => !o)}
                aria-label="Toggle menu"
              >
                <span />
                <span />
                <span />
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Mobile slide-down menu */}
      {!hideNav && menuOpen && (
        <div className="navbar-mobile-menu">
          {navItems.map(item => (
            <button
              key={item.path}
              className={`navbar-mobile-link ${item.className || ''}`}
              onClick={() => go(item.path)}
            >
              {item.label}
            </button>
          ))}
          <button className="navbar-mobile-link navbar-mobile-signout" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      )}

      {/* Overlay to close menu on tap outside */}
      {menuOpen && (
        <div className="navbar-overlay" onClick={() => setMenuOpen(false)} />
      )}
    </>
  );
}

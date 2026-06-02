import { useNavigate } from 'react-router-dom';
import { logout } from '../api';
import './Navbar.css';

export default function Navbar({ showBack = false, backTo = '/events', backLabel = '← Back to Events', hideNav = false }) {
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="navbar-left">
          <button className="navbar-logo" onClick={() => navigate('/')}>
            DCA<span>UK</span>
          </button>
          {showBack && (
            <button className="navbar-back" onClick={() => navigate(backTo)}>
              {backLabel}
            </button>
          )}
        </div>

        {!hideNav && (
          <div className="navbar-right">
            <button className="navbar-link" onClick={() => navigate('/events')}>
              Events
            </button>
            <button className="navbar-link" onClick={() => navigate('/members')}>
              Members
            </button>
            <button className="navbar-link navbar-submit" onClick={() => navigate('/events/submit')}>
              + Submit event
            </button>
            <button className="navbar-link" onClick={() => navigate('/profile')}>
              My Profile
            </button>
            <button className="navbar-link navbar-signout" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

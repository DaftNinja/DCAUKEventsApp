import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const userId = searchParams.get('userId');

    if (token && userId) {
      // Store token in localStorage
      localStorage.setItem('authToken', token);
      localStorage.setItem('userId', userId);
      
      console.log('✓ Auth successful, redirecting to events...');
      // Redirect to events page
      navigate('/events', { replace: true });
    } else {
      setError('Missing auth token');
      setTimeout(() => navigate('/', { replace: true }), 2000);
    }
  }, [searchParams, navigate]);

  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      {error ? (
        <div>
          <h1>❌ Auth Error</h1>
          <p>{error}</p>
          <p>Redirecting...</p>
        </div>
      ) : (
        <div>
          <h1>✓ Logging you in...</h1>
          <p>Redirecting to events...</p>
        </div>
      )}
    </div>
  );
}

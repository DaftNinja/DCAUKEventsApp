import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const userId = searchParams.get('userId');

    if (token && userId) {
      localStorage.setItem('token', token);
      localStorage.setItem('userId', userId);
      navigate('/events');
    } else {
      navigate('/');
    }
  }, [navigate, searchParams]);

  return (
    <div className="auth-loading">
      <p>Signing you in...</p>
    </div>
  );
}

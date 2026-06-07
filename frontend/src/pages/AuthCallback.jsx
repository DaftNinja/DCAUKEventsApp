import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function AuthCallback({ setIsAuthenticated }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token  = searchParams.get("token");
    const userId = searchParams.get("userId");
    const role   = searchParams.get("role") || "member";

    if (token && userId) {
      localStorage.setItem("token",  token);
      localStorage.setItem("userId", userId);
      localStorage.setItem("role",   role);

      if (setIsAuthenticated) setIsAuthenticated(true);

      setTimeout(() => {
        navigate("/events", { replace: true });
      }, 50);
    } else {
      console.error("❌ No token or userId in URL");
      setTimeout(() => navigate("/", { replace: true }), 50);
    }
  }, [searchParams, navigate, setIsAuthenticated]);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white",
      fontSize: "1.2em"
    }}>
      ✓ You're logged in. Redirecting...
    </div>
  );
}

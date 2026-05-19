import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function AuthCallback({ setIsAuthenticated }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const userId = searchParams.get("userId");

    if (token && userId) {
      console.log("✓ Token from URL:", token.substring(0, 20) + "...");
      console.log("✓ UserId from URL:", userId);

      // Store token and user ID
      localStorage.setItem("token", token);
      localStorage.setItem("userId", userId);
      
      console.log("✓ Saved to localStorage");

      // Update parent component state
      if (setIsAuthenticated) {
        setIsAuthenticated(true);
      }

      // Navigate to events after a brief delay to ensure state updates
      setTimeout(() => {
        console.log("🔀 Navigating to /events");
        navigate("/events", { replace: true });
      }, 50);
    } else {
      console.error("❌ No token or userId in URL");
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 50);
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

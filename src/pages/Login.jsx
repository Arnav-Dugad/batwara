import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function Login() {
  const navigate = useNavigate();

  // If user is already logged in, skip login page
  useEffect(() => {
    if (auth.currentUser) {
        navigate("/dashboard", { replace: true });
    }
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      // Determine destination: If they have a group, dashboard. If not, setup.
      // We'll let the Main App router handle that logic for simplicity
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-dark p-6">
      <div className="w-20 h-20 bg-brand rounded-3xl flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(28,194,159,0.2)] animate-pulse">
        <span className="text-4xl">💸</span>
      </div>
      <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Batwara</h1>
      <p className="text-gray-400 mb-12 text-lg">Split bills, keep friends.</p>
      
      <button 
        onClick={handleLogin}
        className="w-full max-w-xs bg-white text-gray-900 font-bold py-4 rounded-xl flex items-center justify-center gap-3 hover:scale-105 transition-transform shadow-xl"
      >
        <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="G" />
        Continue with Google
      </button>
    </div>
  );
}
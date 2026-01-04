import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Loader2 } from "lucide-react";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import GroupSetup from "./pages/GroupSetup";
import AddExpense from "./pages/AddExpense";
import Settings from "./pages/Settings";
import Balances from "./pages/Balances";
import SettleUp from "./pages/SettleUp";
import ExpenseDetails from "./pages/ExpenseDetails";
import MonthlySummary from "./pages/MonthlySummary"; // NEW PAGE

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#121212] text-[#1cc29f]"><Loader2 className="animate-spin" size={40}/></div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
        
        {/* Protected Routes */}
        <Route path="/setup" element={user ? <GroupSetup /> : <Navigate to="/" />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" />} />
        <Route path="/add-expense" element={user ? <AddExpense /> : <Navigate to="/" />} />
        <Route path="/settings" element={user ? <Settings /> : <Navigate to="/" />} />
        <Route path="/balances" element={user ? <Balances /> : <Navigate to="/" />} />
        <Route path="/settle-up" element={user ? <SettleUp /> : <Navigate to="/" />} />
        <Route path="/expense/:id" element={user ? <ExpenseDetails /> : <Navigate to="/" />} />
        <Route path="/monthly" element={user ? <MonthlySummary /> : <Navigate to="/" />} /> {/* NEW */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
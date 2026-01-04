import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, query, where, getDocs, doc, getDoc, orderBy } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, TrendingUp, PieChart, Loader2 } from "lucide-react";

export default function MonthlySummary() {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        if (!user) return;
        try {
            const uDoc = await getDoc(doc(db, "users", user.uid));
            if (!uDoc.exists() || !uDoc.data().groupId) { navigate("/setup"); return; }
            const groupId = uDoc.data().groupId;

            // Fetch All Expenses
            const q = query(collection(db, "expenses"), where("groupId", "==", groupId), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            const expenses = snap.docs.map(d => d.data());

            // Process Data
            const stats = {}; // "Jan 2024": { total: 0, myShare: 0, categories: {} }

            expenses.forEach(exp => {
                if (exp.category === 'payment') return;
                
                const date = exp.createdAt?.toDate ? exp.createdAt.toDate() : new Date();
                const key = date.toLocaleString('default', { month: 'long', year: 'numeric' });
                
                if (!stats[key]) stats[key] = { total: 0, myShare: 0, categories: {} };
                
                // Add to Total
                stats[key].total += exp.amount;

                // Add to Category
                const cat = exp.category || 'other';
                stats[key].categories[cat] = (stats[key].categories[cat] || 0) + exp.amount;

                // Calculate My Share
                let mySplit = 0;
                if (exp.splitType === 'equal' || !exp.splitType) {
                    // Estimate share based on split details presence or fall back to generic logic
                    // Note: For perfect accuracy, we'd need historic group size, but this is a good approximation
                    const count = Object.keys(exp.splitDetails || {}).length || 1; 
                    // If splitDetails is empty (old 'equal' logic), we assume equal split implies user is included
                    mySplit = exp.amount / (count > 0 ? count : 1); 
                } else {
                    mySplit = parseFloat(exp.splitDetails?.[user.uid] || 0);
                }
                stats[key].myShare += mySplit;
            });

            setSummary(Object.entries(stats));
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchData();
  }, [user, navigate]);

  if (loading) return <div className="min-h-screen bg-dark flex items-center justify-center text-brand"><Loader2 className="animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-dark text-white p-4 font-sans">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)}><ArrowLeft /></button>
        <h1 className="text-xl font-bold">Monthly Summary</h1>
      </div>

      <div className="space-y-6">
        {summary.length === 0 ? (
            <div className="text-center text-gray-500 py-10">No expenses recorded yet.</div>
        ) : (
            summary.map(([month, data]) => (
                <div key={month} className="bg-card p-5 rounded-2xl border border-gray-800">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="text-brand" size={20}/>
                            <h2 className="text-lg font-bold">{month}</h2>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-400">Total Spent</p>
                            <p className="text-xl font-bold">₹{data.total.toFixed(0)}</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-4 bg-gray-800/50 p-3 rounded-xl">
                        <span className="text-sm text-gray-300">Your Share</span>
                        <span className="font-bold text-brand">₹{data.myShare.toFixed(0)}</span>
                    </div>

                    <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Top Categories</p>
                        <div className="space-y-2">
                            {Object.entries(data.categories)
                                .sort((a,b) => b[1] - a[1]) // Sort highest spend first
                                .slice(0, 3) // Show top 3
                                .map(([cat, amt]) => (
                                    <div key={cat} className="flex justify-between text-sm">
                                        <span className="capitalize text-gray-400 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-gray-600"></div> {cat}
                                        </span>
                                        <span>₹{amt.toFixed(0)}</span>
                                    </div>
                            ))}
                        </div>
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
}
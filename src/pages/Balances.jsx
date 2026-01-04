import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

export default function Balances() {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const calculateDebts = async () => {
      if (!user) return;
      try {
        const uDoc = await getDoc(doc(db, "users", user.uid));
        if (!uDoc.exists() || !uDoc.data().groupId) { setLoading(false); return; }
        const groupId = uDoc.data().groupId;
        
        // Fetch Expenses First
        const q = query(collection(db, "expenses"), where("groupId", "==", groupId));
        const snap = await getDocs(q);
        const expenses = snap.docs.map(d => d.data());

        // Collect all IDs
        const groupDoc = await getDoc(doc(db, "groups", groupId));
        const uniqueIds = new Set(groupDoc.exists() ? groupDoc.data().members : []);
        expenses.forEach(e => {
            if(e.paidBy) uniqueIds.add(e.paidBy);
            if(e.paidTo) uniqueIds.add(e.paidTo);
            if(e.splitDetails) Object.keys(e.splitDetails).forEach(k => uniqueIds.add(k));
        });

        // Fetch Names
        const userMap = {}; 
        await Promise.all([...uniqueIds].map(async (uid) => {
            if (uid === user.uid) { userMap[uid] = "You"; return; }
            const s = await getDoc(doc(db, "users", uid));
            userMap[uid] = s.exists() ? (s.data().displayName || "Unknown") : "Unknown";
        }));

        // Calculate Balances
        const balances = {}; 
        uniqueIds.forEach(id => balances[id] = 0);

        expenses.forEach(exp => {
            const amount = parseFloat(exp.amount) || 0;
            if (exp.category === 'payment') {
                balances[exp.paidBy] += amount; 
                balances[exp.paidTo] -= amount; 
            } else {
                balances[exp.paidBy] += amount; 
                const splitMap = {};
                if (exp.splitType === 'equal' || !exp.splitType) {
                    // Fallback to expense participants if group size unknown (rare)
                    const count = groupDoc.exists() ? groupDoc.data().members.length : 1;
                    const share = amount / count;
                    if(groupDoc.exists()) groupDoc.data().members.forEach(id => splitMap[id] = share);
                } else {
                    Object.assign(splitMap, exp.splitDetails || {});
                }
                
                Object.entries(splitMap).forEach(([uid, share]) => {
                    balances[uid] -= parseFloat(share);
                });
            }
        });

        // Simplify Graph
        const debtors = []; const creditors = [];
        Object.entries(balances).forEach(([uid, amount]) => { if (amount < -0.01) debtors.push({ uid, amt: amount }); if (amount > 0.01) creditors.push({ uid, amt: amount }); });
        
        const transactions = []; 
        let i = 0; let j = 0; 

        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i]; 
            const creditor = creditors[j]; 
            const amount = Math.min(Math.abs(debtor.amt), creditor.amt);
            
            transactions.push({ 
                from: userMap[debtor.uid] || "Unknown", 
                to: userMap[creditor.uid] || "Unknown", 
                amount: amount, 
                isMeFrom: debtor.uid === user.uid, 
                isMeTo: creditor.uid === user.uid 
            });
            
            debtor.amt += amount; 
            creditor.amt -= amount;
            if (Math.abs(debtor.amt) < 0.01) i++; if (creditor.amt < 0.01) j++;
        }
        setDebts(transactions);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    calculateDebts();
  }, [user]);

  if (loading) return <div className="min-h-screen bg-dark flex items-center justify-center text-brand"><Loader2 className="animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-dark text-white p-4 font-sans">
      <div className="flex items-center gap-4 mb-8"><button onClick={() => navigate(-1)}><ArrowLeft /></button><h1 className="text-xl font-bold">Balances</h1></div>
      <div className="space-y-4">{debts.length === 0 ? <div className="text-center py-20 text-gray-500"><p>No debts found.</p></div> : debts.map((t, i) => (<div key={i} className="bg-card p-4 rounded-xl border border-gray-800 flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold text-gray-400 text-xs">{(t.from || "?")[0]}</div><div><p className="font-bold text-white">{t.isMeFrom ? "You" : t.from}</p><p className="text-xs text-danger uppercase font-bold">Owes</p></div></div><div className="flex flex-col items-center"><span className="text-xs text-gray-500 mb-1">pays</span><ArrowRight size={16} className="text-gray-600"/></div><div className="flex items-center gap-3 text-right"><div><p className="font-bold text-white">{t.isMeTo ? "You" : t.to}</p><p className="font-bold text-brand">₹{t.amount.toFixed(0)}</p></div><div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold text-gray-400 text-xs">{(t.to || "?")[0]}</div></div></div>))}</div>
    </div>
  );
}
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { ArrowLeft, Trash2, Calendar, User, CheckCircle2, Loader2 } from "lucide-react";

export default function ExpenseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expense, setExpense] = useState(null);
  const [memberNames, setMemberNames] = useState({});
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;

  useEffect(() => {
    const fetchExpenseAndMembers = async () => {
      try {
        const docRef = doc(db, "expenses", id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const expData = { id: docSnap.id, ...docSnap.data() };
          setExpense(expData);
          
          if (expData.groupId) {
             const gDoc = await getDoc(doc(db, "groups", expData.groupId));
             if (gDoc.exists()) {
                 const members = gDoc.data().members || [];
                 const names = {};
                 await Promise.all(members.map(async (uid) => {
                     if (uid === user.uid) {
                         names[uid] = "You";
                     } else {
                         const uSnap = await getDoc(doc(db, "users", uid));
                         names[uid] = uSnap.exists() ? (uSnap.data().displayName || "Unknown") : "Unknown";
                     }
                 }));
                 setMemberNames(names);
             }
          }
        } else {
          alert("Expense not found!");
          navigate(-1);
        }
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchExpenseAndMembers();
  }, [id, navigate]);

  const handleDelete = async () => {
    if (window.confirm("Delete this expense?")) {
      await deleteDoc(doc(db, "expenses", id));
      navigate(-1);
    }
  };

  if (loading) return <div className="h-screen bg-dark flex items-center justify-center text-brand"><Loader2 className="animate-spin"/></div>;

  const date = expense?.createdAt?.toDate ? expense.createdAt.toDate().toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' }) : "Recently";
  const time = expense?.createdAt?.toDate ? expense.createdAt.toDate().toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' }) : "";

  return (
    <div className="min-h-screen bg-dark text-white p-4 font-sans">
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigate(-1)}><ArrowLeft className="text-white" /></button>
        <h2 className="text-lg font-semibold">Expense Details</h2>
        <button onClick={handleDelete} className="text-danger p-2 hover:bg-red-900/20 rounded-full"><Trash2 size={20} /></button>
      </div>

      <div className="bg-card p-6 rounded-2xl border border-gray-800 mb-6 relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 p-4 opacity-10"><h1 className="text-9xl font-bold text-white">₹</h1></div>
        <div className="flex items-start gap-4 mb-4">
            <div className="bg-gray-800 p-3 rounded-xl"><div className="w-10 h-10 flex items-center justify-center text-2xl font-bold text-brand uppercase">{(expense.description || "?")[0]}</div></div>
            <div><h1 className="text-2xl font-bold capitalize">{expense.description}</h1><p className="text-3xl font-bold text-brand mt-1">₹{expense.amount}</p></div>
        </div>
        <div className="flex items-center gap-2 text-gray-400 text-sm border-t border-gray-800 pt-4"><span className="bg-gray-800 px-2 py-1 rounded text-xs uppercase font-bold tracking-wider text-white">{expense.category}</span><span className="flex items-center gap-1"><Calendar size={12}/> {date} at {time}</span></div>
      </div>

      <div className="mb-6">
        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 px-1">Payer</h3>
        <div className="bg-card p-4 rounded-xl border border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3"><div className="bg-emerald-900/30 p-2 rounded-full text-brand"><User size={20}/></div><div><p className="font-bold text-white">{expense.paidBy === user.uid ? "You" : (memberNames[expense.paidBy] || expense.paidByName)}</p><p className="text-xs text-gray-400">paid full amount</p></div></div>
            <span className="font-bold text-brand">₹{expense.amount}</span>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 px-1">Split Breakdown</h3>
        <div className="bg-card rounded-xl border border-gray-800 overflow-hidden">
            {(!expense.splitType || expense.splitType === 'equal') ? (
                <div className="p-6 text-center text-gray-400 text-sm"><CheckCircle2 className="mx-auto mb-2 text-gray-600"/>Split equally among all members.</div>
            ) : (
                <div className="divide-y divide-gray-800">
                    {Object.entries(expense.splitDetails || {}).map(([uid, amount]) => {
                        const name = memberNames[uid] || "Unknown";
                        return (
                            <div key={uid} className="p-4 flex justify-between items-center">
                                <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">{(name || "?")[0]}</div><span className="text-gray-300 font-medium">{name}</span></div>
                                <span className="font-bold text-danger">- ₹{parseFloat(amount).toFixed(2)}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, onSnapshot, orderBy, where, doc, getDoc } from 'firebase/firestore'; // Removed limit for accurate math
import { Plus, ShoppingCart, Settings as SettingsIcon, TrendingUp, Banknote, AlertCircle, MessageCircle, Calendar, ChevronRight, Loader2 } from 'lucide-react'; 
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [expenses, setExpenses] = useState([]);
  const [groupData, setGroupData] = useState(null);
  const [memberNames, setMemberNames] = useState({});
  const [myDebts, setMyDebts] = useState([]); 
  const [monthlyStats, setMonthlyStats] = useState({ spent: 0, share: 0 });
  const [netBalance, setNetBalance] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;
  const navigate = useNavigate();

  // 1. Fetch Data Listeners
  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().groupId) {
          const groupId = userDoc.data().groupId;
          
          // Listener A: Group Data
          onSnapshot(doc(db, "groups", groupId), (doc) => { 
              if(doc.exists()) setGroupData({ id: doc.id, ...doc.data() }); 
          });
          
          // Listener B: All Expenses
          const q = query(
             collection(db, "expenses"), 
             where("groupId", "==", groupId), 
             orderBy("createdAt", "desc")
          );
          
          onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({id: d.id, ...d.data()}));
            setExpenses(list);
            setLoading(false);
          });
        } else { 
          navigate("/setup"); 
        }
      } catch (err) { 
        console.error(err); 
        setLoading(false); 
      }
    };
    fetchData();
  }, [user, navigate]);

  // 2. Math & Name Calculation (Runs whenever Expenses or Group Data updates)
  useEffect(() => {
      if (!user || expenses.length === 0 || !groupData) return;

      const runMath = async () => {
          // --- A. Fetch Missing Names ---
          const uniqueIds = new Set(groupData.members || []);
          expenses.forEach(e => {
              if(e.paidBy) uniqueIds.add(e.paidBy);
              if(e.paidTo) uniqueIds.add(e.paidTo);
              if(e.splitDetails) Object.keys(e.splitDetails).forEach(k => uniqueIds.add(k));
          });

          const names = { ...memberNames };
          let newNamesFound = false;
          
          await Promise.all([...uniqueIds].map(async (uid) => {
              if (!names[uid]) {
                  newNamesFound = true;
                  if(uid === user.uid) names[uid] = "You";
                  else {
                      const s = await getDoc(doc(db, "users", uid));
                      names[uid] = s.exists() ? (s.data().displayName || "Unknown") : "Unknown";
                  }
              }
          }));
          if (newNamesFound) setMemberNames(names);

          // --- B. Calculate Math ---
          calculateMath(expenses, names);
      };

      runMath();
  }, [expenses, groupData, user]); // Dependency Array ensures this runs only when data is ready

  const calculateMath = (data, names) => {
      const myUid = user.uid;
      
      // Global Totals for "Total Net Balance" formula
      let totalPaid = 0;     // Money I put into the system
      let totalReceived = 0; // Money I took out (payments received)
      let totalMyShare = 0;  // Value I consumed (my share of expenses)

      // Graph for "Detailed Balances" list
      const balances = {}; 
      // Initialize all known members to 0
      const allMembers = groupData?.members || [];
      allMembers.forEach(id => balances[id] = 0);

      // Monthly Stats
      let mSpent = 0;
      let mShare = 0;
      const now = new Date();

      data.forEach(exp => {
          const amount = parseFloat(exp.amount) || 0;
          const payer = exp.paidBy;
          
          // 1. Total Balance Logic
          if (payer === myUid) totalPaid += amount;
          
          if (exp.category === 'payment') {
              if (exp.paidTo === myUid) totalReceived += amount;
          } else {
              // Calculate My Share
              let myShareOfExp = 0;
              if (exp.splitType === 'equal' || !exp.splitType) {
                  const count = (groupData?.members?.length) || 1; // Default to actual group size
                  myShareOfExp = amount / count;
              } else {
                  myShareOfExp = parseFloat(exp.splitDetails?.[myUid] || 0);
              }
              totalMyShare += myShareOfExp;
          }

          // 2. Monthly Stats
          if (exp.category !== 'payment') {
              const date = exp.createdAt?.toDate ? exp.createdAt.toDate() : new Date();
              if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
                  mSpent += amount;
                  let mExpShare = 0;
                  if (exp.splitType === 'equal' || !exp.splitType) {
                      mExpShare = amount / (groupData?.members?.length || 1);
                  } else {
                      mExpShare = parseFloat(exp.splitDetails?.[myUid] || 0);
                  }
                  mShare += mExpShare;
              }
          }

          // 3. Graph/List Logic (Who owes whom)
          if (exp.category === 'payment') {
              balances[exp.paidBy] = (balances[exp.paidBy] || 0) + amount;
              balances[exp.paidTo] = (balances[exp.paidTo] || 0) - amount;
          } else {
              balances[exp.paidBy] = (balances[exp.paidBy] || 0) + amount;
              const splitMap = {};
              if (exp.splitType === 'equal' || !exp.splitType) {
                  const count = groupData?.members?.length || 1;
                  const share = amount / count;
                  (groupData?.members || []).forEach(uid => splitMap[uid] = share);
              } else {
                  Object.assign(splitMap, exp.splitDetails || {});
              }
              Object.entries(splitMap).forEach(([uid, share]) => {
                  balances[uid] = (balances[uid] || 0) - parseFloat(share);
              });
          }
      });

      // Final Calculation: (Paid - Received) - Consumed
      const calculatedNet = totalPaid - totalReceived - totalMyShare;
      setNetBalance(calculatedNet);
      setMonthlyStats({ spent: mSpent, share: mShare });

      // Simplify Graph for Display
      const debtors = [];
      const creditors = [];
      Object.entries(balances).forEach(([uid, amt]) => {
          if (amt < -0.01) debtors.push({ uid, amt });
          if (amt > 0.01) creditors.push({ uid, amt });
      });

      const transactions = [];
      let i = 0; let j = 0;
      while (i < debtors.length && j < creditors.length) {
          const debtor = debtors[i];
          const creditor = creditors[j];
          const amount = Math.min(Math.abs(debtor.amt), creditor.amt);
          transactions.push({ from: debtor.uid, to: creditor.uid, amount });
          debtor.amt += amount; creditor.amt -= amount;
          if (Math.abs(debtor.amt) < 0.01) i++;
          if (creditor.amt < 0.01) j++;
      }

      // Filter for ME
      const myTrans = transactions
        .filter(t => t.from === myUid || t.to === myUid)
        .map(t => ({
            otherUid: t.from === myUid ? t.to : t.from,
            type: t.from === myUid ? 'owe' : 'owed',
            amount: t.amount
        }));
      setMyDebts(myTrans);
  };

  const sendReminder = (amt, name) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`Hey ${name}! You owe me ₹${amt.toFixed(0)} on Batwara.`)}`, '_blank');
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-dark text-brand animate-pulse"><Loader2 className="animate-spin mr-2"/> Loading...</div>;

  return (
    <div className="max-w-md mx-auto min-h-screen pb-24 font-sans bg-dark text-white">
      {/* Header */}
      <div className="p-4 pt-6 bg-dark sticky top-0 z-20 border-b border-gray-800 shadow-md">
        <div className="flex justify-between items-center mb-4">
            <div>
                <h1 className="text-xl font-bold truncate max-w-[200px]">{groupData?.name || "My Flat"}</h1>
                <p className="text-xs text-gray-500">Code: <span className="font-mono text-brand">{groupData?.id}</span></p>
            </div>
            <button onClick={() => navigate('/settings')} className="p-2 bg-card rounded-full border border-gray-700 hover:bg-gray-800"><SettingsIcon size={20} className="text-gray-400" /></button>
        </div>

        {/* Total Balance Card */}
        <div className="mb-4 bg-card/50 p-5 rounded-2xl border border-gray-800 backdrop-blur-sm">
            <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Total Net Balance</span>
            <div className="mt-1">
                {Math.abs(netBalance) < 1 ? (
                    <span className="text-3xl font-bold text-gray-300">Settled up! ✅</span>
                ) : netBalance < 0 ? (
                    <div>
                        <span className="text-3xl font-bold text-danger">You owe ₹{Math.abs(netBalance).toFixed(0)}</span>
                        <p className="text-xs text-gray-500 mt-1">overall across all friends</p>
                    </div>
                ) : (
                    <div>
                        <span className="text-3xl font-bold text-brand">You are owed ₹{netBalance.toFixed(0)}</span>
                        <p className="text-xs text-gray-500 mt-1">overall across all friends</p>
                    </div>
                )}
            </div>
        </div>
        
        <div className="flex gap-3">
            <button onClick={() => navigate('/settle-up')} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all active:scale-95">Settle up</button>
            <button onClick={() => navigate('/balances')} className="flex-1 bg-card hover:bg-gray-800 text-white font-bold py-3 rounded-xl border border-gray-700 transition-all">Balances</button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        
        {/* Monthly Link */}
        <button onClick={() => navigate('/monthly')} className="w-full bg-gradient-to-r from-gray-900 to-gray-800 p-4 rounded-xl border border-gray-700 flex justify-between items-center group">
             <div className="flex items-center gap-3">
                 <div className="bg-brand/20 p-2 rounded-lg text-brand"><Calendar size={20}/></div>
                 <div className="text-left">
                     <p className="font-bold text-sm text-white">Monthly Summary</p>
                     <p className="text-xs text-gray-400">View spending details</p>
                 </div>
             </div>
             <ChevronRight className="text-gray-500 group-hover:text-white transition-colors" size={20}/>
        </button>

        {/* Detailed Balances List */}
        {myDebts.length > 0 && (
            <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 px-1">Detailed Balances</h3>
                <div className="space-y-2">
                    {myDebts.map((t, idx) => {
                        const name = memberNames[t.otherUid] || "Friend";
                        return (
                            <div key={idx} className="flex justify-between items-center bg-card p-3 rounded-xl border border-gray-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">{(name || "?")[0]}</div>
                                    <span className="text-sm font-medium text-gray-200">{name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        {t.type === 'owed' ? (
                                            <>
                                                <p className="text-[10px] text-brand uppercase font-bold">owes you</p>
                                                <p className="text-brand font-bold">₹{t.amount.toFixed(0)}</p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-[10px] text-danger uppercase font-bold">you owe</p>
                                                <p className="text-danger font-bold">₹{t.amount.toFixed(0)}</p>
                                            </>
                                        )}
                                    </div>
                                    {t.type === 'owed' && t.amount > 50 && (
                                        <button onClick={() => sendReminder(t.amount, name)} className="text-brand hover:bg-brand/10 p-2 rounded-full"><MessageCircle size={18}/></button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {/* Recent Activity */}
        <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 px-1">Recent Activity</h3>
            <div className="space-y-3 pb-8">
                {expenses.slice(0, 50).map(exp => {
                    const isPayment = exp.category === 'payment'; 
                    const isPayer = exp.paidBy === user.uid;
                    const dateObj = exp.createdAt?.toDate ? exp.createdAt.toDate() : new Date();
                    const month = dateObj.toLocaleString('default', { month: 'short' }).toUpperCase();
                    const day = dateObj.getDate();
                    
                    // Calc user share for display (Approximation for list view)
                    let displayAmt = 0;
                    if (!isPayment) {
                        displayAmt = (exp.amount - (exp.splitDetails?.[user.uid] || exp.amount/(groupData?.members?.length||1)));
                        if (!isPayer) displayAmt = (exp.splitDetails?.[user.uid] || exp.amount/(groupData?.members?.length||1));
                    }

                    return (
                        <div key={exp.id} onClick={() => navigate(`/expense/${exp.id}`)} className="flex items-center bg-card p-2 rounded-xl border border-gray-800/50 shadow-sm active:scale-[0.98] cursor-pointer hover:border-gray-700 transition-all">
                            <div className="flex flex-col items-center justify-center w-12 h-12 mr-3 bg-gray-800 rounded-xl border border-gray-700 shrink-0">
                                <span className="text-[10px] font-bold text-gray-500 uppercase leading-none">{month}</span>
                                <span className="text-lg font-bold text-gray-300 leading-none mt-0.5">{day}</span>
                            </div>

                            <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                <div className={`min-w-[36px] h-[36px] rounded-full flex items-center justify-center border border-white/5 ${isPayment ? 'bg-emerald-900/20 text-emerald-500' : 'bg-gray-800 text-gray-400'}`}>{isPayment ? <Banknote size={18} /> : <ShoppingCart size={18} />}</div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="font-semibold text-gray-200 truncate pr-2 text-sm">{exp.description}</span>
                                    <span className="text-xs text-gray-500 truncate">
                                        {isPayer ? "You" : (memberNames[exp.paidBy] || "Friend")} {isPayment ? "paid" : "paid"} ₹{exp.amount}
                                    </span>
                                </div>
                            </div>
                            
                            {isPayment ? (
                                <span className="font-bold text-white text-sm">Payment</span>
                            ) : (
                                <div className="text-right min-w-[70px]">
                                    {isPayer ? (
                                        <div className="flex flex-col"><span className="text-[10px] text-brand uppercase font-bold">you lent</span><span className="text-brand font-bold">₹{displayAmt.toFixed(0)}</span></div>
                                    ) : (
                                        <div className="flex flex-col"><span className="text-[10px] text-danger uppercase font-bold">you owe</span><span className="text-danger font-bold">₹{displayAmt.toFixed(0)}</span></div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
      <div className="fixed bottom-6 right-1/2 translate-x-1/2 z-30"><button onClick={() => navigate('/add-expense')} className="flex items-center gap-2 bg-brand hover:bg-emerald-500 text-white px-6 py-4 rounded-full shadow-2xl shadow-brand/20 font-bold transition-transform active:scale-95 hover:scale-105"><Plus size={22} strokeWidth={3} /> Add</button></div>
    </div>
  );
}
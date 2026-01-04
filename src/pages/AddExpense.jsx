import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, FileText, IndianRupee, Utensils, Zap, Home, ShoppingBag, Beer, Bus, Film, HeartPulse, Plane, GraduationCap, Loader2 } from 'lucide-react';

// INDIAN CATEGORIES
const CATEGORIES = [
  { id: 'food', icon: <Utensils size={18}/>, label: 'Food', keywords: ['burger', 'pizza', 'roti', 'naan', 'paneer', 'chicken', 'dal', 'sabzi', 'biryani', 'dosa', 'idli', 'chai', 'coffee', 'tea', 'thali', 'tiffin', 'zomato', 'swiggy', 'lunch', 'dinner', 'breakfast'] },
  { id: 'grocery', icon: <ShoppingBag size={18}/>, label: 'Grocery', keywords: ['milk', 'curd', 'dahi', 'oil', 'atta', 'rice', 'daal', 'masala', 'sugar', 'salt', 'vegetable', 'fruit', 'soap', 'shampoo', 'paste', 'blinkit', 'zepto', 'bigbasket', 'instamart', 'kirana'] },
  { id: 'transport', icon: <Bus size={18}/>, label: 'Travel', keywords: ['auto', 'rickshaw', 'cab', 'taxi', 'ola', 'uber', 'rapido', 'metro', 'bus', 'train', 'flight', 'petrol', 'diesel', 'fuel', 'parking', 'toll'] },
  { id: 'bills', icon: <Zap size={18}/>, label: 'Bills', keywords: ['electricity', 'bescom', 'water', 'gas', 'cylinder', 'wifi', 'broadband', 'jio', 'airtel', 'vi', 'recharge', 'mobile', 'dth'] },
  { id: 'rent', icon: <Home size={18}/>, label: 'Rent', keywords: ['rent', 'maintenance', 'deposit', 'brokerage'] },
  { id: 'party', icon: <Beer size={18}/>, label: 'Party', keywords: ['alcohol', 'beer', 'whisky', 'rum', 'vodka', 'cocktail', 'pub', 'club', 'cake', 'birthday'] },
  { id: 'entertainment', icon: <Film size={18}/>, label: 'Fun', keywords: ['movie', 'cinema', 'bookmyshow', 'netflix', 'prime', 'hotstar', 'spotify', 'game', 'bowling'] },
  { id: 'health', icon: <HeartPulse size={18}/>, label: 'Health', keywords: ['medicine', 'pharmacy', 'doctor', 'hospital', 'test', 'checkup', 'gym', 'protein'] },
  { id: 'education', icon: <GraduationCap size={18}/>, label: 'Education', keywords: ['book', 'course', 'fee', 'tuition', 'xerox', 'print', 'stationery'] },
  { id: 'trip', icon: <Plane size={18}/>, label: 'Trip', keywords: ['hotel', 'resort', 'stay', 'visa', 'booking'] },
];

export default function AddExpense() {
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('food');
  const [payer, setPayer] = useState(null); 
  const [splitType, setSplitType] = useState('equal'); 
  const [members, setMembers] = useState([]); 
  const [splits, setSplits] = useState({}); 
  const [groupData, setGroupData] = useState(null);
  const [loading, setLoading] = useState(true);

  const user = auth.currentUser;
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
        if (!user) return;
        try {
            const uDoc = await getDoc(doc(db, "users", user.uid));
            if (uDoc.exists() && uDoc.data().groupId) {
                const gDoc = await getDoc(doc(db, "groups", uDoc.data().groupId));
                if(gDoc.exists()) {
                    setGroupData({ id: gDoc.id, ...gDoc.data() });
                    const memberIds = gDoc.data().members || [];
                    const promises = memberIds.map(uid => getDoc(doc(db, "users", uid)));
                    const snaps = await Promise.all(promises);
                    const realMembers = snaps.map(s => ({ 
                        id: s.id, 
                        name: s.exists() ? (s.data().displayName || "Unknown") : "Unknown" 
                    }));
                    setMembers(realMembers);
                    setPayer(user.uid); 
                    const initSplits = {}; realMembers.forEach(m => initSplits[m.id] = 0); setSplits(initSplits);
                }
            }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    const lowerDesc = desc.toLowerCase();
    const found = CATEGORIES.find(c => c.keywords.some(k => lowerDesc.includes(k)));
    if (found) setCat(found.id);
  }, [desc]);

  const handleSave = async () => {
    if (!amount || !desc || !groupData) return;
    const numAmount = parseFloat(amount);
    let finalSplits = { ...splits };

    if (splitType === 'percent') {
        let totalPercent = 0;
        Object.entries(splits).forEach(([uid, val]) => {
            totalPercent += val;
            finalSplits[uid] = (val / 100) * numAmount; 
        });
        if (Math.abs(totalPercent - 100) > 1) {
            alert(`Percentages must equal 100% (Currently ${totalPercent}%)`);
            return;
        }
    } else if (splitType === 'unequal') {
        const sum = Object.values(splits).reduce((a, b) => a + b, 0);
        if (Math.abs(sum - numAmount) > 1) { 
            alert(`Split total (${sum}) != Expense (${numAmount})`); 
            return; 
        }
    }

    try {
        await addDoc(collection(db, "expenses"), {
            description: desc, 
            amount: numAmount, 
            paidBy: payer, 
            paidByName: members.find(m => m.id === payer)?.name || "Unknown",
            groupId: groupData.id, 
            category: cat, 
            splitType: splitType === 'equal' ? 'equal' : 'unequal', 
            splitDetails: splitType === 'equal' ? {} : finalSplits, 
            createdAt: serverTimestamp(),
        });
        navigate(-1);
    } catch(e) { console.error(e); }
  };

  if (loading) return <div className="h-screen bg-dark flex items-center justify-center text-brand"><Loader2 className="animate-spin"/></div>;
  if (!groupData) return <div className="h-screen bg-dark text-white flex items-center justify-center">Please join a group first.</div>;

  return (
    <div className="min-h-screen bg-dark text-white p-4 pb-20 font-sans">
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigate(-1)}><ArrowLeft className="text-white" /></button>
        <h2 className="text-lg font-semibold">Add expense</h2>
        <button onClick={handleSave} className="text-brand"><Check size={28} /></button>
      </div>

      <div className="space-y-6 max-w-md mx-auto">
        <div className="flex items-center gap-4 border-b border-gray-700 pb-2">
            <div className={`p-2 rounded-lg border border-gray-600 text-gray-400`}>{CATEGORIES.find(c => c.id === cat)?.icon || <FileText />}</div>
            <input type="text" placeholder="Description" className="bg-transparent text-lg w-full outline-none text-white placeholder-gray-600" value={desc} onChange={e => setDesc(e.target.value)} autoFocus />
        </div>

        <div className="flex items-center gap-4 border-b border-gray-700 pb-2">
            <div className="p-2 border border-gray-600 rounded text-gray-400"><IndianRupee size={24} /></div>
            <input type="number" placeholder="0.00" className="bg-transparent text-4xl font-bold w-full outline-none text-white placeholder-gray-600" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-300">
            <span>Paid by</span>
            <select value={payer || ''} onChange={(e) => setPayer(e.target.value)} className="bg-gray-800 border border-brand text-brand font-bold rounded px-2 py-1 outline-none">
                {members.map(m => (
                    <option key={m.id} value={m.id}>{m.id === user?.uid ? "You" : m.name}</option>
                ))}
            </select>
        </div>

        <div className="bg-card p-4 rounded-xl border border-gray-800">
            <p className="text-[10px] font-bold text-gray-500 uppercase mb-3">Split Method</p>
            <div className="flex gap-2 mb-4">
                {['equal', 'unequal', 'percent'].map(type => (
                    <button key={type} onClick={() => setSplitType(type)} className={`flex-1 py-2 text-xs font-bold rounded-lg border capitalize ${splitType === type ? 'bg-brand text-white border-brand' : 'bg-transparent border-gray-700 text-gray-400'}`}>{type}</button>
                ))}
            </div>
            
            <div className="space-y-3">
                {members.map(m => (
                    <div key={m.id} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2"><div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs text-white border border-gray-600">{(m.name || "?")[0]}</div><span>{m.id === user?.uid ? "You" : m.name}</span></div>
                        {splitType === 'equal' && (<span className="text-gray-500">₹{(amount / (members.length || 1)).toFixed(2)}</span>)}
                        {splitType === 'unequal' && <div className="flex items-center border-b border-gray-600 w-20"><span className="text-gray-500">₹</span><input type="number" className="w-full bg-transparent text-right outline-none text-white" placeholder="0" value={splits[m.id]||''} onChange={(e) => setSplits(prev => ({ ...prev, [m.id]: parseFloat(e.target.value) || 0 }))}/></div>}
                        {splitType === 'percent' && <div className="flex items-center border-b border-gray-600 w-16"><input type="number" className="w-full bg-transparent text-right outline-none text-white" placeholder="0" value={splits[m.id]||''} onChange={(e) => setSplits(prev => ({ ...prev, [m.id]: parseFloat(e.target.value) || 0 }))}/><span className="text-gray-500 ml-1">%</span></div>}
                    </div>
                ))}
            </div>
        </div>
      </div>
      
      <div className="mt-6"><p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Category</p><div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">{CATEGORIES.map(c => (<button key={c.id} onClick={() => setCat(c.id)} className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs whitespace-nowrap ${cat === c.id ? 'bg-brand border-brand text-white' : 'border-gray-700 text-gray-400'}`}>{c.icon} {c.label}</button>))}</div></div>
      <button onClick={handleSave} className="w-full mt-8 bg-brand text-white font-bold text-lg py-3 rounded-xl shadow-lg active:scale-95 transition-all">Save Expense</button>
    </div>
  );
}
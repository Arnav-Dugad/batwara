import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, IndianRupee, Loader2 } from 'lucide-react';

export default function SettleUp() {
  const [amount, setAmount] = useState('');
  const [receiver, setReceiver] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupData, setGroupData] = useState(null);
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
                    if (memberIds.length > 0) {
                        const promises = memberIds.map(uid => getDoc(doc(db, "users", uid)));
                        const snaps = await Promise.all(promises);
                        const realMembers = snaps.map(s => ({ 
                            uid: s.id, 
                            displayName: s.exists() ? (s.data().displayName || "Unknown") : "Unknown" 
                        }));
                        setMembers(realMembers);
                    }
                }
            }
        } catch(e) { console.error(e); } finally { setLoading(false); }
    };
    fetchData();
  }, [user]);

  const handlePay = async () => {
    if (!amount || !receiver) return;
    const receiverData = members.find(m => m.uid === receiver);
    
    try {
        await addDoc(collection(db, "expenses"), {
            description: `Payment to ${receiverData?.displayName || 'Friend'}`,
            amount: parseFloat(amount),
            paidBy: user.uid,
            paidByName: user.displayName, 
            paidTo: receiver, 
            groupId: groupData?.id, 
            category: 'payment', 
            createdAt: serverTimestamp(),
        });
        navigate(-1);
    } catch(e) { console.error(e); }
  };

  if (loading) return <div className="min-h-screen bg-dark flex items-center justify-center text-brand"><Loader2 className="animate-spin"/></div>;
  if (!groupData) return <div className="min-h-screen bg-dark text-white flex items-center justify-center">Please join a group first.</div>;

  return (
    <div className="min-h-screen bg-dark text-white p-4 font-sans">
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigate(-1)}><ArrowLeft className="text-white" /></button>
        <h2 className="text-lg font-semibold">Record Payment</h2>
        <button onClick={handlePay} disabled={!amount || !receiver} className="text-brand disabled:opacity-50"><Check size={28} /></button>
      </div>

      <div className="text-center mb-8"><p className="text-gray-400 text-sm font-medium">YOU PAID</p></div>
      <div className="flex items-center justify-center gap-2 mb-10">
        <IndianRupee className="text-gray-500" size={32} />
        <input type="number" placeholder="0" className="bg-transparent text-6xl font-bold w-40 text-center outline-none text-white border-b border-gray-800 pb-2 focus:border-brand placeholder-gray-700" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
      </div>

      <p className="text-[10px] font-bold text-gray-500 uppercase mb-3 px-1">To Whom?</p>
      <div className="space-y-2">
        {members.map((m) => (
             m.uid !== user.uid && (
                <button key={m.uid} onClick={() => setReceiver(m.uid)} className={`w-full p-4 rounded-xl flex items-center gap-3 border transition-all ${receiver === m.uid ? 'bg-brand/20 border-brand' : 'bg-card border-gray-800 hover:border-gray-600'}`}>
                    <img src={m.photoURL || `https://ui-avatars.com/api/?name=${m.displayName}`} className="w-10 h-10 rounded-full bg-gray-700 object-cover" alt={m.displayName} />
                    <span className="font-bold text-gray-200">{m.displayName}</span>
                    {receiver === m.uid && <Check size={20} className="ml-auto text-brand"/>}
                </button>
             )
        ))}
      </div>
    </div>
  );
}
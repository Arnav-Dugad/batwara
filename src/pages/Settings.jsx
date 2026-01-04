import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, User, Users, Trash2, Share2, Save, AlertTriangle, UserMinus, Loader2, Download, RotateCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc, arrayRemove, deleteDoc, collection, query, where, getDocs, writeBatch } from "firebase/firestore";

export default function Settings() {
  const navigate = useNavigate();
  const user = auth.currentUser;
  
  const [groupData, setGroupData] = useState(null);
  const [memberProfiles, setMemberProfiles] = useState([]);
  const [newName, setNewName] = useState(user?.displayName || "");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processingUid, setProcessingUid] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
        if (!user) return;
        try {
            const uDoc = await getDoc(doc(db, "users", user.uid));
            if(uDoc.exists() && uDoc.data().groupId) {
                const gDoc = await getDoc(doc(db, "groups", uDoc.data().groupId));
                if(gDoc.exists()) {
                    setGroupData({id: gDoc.id, ...gDoc.data()});
                    const memberIds = gDoc.data().members || [];
                    if (memberIds.length > 0) {
                        const promises = memberIds.map(uid => getDoc(doc(db, "users", uid)));
                        const snaps = await Promise.all(promises);
                        const profiles = snaps.map(s => {
                             if(s.exists()) return { uid: s.id, ...s.data() };
                             return { uid: s.id, displayName: "Unknown User", email: "" };
                        });
                        setMemberProfiles(profiles);
                    }
                }
            }
        } catch (e) { console.error("Settings Error:", e); } finally { setLoading(false); }
    }
    fetchData();
  }, [user]);

  const handleUpdateName = async () => {
    if(!newName.trim()) return;
    try {
        await updateDoc(doc(db, "users", user.uid), { displayName: newName });
        setIsEditing(false);
        setMemberProfiles(prev => prev.map(m => m.uid === user.uid ? {...m, displayName: newName} : m));
    } catch(e) { alert("Error"); }
  };

  const removeMember = async (memberUid, memberName) => {
    if(!window.confirm(`Remove ${memberName}?`)) return;
    setProcessingUid(memberUid);
    try {
        await updateDoc(doc(db, "groups", groupData.id), { members: arrayRemove(memberUid) });
        await updateDoc(doc(db, "users", memberUid), { groupId: null });
        setMemberProfiles(prev => prev.filter(m => m.uid !== memberUid));
    } catch (e) { alert("Error: " + e.message); }
    finally { setProcessingUid(null); }
  };

  const handleResetGroup = async () => {
      const confirmStr = prompt("Type 'RESET' to delete ALL group expenses. This cannot be undone.");
      if (confirmStr !== 'RESET') return;
      try {
          const q = query(collection(db, "expenses"), where("groupId", "==", groupData.id));
          const snapshot = await getDocs(q);
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
          alert("Group history cleared!");
          navigate("/dashboard");
      } catch (e) { alert("Error: " + e.message); }
  };

  const handleExport = () => {
     if (!groupData) return;
     const rows = memberProfiles.map(m => `${m.displayName} (${m.email})`);
     const data = `Group: ${groupData.name}\nCode: ${groupData.id}\n\nMembers:\n${rows.join('\n')}`;
     const blob = new Blob([data], { type: 'text/plain' });
     const url = window.URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url; a.download = 'batwara-info.txt'; a.click();
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("⚠️ Delete Account?")) return;
    try {
        if(groupData) await updateDoc(doc(db, "groups", groupData.id), { members: arrayRemove(user.uid) });
        await deleteDoc(doc(db, "users", user.uid));
        await user.delete();
        navigate("/", { replace: true });
    } catch (e) { alert("Login again to delete."); auth.signOut(); navigate("/"); }
  };

  if (loading) return <div className="min-h-screen bg-dark flex items-center justify-center text-brand"><Loader2 className="animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-dark text-white p-4 font-sans">
      <div className="flex items-center gap-4 mb-8"><button onClick={() => navigate(-1)}><ArrowLeft /></button><h1 className="text-xl font-bold">Settings</h1></div>
      <div className="space-y-6">
        <div className="bg-card p-5 rounded-2xl border border-gray-800">
            <h2 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2"><User size={14}/> Profile</h2>
            <div className="flex items-center gap-4">
                <img src={user?.photoURL} className="w-14 h-14 rounded-full border-2 border-brand" alt="Me" />
                <div className="flex-1">{isEditing ? <div className="flex gap-2"><input value={newName} onChange={e => setNewName(e.target.value)} className="bg-dark border border-gray-600 rounded px-2 py-1 text-white w-full" autoFocus/><button onClick={handleUpdateName} className="bg-brand p-2 rounded text-white"><Save size={18}/></button></div> : <div className="flex justify-between items-center"><div><p className="font-bold text-lg">{newName}</p><p className="text-xs text-gray-400">{user?.email}</p></div><button onClick={() => setIsEditing(true)} className="text-xs text-brand font-bold bg-brand/10 px-3 py-1 rounded-full">Edit</button></div>}</div>
            </div>
        </div>

        {groupData ? (
            <div className="bg-card p-5 rounded-2xl border border-gray-800">
                <h2 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2"><Users size={14}/> Group</h2>
                <div className="bg-dark p-4 rounded-xl border border-gray-700 mb-4 flex justify-between items-center"><div><p className="text-[10px] text-gray-500 uppercase">Invite Code</p><span className="font-mono text-xl font-bold text-white tracking-widest">{groupData.id}</span></div><button onClick={() => {navigator.clipboard.writeText(groupData.id); alert("Copied!");}} className="bg-brand text-white p-2 rounded-full"><Share2 size={18} /></button></div>
                <div className="space-y-3">{memberProfiles.map((m) => (<div key={m.uid} className="flex justify-between items-center bg-dark/40 p-3 rounded-xl border border-gray-800/50"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center font-bold text-xs text-gray-300">{(m.displayName || "?")[0]}</div><span className="text-sm font-bold text-gray-200">{m.displayName} {m.uid === user.uid && <span className="text-brand text-xs">(You)</span>}</span></div>{m.uid !== user.uid && (<button onClick={() => removeMember(m.uid, m.displayName)} disabled={processingUid === m.uid} className="text-gray-600 hover:text-danger p-2">{processingUid === m.uid ? <Loader2 className="animate-spin" size={16}/> : <UserMinus size={18} />}</button>)}</div>))}</div>
                <button onClick={handleExport} className="w-full mt-4 flex items-center justify-center gap-2 text-xs font-bold text-gray-400 py-2 hover:text-white"><Download size={14}/> Export Member List</button>
            </div>
        ) : <div className="bg-card p-5 border border-gray-800 text-center text-gray-400">No Group</div>}

        <div className="pt-6 border-t border-gray-800 space-y-3">
            <button onClick={handleResetGroup} className="w-full bg-orange-900/20 border border-orange-700/50 text-orange-500 p-4 rounded-xl font-bold flex justify-center gap-2"><RotateCcw size={18} /> Reset Group Expenses</button>
            <button onClick={() => { auth.signOut(); navigate("/", { replace: true }); }} className="w-full bg-gray-800 text-gray-300 p-4 rounded-xl font-bold flex justify-center gap-2"><LogOut size={18} /> Log out</button>
            <button onClick={handleDeleteAccount} className="w-full border border-red-900/30 text-danger p-4 rounded-xl font-bold flex justify-center gap-2"><AlertTriangle size={18} /> Delete Account</button>
        </div>
      </div>
    </div>
  );
}
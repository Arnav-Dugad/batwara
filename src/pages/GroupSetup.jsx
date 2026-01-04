import { useState } from "react";
import { db, auth } from "../firebase";
import { doc, setDoc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { Users, ArrowRight } from "lucide-react";

export default function GroupSetup() {
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const user = auth.currentUser;

  const createGroup = async () => {
    if (!groupName) return;
    const newGroupId = "FLAT-" + Math.floor(1000 + Math.random() * 9000);
    
    try {
      await setDoc(doc(db, "groups", newGroupId), {
        name: groupName,
        members: [user.uid],
        memberNames: [user.displayName || "Unknown"]
      });
      // Link user to group
      await setDoc(doc(db, "users", user.uid), { 
        groupId: newGroupId,
        email: user.email 
      }, { merge: true });
      navigate("/dashboard");
    } catch (error) { console.error(error); }
  };

  const joinGroup = async () => {
    if (!joinCode) return;
    const cleanCode = joinCode.trim().toUpperCase(); // FORCE UPPERCASE
    setError("");

    try {
      const groupRef = doc(db, "groups", cleanCode);
      const groupSnap = await getDoc(groupRef);

      if (!groupSnap.exists()) {
        setError("Invalid Group Code! Check with your flatmate.");
        return;
      }

      // 1. Add me to Group Members
      await updateDoc(groupRef, {
        members: arrayUnion(user.uid),
        memberNames: arrayUnion(user.displayName || "Unknown")
      });

      // 2. Link Group to Me
      await setDoc(doc(db, "users", user.uid), { 
        groupId: cleanCode,
        email: user.email 
      }, { merge: true });
      
      navigate("/dashboard");
    } catch (error) { 
        console.error(error);
        setError("Something went wrong. Try again.");
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-dark p-6 text-white">
      <div className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(28,194,159,0.3)]">
        <Users size={32} />
      </div>
      <h1 className="text-2xl font-bold mb-2">Setup Your Flat</h1>
      <p className="text-gray-500 mb-8 text-center text-sm">Create a space for you and your roommates.</p>

      <div className="w-full max-w-md space-y-6">
        {/* CREATE */}
        <div className="bg-card p-6 rounded-2xl border border-gray-800">
          <h2 className="font-bold text-white mb-4">Create New Group</h2>
          <div className="flex gap-2">
            <input 
                type="text" 
                placeholder="e.g. B-Block 402"
                className="flex-1 p-3 bg-dark rounded-lg border border-gray-700 focus:border-brand outline-none text-white"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
            />
            <button onClick={createGroup} className="bg-brand text-white p-3 rounded-lg font-bold">
                <ArrowRight />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 opacity-50">
            <div className="h-[1px] bg-gray-600 flex-1"></div>
            <span className="text-xs uppercase">OR</span>
            <div className="h-[1px] bg-gray-600 flex-1"></div>
        </div>

        {/* JOIN */}
        <div className="bg-card p-6 rounded-2xl border border-gray-800">
          <h2 className="font-bold text-white mb-4">Join Existing Group</h2>
          <input 
            type="text" 
            placeholder="Enter Code (e.g. FLAT-8821)"
            className="w-full p-3 bg-dark rounded-lg mb-3 border border-gray-700 focus:border-brand outline-none uppercase text-white font-mono tracking-widest"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          {error && <p className="text-danger text-xs mb-3">{error}</p>}
          <button onClick={joinGroup} className="w-full bg-transparent border border-brand text-brand p-3 rounded-lg font-bold hover:bg-brand hover:text-white transition-colors">
            Join Group
          </button>
        </div>
      </div>
    </div>
  );
}
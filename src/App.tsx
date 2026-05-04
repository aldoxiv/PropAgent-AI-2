import { useState, useEffect } from "react";
import { Property, LeadStatus } from "./types";
import { PropertyList } from "./components/PropertyList";
import { AgentChat } from "./components/AgentChat";
import { Dashboard } from "./components/Dashboard";
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from "./lib/firebase";
import { collection, onSnapshot, addDoc, query, getDocs, writeBatch, doc } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { Building2, MessageSquare, ShieldCheck, ArrowRight, Home, LogOut, LogIn } from "lucide-react";

const INITIAL_PROPERTIES: Omit<Property, 'id'>[] = [
  {
    title: "The Obsidian Penthouse",
    description: "Experience unparalleled luxury with 360-degree skyline views. Features bespoke Italian marble, a private elevator, and a 2,000 sq ft terrace with an infinity pool.",
    price: 12500000,
    address: "700 Wall St, Manhattan, NY",
    imageUrl: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&q=80&w=1000",
    type: "apartment"
  },
  {
    title: "Azure Shore Estate",
    description: "A coastal masterpiece blending modern architecture with the natural beauty of the Pacific. Private beach access, floor-to-ceiling glass walls, and a state-of-the-art home theater.",
    price: 8900000,
    address: "102 Ocean Way, Malibu, CA",
    imageUrl: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=1000",
    type: "house"
  },
  {
    title: "Elysium Parkside",
    description: "Minimalist perfection overlooking the city's greenest heart. Smart-home integration, wellness suite with sauna, and a chef-grade kitchen.",
    price: 4200000,
    address: "55 Parkside Dr, London, UK",
    imageUrl: "https://images.unsplash.com/photo-1600585154340-be6191daad10?auto=format&fit=crop&q=80&w=1000",
    type: "condo"
  }
];

export default function App() {
  const [view, setView] = useState<'public' | 'admin'>('public');
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    const unsubProps = onSnapshot(collection(db, 'properties'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
      setProperties(data);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'properties'));

    return () => {
      unsubAuth();
      unsubProps();
    };
  }, []);

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Sign in failed", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setView('public');
    } catch (error) {
      console.error("Sign out failed", error);
    }
  };

  const seedData = async () => {
    if (!user) {
      alert("Please sign in first to seed data.");
      return;
    }
    setIsSeeding(true);
    try {
      const q = query(collection(db, 'properties'));
      const snapshot = await getDocs(q).catch(e => handleFirestoreError(e, OperationType.GET, 'properties'));
      
      if (snapshot && snapshot.empty) {
        const batch = writeBatch(db);
        INITIAL_PROPERTIES.forEach((prop) => {
          const newDoc = doc(collection(db, 'properties'));
          batch.set(newDoc, prop);
        });
        await batch.commit().catch(e => handleFirestoreError(e, OperationType.WRITE, 'properties-batch'));
      }
    } catch (e) {
      console.error("Seeding failed", e);
      if (e instanceof Error && e.message.startsWith('{')) {
        // This is our structured error
        throw e;
      }
      alert("Seeding failed. Make sure you are signed in with an admin email.");
    } finally {
      setIsSeeding(false);
    }
  };

  const toggleAdminView = () => {
    if (!user) {
      handleSignIn();
      return;
    }
    if (user.email !== 'aldo14.snt@gmail.com') {
      alert("Unauthorized. This area is reserved for luxury agents.");
      return;
    }
    setView('admin');
  };

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-20 bg-[var(--color-paper)]/80 backdrop-blur-md z-40 border-b border-[rgba(26,26,26,0.05)] px-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-[var(--color-ink)] text-white w-10 h-10 flex items-center justify-center rounded-sm">
            <Building2 size={24} />
          </div>
          <div>
            <h1 className="font-serif text-2xl tracking-tight leading-none">PropAgent AI</h1>
            <p className="text-[9px] uppercase tracking-[0.3em] font-bold opacity-40">Luxury Real Estate</p>
          </div>
        </div>

        <div className="flex gap-8 items-center">
          <button 
            onClick={() => setView('public')}
            className={`text-[11px] uppercase tracking-widest font-bold transition-all ${view === 'public' ? 'text-[var(--color-gold)]' : 'text-[rgba(26,26,26,0.5)] hover:text-[rgba(26,26,26,1)]'}`}
          >
            Listings
          </button>
          <button 
            onClick={toggleAdminView}
            className={`text-[11px] uppercase tracking-widest font-bold transition-all px-4 py-2 border rounded-sm flex items-center gap-2 ${
              view === 'admin' 
                ? 'border-[var(--color-gold)] text-[var(--color-gold)]' 
                : 'border-[rgba(26,26,26,0.1)] text-[rgba(26,26,26,0.5)] hover:border-[rgba(26,26,26,0.3)]'
            }`}
          >
            <ShieldCheck size={14} />
            Agent Portal
          </button>
          
          {user ? (
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold text-red-500/60 hover:text-red-500 transition-colors"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          ) : (
            <button 
              onClick={handleSignIn}
              className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--color-gold)] hover:text-[var(--color-ink)] transition-colors"
            >
              <LogIn size={14} />
              Admin sign in
            </button>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20 h-[calc(100vh-80px)]">
        <AnimatePresence mode="wait">
          {view === 'public' ? (
            <motion.div
              key="public"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full overflow-y-auto"
            >
              {/* Hero Section */}
              <section className="px-8 pt-16 pb-12">
                <div className="max-w-4xl">
                  <h2 className="font-serif text-7xl mb-6 leading-[0.9] tracking-tighter">
                    Finding the perfect <br /> 
                    <span className="text-[var(--color-gold)] italic">residence</span> for you.
                  </h2>
                  <p className="max-w-xl text-[rgba(26,26,26,0.6)] font-sans leading-relaxed">
                    Our AI-powered assistant is here 24/7 to help you discover exclusive properties and handle every detail from inquiry to viewing.
                  </p>
                </div>
              </section>

              {/* Property Loop */}
              <section className="px-2 pb-24">
                {properties.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-6">
                    <p className="text-[11px] uppercase tracking-widest opacity-50 font-bold">Your listing collection is empty</p>
                    <button 
                      onClick={seedData} 
                      disabled={isSeeding}
                      className="px-8 py-4 bg-[var(--color-ink)] text-white text-[11px] uppercase tracking-widest font-bold rounded-sm hover:translate-y-[-2px] transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                      {isSeeding ? 'Provisioning...' : 'Seed Initial Inventory'}
                      {!isSeeding && <ArrowRight size={14} />}
                    </button>
                  </div>
                ) : (
                  <PropertyList 
                    properties={properties} 
                    onSelect={(p) => {
                      setSelectedProperty(p);
                      setIsChatOpen(true);
                    }} 
                  />
                )}
              </section>
            </motion.div>
          ) : (
            <motion.div
              key="admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <Dashboard properties={properties} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Action Button for Chat */}
      {view === 'public' && !isChatOpen && (
        <motion.button
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          whileHover={{ scale: 1.1 }}
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-8 right-8 w-16 h-16 bg-[var(--color-ink)] text-white rounded-full flex items-center justify-center shadow-xl z-50 overflow-hidden group"
        >
          <div className="absolute inset-0 bg-[var(--color-gold)] translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          <MessageSquare size={28} className="relative z-10" />
        </motion.button>
      )}

      {/* Agent Chat Modal */}
      <AnimatePresence>
        {isChatOpen && (
          <AgentChat 
            initialProperty={selectedProperty || undefined} 
            onClose={() => {
              setIsChatOpen(false);
              setSelectedProperty(null);
            }} 
          />
        )}
      </AnimatePresence>

      {/* Footer Decoration */}
      <footer className="fixed bottom-0 left-0 right-0 h-10 pointer-events-none px-8 flex items-center justify-between z-40 bg-gradient-to-t from-[var(--color-paper)] to-transparent">
        <span className="text-[9px] uppercase tracking-widest opacity-20 font-bold">PropAgent AI System 2.4.0</span>
        <div className="flex gap-4 items-center">
           <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
           <span className="text-[9px] uppercase tracking-widest opacity-20 font-bold">Node Connected</span>
        </div>
      </footer>
    </div>
  );
}

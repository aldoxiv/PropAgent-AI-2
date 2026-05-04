import { useState, useEffect } from "react";
import { Lead, Viewing, LeadStatus, ViewingStatus, Property, Reminder, AppSettings } from "../types";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, query, onSnapshot, updateDoc, doc, deleteDoc, getDocs, addDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Users, Calendar, CheckCircle2, XCircle, ChevronRight, LayoutDashboard, Building2, Bell, Clock, AlertCircle, Search, Settings, Save } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function Dashboard({ properties }: { properties: Property[] }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'leads' | 'viewings' | 'inventory' | 'reminders' | 'settings'>('leads');
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const leadsUnsub = onSnapshot(collection(db, 'leads'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));
      setLeads(data);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'leads'));

    const viewingsUnsub = onSnapshot(collection(db, 'viewings'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Viewing));
      setViewings(data);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'viewings'));

    const remindersUnsub = onSnapshot(collection(db, 'reminders'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reminder));
      setReminders(data);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'reminders'));

    const settingsUnsub = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings({ id: snapshot.id, ...snapshot.data() } as AppSettings);
      } else {
        // Init default settings if not exists
        setSettings({
          id: 'global',
          welcomeEmailSubject: "Welcome to PropAgent AI Luxury Listings",
          welcomeEmailBody: "Dear {name},\n\nThank you for your interest in our premium properties. We have registered your inquiry and one of our senior consultants will contact you shortly to discuss your requirements.\n\nBest regards,\nThe PropAgent AI Team"
        });
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/global'));

    return () => {
      leadsUnsub();
      viewingsUnsub();
      remindersUnsub();
      settingsUnsub();
    };
  }, []);

  const updateLeadStatus = async (leadId: string, newStatus: LeadStatus) => {
    try {
      await updateDoc(doc(db, 'leads', leadId), { status: newStatus });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `leads/${leadId}`);
    }
  };

  const completeReminder = async (reminderId: string) => {
    try {
      await updateDoc(doc(db, 'reminders', reminderId), { completed: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `reminders/${reminderId}`);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        welcomeEmailSubject: settings.welcomeEmailSubject,
        welcomeEmailBody: settings.welcomeEmailBody
      });
      alert('Settings saved successfully');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'settings/global');
    } finally {
      setIsSaving(false);
    }
  };

  const overdueReminders = reminders.filter(r => !r.completed && r.dateTime < Date.now());

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Sidebar-style Header */}
      <div className="border-b border-[rgba(26,26,26,0.1)] p-8">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="font-serif text-4xl mb-1">PropAgent Admin</h1>
            <p className="text-[10px] uppercase tracking-widest text-[rgba(26,26,26,0.5)] font-semibold">Intelligence Dashboard v2.0</p>
          </div>
          <div className="flex gap-4">
            {overdueReminders.length > 0 && (
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }} 
                transition={{ repeat: Infinity, duration: 2 }}
                className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-full cursor-pointer hover:bg-red-100 transition-all border border-red-100"
                onClick={() => setActiveTab('reminders')}
              >
                <AlertCircle size={16} />
                <span className="text-[10px] font-bold uppercase tracking-widest">{overdueReminders.length} Overdue</span>
              </motion.div>
            )}
            <div className="text-right">
              <p className="text-xs font-semibold">{leads.length}</p>
              <p className="text-[9px] uppercase tracking-widest text-[rgba(26,26,26,0.5)]">Total Leads</p>
            </div>
            <div className="w-px h-8 bg-[rgba(26,26,26,0.1)]" />
            <div className="text-right">
              <p className="text-xs font-semibold">{viewings.filter(v => v.status === ViewingStatus.PENDING).length}</p>
              <p className="text-[9px] uppercase tracking-widest text-[rgba(26,26,26,0.5)]">Pending Viewings</p>
            </div>
          </div>
        </div>

        <div className="flex gap-8">
          {[
            { id: 'leads', icon: Users, label: 'Leads' },
            { id: 'viewings', icon: Calendar, label: 'Viewings' },
            { id: 'reminders', icon: Clock, label: 'Follow-ups' },
            { id: 'inventory', icon: Building2, label: 'Inventory' },
            { id: 'settings', icon: Settings, label: 'Templates' },
          ].map((tab) => (
            <div key={tab.id} className="relative">
              <button
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 pb-4 border-b-2 transition-all text-[11px] uppercase tracking-widest font-bold ${
                  activeTab === tab.id 
                    ? 'border-[var(--color-gold)] text-[var(--color-ink)]' 
                    : 'border-transparent text-[rgba(26,26,26,0.4)] hover:text-[rgba(26,26,26,0.8)]'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
              {tab.id === 'reminders' && overdueReminders.length > 0 && (
                <div className="absolute top-[-4px] right-[-4px] w-2 h-2 bg-red-500 rounded-full" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8 bg-[var(--color-paper)]/20">
        <AnimatePresence mode="wait">
          {activeTab === 'leads' && (
            <motion.div
              key="leads"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-4"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                  <h3 className="font-serif text-2xl tracking-tight">Lead Manifest</h3>
                  <p className="text-[10px] uppercase tracking-widest text-[rgba(26,26,26,0.4)]">Capture & Follow-up Pipeline</p>
                </div>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(26,26,26,0.3)]" size={16} />
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-[rgba(26,26,26,0.1)] rounded-sm text-sm outline-none focus:border-[var(--color-gold)] transition-colors"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {leads.filter(l => 
                l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                l.email.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 && (
                <p className="text-center py-20 text-[rgba(26,26,26,0.4)] uppercase text-xs tracking-widest">
                  {searchQuery ? "No leads match your search." : "No leads captured yet."}
                </p>
              )}
              {leads
                .filter(l => 
                  l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  l.email.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((lead) => (
                <div key={lead.id} className="bg-white border border-[rgba(26,26,26,0.1)] p-6 rounded-sm flex justify-between items-center group">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-[var(--color-paper)] rounded-full flex items-center justify-center font-serif text-xl">
                      {lead.name[0]}
                    </div>
                    <div>
                      <h4 className="font-serif text-xl leading-tight">{lead.name}</h4>
                      <div className="flex items-center gap-3 text-[10px] text-[rgba(26,26,26,0.5)] uppercase tracking-wide">
                        <span>{lead.email}</span>
                        <span className="w-1 h-1 bg-[rgba(26,26,26,0.2)] rounded-full" />
                        <span>Status: <span className="text-[var(--color-gold)] font-bold">{lead.status}</span></span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <select 
                      className="text-[10px] uppercase tracking-widest font-bold border border-[rgba(26,26,26,0.1)] rounded px-2 py-1 outline-none"
                      value={lead.status}
                      onChange={(e) => updateLeadStatus(lead.id, e.target.value as LeadStatus)}
                    >
                      {Object.values(LeadStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                    <button 
                      onClick={() => setActiveTab('reminders')}
                      className="flex items-center gap-2 p-2 hover:bg-[var(--color-paper)] rounded transition-colors text-[9px] uppercase tracking-widest font-bold opacity-60"
                    >
                      <Clock size={14} />
                      Log Follow-up
                    </button>
                    <button className="p-2 hover:bg-[var(--color-paper)] rounded transition-colors">
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'reminders' && (
             <motion.div
              key="reminders"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-end mb-8">
                <div>
                   <h3 className="font-serif text-2xl tracking-tight">Active Follow-ups</h3>
                   <p className="text-[10px] uppercase tracking-widest text-[rgba(26,26,26,0.4)]">Automated & Manual Tasks</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reminders.sort((a,b) => a.dateTime - b.dateTime).map(reminder => (
                  <div key={reminder.id} className={`bg-white border rounded-sm p-6 relative overflow-hidden transition-all ${
                    reminder.completed ? 'opacity-50 border-[rgba(26,26,26,0.05)]' : 
                    reminder.dateTime < Date.now() ? 'border-red-200 shadow-[0_4px_20px_-10px_rgba(239,68,68,0.2)]' : 'border-[rgba(26,26,26,0.1)]'
                  }`}>
                    {reminder.dateTime < Date.now() && !reminder.completed && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
                    )}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded ${reminder.completed ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                           <Bell size={14} />
                        </div>
                        <div className="text-[9px] uppercase tracking-widest font-bold opacity-40">
                           Due: {new Date(reminder.dateTime).toLocaleString()}
                        </div>
                      </div>
                      {!reminder.completed && (
                        <button 
                          onClick={() => completeReminder(reminder.id)}
                          className="text-[9px] uppercase tracking-widest font-bold text-[var(--color-gold)] hover:text-[var(--color-ink)] transition-colors flex items-center gap-1"
                        >
                          <CheckCircle2 size={12} />
                          Mark Complete
                        </button>
                      )}
                    </div>
                    <h4 className={`font-serif text-lg mb-2 ${reminder.completed ? 'line-through' : ''}`}>{reminder.text}</h4>
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[rgba(26,26,26,0.4)]">
                       <Users size={12} />
                       Lead: {leads.find(l => l.id === reminder.leadId)?.name || 'Unknown'}
                    </div>
                  </div>
                ))}
                {reminders.length === 0 && <p className="col-span-full text-center py-20 text-[rgba(26,26,26,0.4)] uppercase text-xs tracking-widest">No reminders set.</p>}
              </div>
            </motion.div>
          )}

          {activeTab === 'viewings' && (
            <motion.div
              key="viewings"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {viewings.length === 0 && <p className="col-span-full text-center py-20 text-[rgba(26,26,26,0.4)] uppercase text-xs tracking-widest">No scheduled viewings.</p>}
              {viewings.map((viewing) => {
                const lead = leads.find(l => l.id === viewing.leadId);
                const property = properties.find(p => p.id === viewing.propertyId);
                return (
                  <div key={viewing.id} className="bg-white border border-[rgba(26,26,26,0.1)] p-6 rounded-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-[9px] uppercase tracking-widest text-[rgba(26,26,26,0.5)] mb-1">Lead: {lead?.name || 'Unknown'}</div>
                        <h4 className="font-serif text-lg">{property?.title || 'Unknown Property'}</h4>
                      </div>
                      <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded ${
                        viewing.status === ViewingStatus.PENDING ? 'bg-yellow-50 text-yellow-700' :
                        viewing.status === ViewingStatus.CONFIRMED ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {viewing.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs mb-6 text-[rgba(26,26,26,0.6)]">
                       <Calendar size={14} />
                       {new Date(viewing.dateTime).toLocaleString()}
                    </div>
                    <div className="flex gap-2">
                       <button className="flex-1 py-2 text-[10px] uppercase tracking-widest font-bold bg-[var(--color-ink)] text-white hover:bg-opacity-90 transition-all rounded">Confirm</button>
                       <button className="flex-1 py-2 text-[10px] uppercase tracking-widest font-bold border border-[rgba(26,26,26,0.1)] hover:bg-red-50 hover:text-red-600 transition-all rounded">Cancel</button>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="max-w-2xl"
            >
              <div className="mb-12">
                <h3 className="font-serif text-3xl tracking-tight mb-2">Email Templates</h3>
                <p className="text-sm text-[rgba(26,26,26,0.6)]">Configure automated communications sent by PropAgent AI.</p>
              </div>

              <div className="bg-white border border-[rgba(26,26,26,0.1)] rounded-sm p-8 space-y-8">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold mb-3 opacity-50">Welcome Email Subject</label>
                  <input 
                    type="text" 
                    className="w-full bg-[var(--color-paper)]/30 border border-[rgba(26,26,26,0.1)] rounded-sm px-4 py-3 text-sm outline-none focus:border-[var(--color-gold)] transition-colors"
                    value={settings?.welcomeEmailSubject || ''}
                    onChange={(e) => setSettings(s => s ? {...s, welcomeEmailSubject: e.target.value} : null)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold mb-3 opacity-50">Welcome Email Body</label>
                  <div className="text-[10px] mb-2 text-[var(--color-gold)] font-bold italic">Tip: Use {"{name}"} to personalize with the lead's name.</div>
                  <textarea 
                    rows={8}
                    className="w-full bg-[var(--color-paper)]/30 border border-[rgba(26,26,26,0.1)] rounded-sm px-4 py-3 text-sm outline-none focus:border-[var(--color-gold)] transition-colors resize-none"
                    value={settings?.welcomeEmailBody || ''}
                    onChange={(e) => setSettings(s => s ? {...s, welcomeEmailBody: e.target.value} : null)}
                  />
                </div>

                <div className="pt-4 border-t border-[rgba(26,26,26,0.05)] flex justify-end">
                  <button 
                    disabled={isSaving}
                    onClick={saveSettings}
                    className="bg-[var(--color-ink)] text-white px-8 py-3 rounded-sm text-[10px] uppercase tracking-widest font-bold hover:translate-y-[-2px] transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? <Clock className="animate-spin" size={14} /> : <Save size={14} />}
                    Apply Changes
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'inventory' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {properties.map(p => (
                <div key={p.id} className="bg-white border border-[rgba(26,26,26,0.1)] h-40 rounded-sm relative group cursor-pointer overflow-hidden">
                   <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                   <div className="absolute inset-0 bg-gradient-to-t from-[rgba(26,26,26,0.8)] to-transparent" />
                   <div className="absolute bottom-4 left-4 text-white">
                      <h4 className="font-serif text-lg">{p.title}</h4>
                      <p className="text-[10px] uppercase tracking-widest opacity-60">${p.price.toLocaleString()}</p>
                   </div>
                </div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}


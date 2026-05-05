import { useState } from "react";
import { Lead, Viewing, LeadStatus, ViewingStatus } from "../types";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { createAutoReminder } from "../services/reminderService";
import { updateLeadScore } from "../services/scoringService";
import { X, Save, Clock, MapPin, DollarSign, Calendar, MessageSquare, CheckCircle2, TrendingUp } from "lucide-react";
import { motion } from "motion/react";

interface LeadCRMFormProps {
  lead: Lead;
  onClose: () => void;
  viewings: Viewing[];
}

export function LeadCRMForm({ lead, onClose, viewings }: LeadCRMFormProps) {
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [isSaving, setIsSaving] = useState(false);

  const leadViewings = viewings.filter(v => v.leadId === lead.id);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const hasStatusChanged = status !== lead.status;
      const updatedLead = { ...lead, status };
      
      await updateDoc(doc(db, 'leads', lead.id), {
        status,
        lastActive: serverTimestamp()
      });

      await updateLeadScore(updatedLead);

      if (hasStatusChanged) {
        await createAutoReminder({ ...lead, status }, status, viewings);
      }
      
      onClose();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `leads/${lead.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const statusProgress = {
    [LeadStatus.NEW]: 15,
    [LeadStatus.CONTACTED]: 35,
    [LeadStatus.INTERESTED]: 55,
    [LeadStatus.VIEWING_SCHEDULED]: 75,
    [LeadStatus.VIEWING_COMPLETED]: 90,
    [LeadStatus.CLOSED]: 100,
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-sm shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[var(--color-paper)]/30">
          <div>
            <h2 className="font-serif text-3xl tracking-tight">{lead.name}</h2>
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 font-bold">{lead.email}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-8">
            {/* Pipeline Progress */}
            <div>
              <div className="flex justify-between items-end mb-4">
                <h3 className="text-[11px] uppercase tracking-widest font-bold opacity-40">Progresso do Lead</h3>
                <span className="text-[var(--color-gold)] font-bold text-xs uppercase tracking-widest">
                  {status.replace('_', ' ')}
                </span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${statusProgress[status]}%` }}
                  className="h-full bg-[var(--color-ink)]"
                />
              </div>
              <div className="grid grid-cols-6 mt-2 text-[8px] uppercase tracking-tighter font-bold opacity-30">
                <span>Novo</span>
                <span>Contatado</span>
                <span>Interesse</span>
                <span>Visita</span>
                <span>Concluído</span>
                <span className="text-right">Fechado</span>
              </div>
            </div>

            {/* Qualification Data */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
              <div className="p-4 bg-gray-50 rounded-sm border border-gray-100 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-2 text-[var(--color-gold)]">
                  <TrendingUp size={14} />
                  <span className="text-[10px] uppercase tracking-widest font-bold">Priority Score</span>
                </div>
                <p className="text-2xl font-serif text-[var(--color-ink)]">{lead.score || 0}</p>
                <div className="absolute bottom-0 left-0 h-1 bg-[var(--color-gold)]" style={{ width: `${lead.score || 0}%` }} />
              </div>
              <div className="p-4 bg-gray-50 rounded-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-2 text-[var(--color-gold)]">
                  <DollarSign size={14} />
                  <span className="text-[10px] uppercase tracking-widest font-bold">Orçamento</span>
                </div>
                <p className="text-sm font-medium">{lead.budget || "Não informado"}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-2 text-[var(--color-gold)]">
                  <MapPin size={14} />
                  <span className="text-[10px] uppercase tracking-widest font-bold">Localização</span>
                </div>
                <p className="text-sm font-medium">{lead.locationPreference || "Não informado"}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-2 text-[var(--color-gold)]">
                  <Clock size={14} />
                  <span className="text-[10px] uppercase tracking-widest font-bold">Prazo</span>
                </div>
                <p className="text-sm font-medium">{lead.timeline || "Não informado"}</p>
              </div>
            </div>

            {/* Viewings List */}
            <div>
              <h3 className="text-[11px] uppercase tracking-widest font-bold opacity-40 mb-4 flex items-center gap-2">
                <Calendar size={14} />
                Histórico de Visitas
              </h3>
              <div className="space-y-3">
                {leadViewings.length === 0 ? (
                  <p className="text-sm italic opacity-50">Nenhuma visita agendada ainda.</p>
                ) : (
                  leadViewings.map(v => (
                    <div key={v.id} className="p-4 border border-gray-100 rounded-sm flex justify-between items-center">
                      <div>
                        <div className="text-xs font-bold">{new Date(v.dateTime).toLocaleString('pt-BR')}</div>
                        <div className="text-[10px] opacity-50 font-serif">Imóvel ID: {v.propertyId}</div>
                      </div>
                      <div className={`text-[9px] uppercase tracking-widest font-bold px-2 py-1 rounded-full ${
                        v.status === ViewingStatus.CONFIRMED ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                      }`}>
                        {v.status === ViewingStatus.CONFIRMED ? 'Confirmado' : 'Pendente'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Actions & Meta */}
          <div className="bg-gray-50 p-6 space-y-6">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold mb-3 opacity-50">Status do Processo</label>
              <select 
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
                className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]"
              >
                {Object.values(LeadStatus).map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ').toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div className="space-y-4 pt-6 border-t border-gray-200">
              <div className="flex items-center gap-2 text-[10px] font-bold opacity-60">
                <Clock size={12} />
                Capturado em: {new Date(lead.createdAt?.toDate?.() || lead.createdAt).toLocaleDateString('pt-BR')}
              </div>
              {lead.crmSynced && (
                <div className="flex items-center gap-2 text-[10px] text-green-600 font-bold">
                  <CheckCircle2 size={12} />
                  Sincronizado com CRM Externo
                </div>
              )}
            </div>

            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="w-full mt-8 bg-[var(--color-ink)] text-white py-3 rounded-sm text-[10px] uppercase tracking-[0.2em] font-bold hover:translate-y-[-2px] transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg"
            >
              <Save size={16} />
              {isSaving ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

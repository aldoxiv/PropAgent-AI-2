import { useState, useEffect } from "react";
import { AvailabilitySlot } from "../types";
import { getAvailableSlots } from "../services/schedulingService";
import { motion, AnimatePresence } from "motion/react";
import { Calendar, Clock, ChevronRight, Check } from "lucide-react";

interface BookingCalendarProps {
  onSelect: (slot: AvailabilitySlot) => void;
  onCancel: () => void;
}

export function BookingCalendar({ onSelect, onCancel }: BookingCalendarProps) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    async function loadSlots() {
      const data = await getAvailableSlots(Date.now());
      setSlots(data);
      setLoading(false);
    }
    loadSlots();
  }, []);

  const groupedSlots = slots.reduce((acc, slot) => {
    const date = new Date(slot.startTime).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {} as Record<string, AvailabilitySlot[]>);

  const dates = Object.keys(groupedSlots).sort((a, b) => {
     // Basic sort - in real app would use timestamps
     return groupedSlots[a][0].startTime - groupedSlots[b][0].startTime;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-[rgba(26,26,26,0.1)] rounded-sm p-4 my-4 overflow-hidden"
    >
      <div className="flex items-center gap-2 mb-4 text-[var(--color-gold)]">
        <Calendar size={16} />
        <h4 className="text-[10px] uppercase tracking-widest font-bold">Agendar Visita</h4>
      </div>

      {loading ? (
        <div className="py-8 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-gold)]"></div>
        </div>
      ) : slots.length === 0 ? (
        <p className="text-sm text-center py-4 opacity-50">Nenhum horário disponível no momento.</p>
      ) : (
        <div className="space-y-4">
          {!selectedDate ? (
            <div className="grid grid-cols-1 gap-2">
              {dates.map(date => (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className="flex items-center justify-between p-3 border border-[rgba(26,26,26,0.1)] hover:bg-[var(--color-paper)] transition-colors text-left group"
                >
                  <span className="text-sm capitalize">{date}</span>
                  <ChevronRight size={14} className="opacity-30 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          ) : (
            <div>
              <button 
                onClick={() => setSelectedDate(null)}
                className="text-[10px] uppercase tracking-widest opacity-50 mb-4 hover:opacity-100 transition-opacity"
              >
                ← Voltar para datas
              </button>
              <h5 className="text-xs font-bold mb-3 capitalize text-[rgba(26,26,26,0.7)]">{selectedDate}</h5>
              <div className="grid grid-cols-2 gap-2">
                {groupedSlots[selectedDate].map(slot => (
                  <button
                    key={slot.id}
                    onClick={() => onSelect(slot)}
                    className="flex items-center gap-2 p-3 border border-[rgba(26,26,26,0.1)] hover:bg-[var(--color-ink)] hover:text-white transition-all text-sm group"
                  >
                    <Clock size={12} className="opacity-50 group-hover:opacity-100" />
                    {new Date(slot.startTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <button 
        onClick={onCancel}
        className="w-full mt-4 py-2 border-t border-[rgba(26,26,26,0.05)] text-[10px] uppercase tracking-widest text-center opacity-40 hover:opacity-100 transition-opacity"
      >
        Cancelar agendamento
      </button>
    </motion.div>
  );
}

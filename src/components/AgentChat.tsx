import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Message, Lead, Property, LeadStatus, ViewingStatus } from "../types";
import { Send, X, Bot, User, Calendar, Loader2 } from "lucide-react";
import { getAgentResponse } from "../services/geminiService";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc } from "firebase/firestore";
import { pushToCRM } from "../services/crmService";
import { createAutoReminder } from "../services/reminderService";

interface AgentChatProps {
  initialProperty?: Property;
  onClose: () => void;
}

export function AgentChat({ initialProperty, onClose }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: initialProperty 
        ? `Olá! Vejo que você está interessado em ${initialProperty.title}. Eu sou o PropAgent AI, como posso ajudar você com este imóvel?` 
        : "Olá! Eu sou o PropAgent AI. Você está procurando um novo lar ou investindo em propriedades?",
      sender: "agent",
      timestamp: Date.now(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lead, setLead] = useState<Partial<Lead>>({ status: LeadStatus.NEW });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: "user",
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Get AI response
      const result = await getAgentResponse(messages.concat(userMessage), lead, initialProperty);
      
      let aiText = result.text || "Estou processando isso para você.";
      
      if (result.functionCalls) {
        for (const call of result.functionCalls) {
          if (call.name === 'registerLead') {
            const { name, email } = call.args as { name: string; email: string };
            const leadData = {
              name,
              email,
              status: LeadStatus.NEW,
              createdAt: serverTimestamp(),
              lastActive: serverTimestamp(),
              propertyId: initialProperty?.id || null,
            };
            const leadRef = await addDoc(collection(db, 'leads'), leadData).catch(e => handleFirestoreError(e, OperationType.CREATE, 'leads'));
            if (!leadRef) return;
            const newLead = { ...leadData, id: leadRef.id } as any;
            setLead(newLead);
            
            // Trigger Welcome Email (Simulation)
            try {
              const settingsSnap = await getDoc(doc(db, 'settings', 'global')).catch(e => handleFirestoreError(e, OperationType.GET, 'settings/global'));
              if (!settingsSnap) return;
              const settings = settingsSnap.data();
              if (settings) {
                const subject = settings.welcomeEmailSubject || "Welcome to PropAgent AI";
                const body = (settings.welcomeEmailBody || "Hello {name}, thank you for your interest.").replace("{name}", name);
                
                // Logging the email "send" action to Firestore for tracking
                await addDoc(collection(db, 'leads', leadRef.id, 'messages'), {
                  text: `[SYSTEM: Welcome Email Sent]\nSubject: ${subject}\nBody: ${body}`,
                  sender: 'agent',
                  timestamp: serverTimestamp(),
                  type: 'system_notification'
                }).catch(e => handleFirestoreError(e, OperationType.CREATE, `leads/${leadRef.id}/messages`));
                console.log(`Email dispatched to ${email}: ${subject}`);
              }
            } catch (e) {
              console.error("Failed to fetch settings for welcome email", e);
            }

            aiText = `Obrigado, ${name}. Registrei seu interesse e enviei um e-mail de boas-vindas para ${email}. Como posso ajudar mais?`;
          }

          if (call.name === 'qualifyLead') {
            const { budget, locationPreference, timeline } = call.args as { budget: string; locationPreference: string; timeline: string };
            if (lead.id) {
              const qualificationData = {
                budget,
                locationPreference,
                timeline,
                status: LeadStatus.INTERESTED,
                lastActive: serverTimestamp()
              };
              
              await updateDoc(doc(db, 'leads', lead.id), qualificationData)
                .catch(e => handleFirestoreError(e, OperationType.UPDATE, `leads/${lead.id}`));
              
              const updatedLead = { ...lead, ...qualificationData } as Lead;
              setLead(updatedLead);
              
              // Trigger auto-reminder
              await createAutoReminder(updatedLead, LeadStatus.INTERESTED);
              
              // Push to CRM after qualification
              aiText = "Obrigado por esses detalhes. Estou atualizando nossa equipe de consultores premium agora mesmo. ";
              pushToCRM(updatedLead).then(success => {
                if (success) {
                  console.log("CRM Sync complete");
                }
              });

              aiText += "Registrei suas preferências. Gostaria de agendar uma visita para um de nossos imóveis agora?";
            } else {
              aiText = "Eu tenho suas preferências, mas ainda preciso do seu nome e e-mail para salvá-las corretamente. Poderia informá-los primeiro?";
            }
          }
          
          if (call.name === 'scheduleViewing') {
            const { dateTime } = call.args as { dateTime: string };
            // Auto schedule in Firebase
            if (lead.id && (initialProperty?.id || lead.propertyId)) {
              const viewingData = {
                leadId: lead.id,
                propertyId: initialProperty?.id || lead.propertyId,
                dateTime: new Date(dateTime).getTime(),
                status: ViewingStatus.PENDING,
                createdAt: serverTimestamp()
              };
              
              await addDoc(collection(db, 'viewings'), viewingData).catch(e => handleFirestoreError(e, OperationType.CREATE, 'viewings'));
              
              // Update lead status
              await updateDoc(doc(db, 'leads', lead.id), { status: LeadStatus.VIEWING_SCHEDULED, lastActive: serverTimestamp() })
                .catch(e => handleFirestoreError(e, OperationType.UPDATE, `leads/${lead.id}`));
              
              const updatedLead = { ...lead, status: LeadStatus.VIEWING_SCHEDULED } as Lead;
              setLead(updatedLead);

              // Trigger auto-reminder
              await createAutoReminder(updatedLead, LeadStatus.VIEWING_SCHEDULED, [], viewingData);

              aiText = `Solicitei com sucesso uma visita para você em ${new Date(dateTime).toLocaleString('pt-BR')}. Nossa equipe confirmará em breve. Deseja algo mais?`;
            } else if (!lead.id) {
              aiText = "Eu adoraria agendar essa visita para você, mas preciso de suas informações de contato primeiro. Poderia fornecer seu nome e e-mail?";
            } else {
              aiText = "Qual imóvel você gostaria de visitar? Não vejo nenhum selecionado em nossa conversa atual.";
            }
          }

          if (call.name === 'setFollowUp') {
            const { text, dateTime } = call.args as { text: string; dateTime: string };
            if (lead.id) {
              await addDoc(collection(db, 'reminders'), {
                leadId: lead.id,
                text,
                dateTime: new Date(dateTime).getTime(),
                completed: false,
                createdAt: serverTimestamp()
              }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'reminders'));
              aiText = `Entendido. Defini um lembrete de acompanhamento para nossa equipe entrar em contato com você sobre "${text}" em ${new Date(dateTime).toLocaleString('pt-BR')}.`;
            } else {
              aiText = "Gostaria de configurar esse acompanhamento para você, mas preciso do seu nome e e-mail primeiro. Poderia fornecê-los?";
            }
          }
        }
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: aiText,
        sender: "agent",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-white shadow-2xl rounded-lg overflow-hidden flex flex-col border border-[rgba(26,26,26,0.1)] z-50"
    >
      {/* Header */}
      <div className="bg-[var(--color-ink)] p-6 text-white flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[var(--color-gold)] rounded-full flex items-center justify-center">
            <Bot size={24} />
          </div>
          <div>
            <h3 className="font-serif text-xl leading-none">PropAgent AI</h3>
            <span className="text-[10px] uppercase tracking-widest opacity-60">Assistente Pessoal</span>
          </div>
        </div>
        <button onClick={onClose} className="opacity-60 hover:opacity-100 transition-opacity">
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 bg-[var(--color-paper)]/30"
      >
        {messages.map((m) => (
          <div 
            key={m.id} 
            className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex gap-3 max-w-[85%] ${m.sender === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                m.sender === 'user' ? 'bg-[var(--color-gold)]' : 'bg-white border border-[rgba(26,26,26,0.1)]'
              }`}>
                {m.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                m.sender === 'user' 
                  ? 'bg-[var(--color-ink)] text-white' 
                  : 'bg-white shadow-sm'
              }`}>
                {m.text}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white p-4 rounded-2xl shadow-sm italic text-xs text-[rgba(26,26,26,0.5)] flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Pensando...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-6 border-t border-[rgba(26,26,26,0.1)] bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Digite uma mensagem..."
            className="flex-1 bg-transparent border-none outline-none text-sm font-sans"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <button 
            disabled={isLoading || !inputValue.trim()}
            onClick={handleSendMessage}
            className="w-10 h-10 bg-[var(--color-gold)] text-white rounded-full flex items-center justify-center disabled:opacity-50 hover:bg-opacity-90 transition-all"
            id="send-message-btn"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

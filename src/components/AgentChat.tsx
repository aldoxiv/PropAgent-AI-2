import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Message, Lead, Property, LeadStatus, ViewingStatus, AvailabilitySlot } from "../types";
import { Send, X, Bot, User, Calendar, Loader2, CheckCircle2 } from "lucide-react";
import { getAgentResponse } from "../services/geminiService";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc } from "firebase/firestore";
import { pushToCRM } from "../services/crmService";
import { createAutoReminder } from "../services/reminderService";
import { updateLeadScore } from "../services/scoringService";
import { BookingCalendar } from "./BookingCalendar";
import { bookViewing } from "../services/schedulingService";

interface AgentChatProps {
  initialProperty?: Property;
  onClose: () => void;
}

enum ChatScriptStep {
  OPENING = "OPENING",
  
  // INVESTOR FLOW
  INVESTOR_EXPERIENCE = "INVESTOR_EXPERIENCE",
  INVESTOR_PROP_TYPE = "INVESTOR_PROP_TYPE",
  INVESTOR_METRAGEM = "INVESTOR_METRAGEM",
  INVESTOR_LOCALIZACAO = "INVESTOR_LOCALIZACAO",
  INVESTOR_METRO = "INVESTOR_METRO",
  INVESTOR_ORCAMENTO = "INVESTOR_ORCAMENTO",
  INVESTOR_APRESENTACAO = "INVESTOR_APRESENTACAO",
  INVESTOR_ENCAMINHAMENTO = "INVESTOR_ENCAMINHAMENTO",
  
  // MORADIA FLOW
  MORADIA_PERFIL = "MORADIA_PERFIL",
  MORADIA_USO = "MORADIA_USO",
  MORADIA_DORMITORIOS = "MORADIA_DORMITORIOS",
  MORADIA_METRAGEM = "MORADIA_METRAGEM",
  MORADIA_VAGA = "MORADIA_VAGA",
  MORADIA_LOCALIZACAO = "MORADIA_LOCALIZACAO",
  MORADIA_AJUDA_GUIADA = "MORADIA_AJUDA_GUIADA",
  MORADIA_AJUSTE_PORTFOLIO = "MORADIA_AJUSTE_PORTFOLIO",
  MORADIA_ENCAMINHAMENTO = "MORADIA_ENCAMINHAMENTO",
  
  // CAPTURE FLOW
  CAPTURE_NAME = "CAPTURE_NAME",
  CAPTURE_EMAIL = "CAPTURE_EMAIL",
  
  // EXTRA
  URGENCIA = "URGENCIA",
  FORMA_PAGAMENTO = "FORMA_PAGAMENTO",
  
  // FINISH
  FINAL_HANDOFF = "FINAL_HANDOFF",
  FREE_CHAT = "FREE_CHAT"
}

interface BotOption {
  label: string;
  value: string;
  next: ChatScriptStep;
}

const STEP_CONFIGS: Record<string, {
  text: string | ((answers: Record<string, string>) => string);
  options?: BotOption[] | ((answers: Record<string, string>) => BotOption[]);
  inputType: "buttons" | "text" | "both" | "none";
  placeholder?: string;
  defaultNext?: ChatScriptStep;
}> = {
  [ChatScriptStep.OPENING]: {
    text: "Olá! 😊 Tudo bem?\nVou te ajudar a encontrar o imóvel ideal bem rápido.\n\n👉 Me diga: você está procurando um imóvel para…",
    inputType: "buttons",
    options: [
      { label: "🏢 Investir", value: "Investir", next: ChatScriptStep.INVESTOR_EXPERIENCE },
      { label: "🏠 Morar", value: "Morar", next: ChatScriptStep.MORADIA_PERFIL },
    ]
  },
  
  // INVESTOR
  [ChatScriptStep.INVESTOR_EXPERIENCE]: {
    text: "Ótimo! 👌\nVocê já investe em imóveis ou seria seu primeiro investimento?",
    inputType: "buttons",
    options: [
      { label: "Primeiro investimento", value: "Primeiro investimento", next: ChatScriptStep.INVESTOR_PROP_TYPE },
      { label: "Já invisto", value: "Já invisto", next: ChatScriptStep.INVESTOR_PROP_TYPE }
    ]
  },
  [ChatScriptStep.INVESTOR_PROP_TYPE]: {
    text: "Perfeito 👍\nQual tipo de imóvel você tem mais interesse?",
    inputType: "buttons",
    options: [
      { label: "Studio / Compacto", value: "Studio / Compacto", next: ChatScriptStep.INVESTOR_METRAGEM },
      { label: "1 dormitório", value: "1 dormitório", next: ChatScriptStep.INVESTOR_METRAGEM },
      { label: "2 dormitórios", value: "2 dormitórios", next: ChatScriptStep.INVESTOR_METRAGEM },
      { label: "Ainda estou avaliando", value: "Ainda estou avaliando", next: ChatScriptStep.INVESTOR_METRAGEM }
    ]
  },
  [ChatScriptStep.INVESTOR_METRAGEM]: {
    text: "E sobre o tamanho, tem alguma metragem em mente?",
    inputType: "buttons",
    options: [
      { label: "Até 30m²", value: "Até 30m²", next: ChatScriptStep.INVESTOR_LOCALIZACAO },
      { label: "30m² a 50m²", value: "30m² a 50m²", next: ChatScriptStep.INVESTOR_LOCALIZACAO },
      { label: "50m² a 70m²", value: "50m² a 70m²", next: ChatScriptStep.INVESTOR_LOCALIZACAO },
      { label: "Mais de 70m²", value: "Mais de 70m²", next: ChatScriptStep.INVESTOR_LOCALIZACAO },
      { label: "Não tenho certeza", value: "Não tenho certeza", next: ChatScriptStep.INVESTOR_LOCALIZACAO }
    ]
  },
  [ChatScriptStep.INVESTOR_LOCALIZACAO]: {
    text: "Tem alguma região ou bairro de preferência? 📍\n\n(Você pode digitar ou escolher o botão abaixo)",
    inputType: "both",
    placeholder: "Ex: Jardins, Pinheiros...",
    options: [
      { label: "Não tenho preferência", value: "Sem preferência", next: ChatScriptStep.INVESTOR_METRO }
    ],
    defaultNext: ChatScriptStep.INVESTOR_METRO
  },
  [ChatScriptStep.INVESTOR_METRO]: {
    text: "Para você é importante estar próximo ao metrô ou transporte?",
    inputType: "buttons",
    options: [
      { label: "Sim", value: "Próximo ao metrô: Sim", next: ChatScriptStep.INVESTOR_ORCAMENTO },
      { label: "Não", value: "Próximo ao metrô: Não", next: ChatScriptStep.INVESTOR_ORCAMENTO },
      { label: "Indiferente", value: "Próximo ao metrô: Indiferente", next: ChatScriptStep.INVESTOR_ORCAMENTO }
    ]
  },
  [ChatScriptStep.INVESTOR_ORCAMENTO]: {
    text: "Você já tem uma faixa de valor para investir?",
    inputType: "buttons",
    options: [
      { label: "Até R$ 300 mil", value: "Até R$ 300 mil", next: ChatScriptStep.INVESTOR_APRESENTACAO },
      { label: "R$ 300 a 500 mil", value: "R$ 300 a 500 mil", next: ChatScriptStep.INVESTOR_APRESENTACAO },
      { label: "R$ 500 a 800 mil", value: "R$ 500 a 800 mil", next: ChatScriptStep.INVESTOR_APRESENTACAO },
      { label: "Acima de R$ 800 mil", value: "Acima de R$ 800 mil", next: ChatScriptStep.INVESTOR_APRESENTACAO }
    ]
  },
  [ChatScriptStep.INVESTOR_APRESENTACAO]: {
    text: "Perfeito! 👇 Com base no que você me disse, selecionei algumas opções interessantes no nosso portfólio:\n\n👉 **Elysium Parkside**\n• Metragens: 45m² a 75m²\n• Valor médio m²: R$ 12.500\n• Próximo ao metrô: Sim\n\n👉 **High-end Smart Studio**\n• Metragens: 28m² a 35m²\n• Valor médio m²: R$ 9.800\n• Próximo ao metrô: Sim\n\nAlguma dessas opções te chamou atenção?",
    inputType: "buttons",
    options: [
      { label: "Sim 👍", value: "Sim", next: ChatScriptStep.INVESTOR_ENCAMINHAMENTO },
      { label: "Quero ver outras opções", value: "Quero ver outras opções", next: ChatScriptStep.INVESTOR_ENCAMINHAMENTO }
    ]
  },
  [ChatScriptStep.INVESTOR_ENCAMINHAMENTO]: {
    text: "Legal! Posso te conectar com um consultor especialista que vai te apresentar as melhores oportunidades e condições 👍",
    inputType: "buttons",
    options: [
      { label: "Falar com consultor", value: "Falar com consultor", next: ChatScriptStep.URGENCIA },
      { label: "Prefiro ver mais depois", value: "Prefiro ver mais depois", next: ChatScriptStep.URGENCIA }
    ]
  },
  
  // MORADIA
  [ChatScriptStep.MORADIA_PERFIL]: {
    text: "Perfeito! Vamos achar algo ideal pra você 🏠\nPara quantas pessoas seria o imóvel?",
    inputType: "buttons",
    options: [
      { label: "Só para mim", value: "Só para mim", next: ChatScriptStep.MORADIA_USO },
      { label: "Casal", value: "Casal", next: ChatScriptStep.MORADIA_DORMITORIOS },
      { label: "Família", value: "Família", next: ChatScriptStep.MORADIA_DORMITORIOS }
    ]
  },
  [ChatScriptStep.MORADIA_USO]: {
    text: "Você pretende morar sozinho(a) em um imóvel mais compacto?",
    inputType: "buttons",
    options: [
      { label: "Sim", value: "Sim", next: ChatScriptStep.MORADIA_DORMITORIOS },
      { label: "Não", value: "Não", next: ChatScriptStep.MORADIA_DORMITORIOS }
    ]
  },
  [ChatScriptStep.MORADIA_DORMITORIOS]: {
    text: "Quantos dormitórios você procura?",
    inputType: "buttons",
    options: [
      { label: "Studio", value: "Studio", next: ChatScriptStep.MORADIA_METRAGEM },
      { label: "1 dormitório", value: "1 dormitório", next: ChatScriptStep.MORADIA_METRAGEM },
      { label: "2 dormitórios", value: "2 dormitórios", next: ChatScriptStep.MORADIA_METRAGEM },
      { label: "3 ou mais", value: "3 ou mais", next: ChatScriptStep.MORADIA_METRAGEM }
    ]
  },
  [ChatScriptStep.MORADIA_METRAGEM]: {
    text: "Qual metragem você considera ideal?",
    inputType: "buttons",
    options: [
      { label: "Até 40m²", value: "Até 40m²", next: ChatScriptStep.MORADIA_VAGA },
      { label: "40 a 60m²", value: "40 a 60m²", next: ChatScriptStep.MORADIA_VAGA },
      { label: "60 a 90m²", value: "60 a 90m²", next: ChatScriptStep.MORADIA_VAGA },
      { label: "Acima de 90m²", value: "Acima de 90m²", next: ChatScriptStep.MORADIA_VAGA }
    ]
  },
  [ChatScriptStep.MORADIA_VAGA]: {
    text: "Precisa de vaga de garagem?",
    inputType: "buttons",
    options: [
      { label: "Sim", value: "Vaga: Sim", next: ChatScriptStep.MORADIA_LOCALIZACAO },
      { label: "Não", value: "Vaga: Não", next: ChatScriptStep.MORADIA_LOCALIZACAO },
      { label: "Indiferente", value: "Vaga: Indiferente", next: ChatScriptStep.MORADIA_LOCALIZACAO }
    ]
  },
  [ChatScriptStep.MORADIA_LOCALIZACAO]: {
    text: "Tem alguma região ou bairro de preferência? 📍\n\n(Você pode digitar ou escolher uma opção)",
    inputType: "both",
    placeholder: "Ex: Pinheiros, Vila Mariana...",
    options: [
      { label: "Não sei / Ajudar a escolher", value: "Não sei / Ajudar a escolher", next: ChatScriptStep.MORADIA_AJUDA_GUIADA }
    ],
    defaultNext: ChatScriptStep.MORADIA_AJUSTE_PORTFOLIO
  },
  [ChatScriptStep.MORADIA_AJUDA_GUIADA]: {
    text: "Sem problema 😊\nQual desses perfis combina mais com você?",
    inputType: "buttons",
    options: [
      { label: "Próximo ao trabalho", value: "Próximo ao trabalho", next: ChatScriptStep.MORADIA_AJUSTE_PORTFOLIO },
      { label: "Perto de metrô", value: "Perto de metrô", next: ChatScriptStep.MORADIA_AJUSTE_PORTFOLIO },
      { label: "Região tranquila", value: "Região tranquila", next: ChatScriptStep.MORADIA_AJUSTE_PORTFOLIO },
      { label: "Com bastante comércio", value: "Com bastante comércio", next: ChatScriptStep.MORADIA_AJUSTE_PORTFOLIO }
    ]
  },
  [ChatScriptStep.MORADIA_AJUSTE_PORTFOLIO]: {
    text: "Caso eu não encontre exatamente o que você busca, posso te sugerir outras opções parecidas?",
    inputType: "buttons",
    options: [
      { label: "Sim", value: "Sim", next: ChatScriptStep.MORADIA_ENCAMINHAMENTO },
      { label: "Não", value: "Não", next: ChatScriptStep.MORADIA_ENCAMINHAMENTO }
    ]
  },
  [ChatScriptStep.MORADIA_ENCAMINHAMENTO]: {
    text: "Perfeito 👍 Já tenho um bom perfil seu!\n\nPosso te conectar com um consultor para te mostrar as melhores opções disponíveis?",
    inputType: "buttons",
    options: [
      { label: "Falar com consultor", value: "Falar com consultor", next: ChatScriptStep.URGENCIA },
      { label: "Ainda não", value: "Ainda não", next: ChatScriptStep.URGENCIA }
    ]
  },
  
  // CAPTURES
  [ChatScriptStep.CAPTURE_NAME]: {
    text: "Para que o consultor especialista possa entrar em contato, qual é o seu **nome completo**?",
    inputType: "text",
    placeholder: "Digite seu nome completo...",
    defaultNext: ChatScriptStep.CAPTURE_EMAIL
  },
  [ChatScriptStep.CAPTURE_EMAIL]: {
    text: (answers) => `Muito prazer, ${answers[ChatScriptStep.CAPTURE_NAME] || "amigo(a)"}! 😊 Agora, poderia me informar o seu melhor **e-mail** de contato?`,
    inputType: "text",
    placeholder: "Digite seu melhor e-mail...",
    defaultNext: ChatScriptStep.URGENCIA
  },
  
  // EXTRAS
  [ChatScriptStep.URGENCIA]: {
    text: "Para quando você pretende comprar?",
    inputType: "buttons",
    options: [
      { label: "Imediato", value: "Imediato", next: ChatScriptStep.FORMA_PAGAMENTO },
      { label: "Nos próximos 3 meses", value: "Nos próximos 3 meses", next: ChatScriptStep.FORMA_PAGAMENTO },
      { label: "Mais pra frente", value: "Mais pra frente", next: ChatScriptStep.FORMA_PAGAMENTO }
    ]
  },
  [ChatScriptStep.FORMA_PAGAMENTO]: {
    text: "Você pretende:",
    inputType: "buttons",
    options: [
      { label: "Financiar", value: "Financiar", next: ChatScriptStep.FINAL_HANDOFF },
      { label: "Pagar à vista", value: "Pagar à vista", next: ChatScriptStep.FINAL_HANDOFF },
      { label: "Ainda avaliando", value: "Ainda avaliando", next: ChatScriptStep.FINAL_HANDOFF }
    ]
  },
  
  // FINISH
  [ChatScriptStep.FINAL_HANDOFF]: {
    text: "Perfeito 👌\n\nJá passei seu perfil para um consultor especialista — ele vai te chamar aqui para te ajudar com as melhores oportunidades.\n\nEnquanto isso, se quiser, posso te mandar mais opções 👍",
    inputType: "buttons",
    options: [
      { label: "Conversar com IA sobre imóveis", value: "Conversar com IA", next: ChatScriptStep.FREE_CHAT },
      { label: "Sair", value: "Sair", next: ChatScriptStep.FREE_CHAT }
    ]
  }
};

export function AgentChat({ initialProperty, onClose }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Olá! 😊 Tudo bem?\nVou te ajudar a encontrar o imóvel ideal bem rápido.\n\n👉 Me diga: você está procurando um imóvel para…",
      sender: "agent",
      timestamp: Date.now(),
    }
  ]);
  const [currentStep, setCurrentStep] = useState<ChatScriptStep>(ChatScriptStep.OPENING);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lead, setLead] = useState<Partial<Lead>>({ status: LeadStatus.NEW });
  const [isBooking, setIsBooking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isBooking, isLoading]);

  const getStepOptions = (step: ChatScriptStep, currentAnswers: Record<string, string>): BotOption[] => {
    const config = STEP_CONFIGS[step];
    if (!config || !config.options) return [];
    return typeof config.options === "function" ? config.options(currentAnswers) : config.options;
  };

  const advanceFlow = async (
    inputValueForStep?: string,
    optionValueForStep?: string,
    nextStepOverride?: ChatScriptStep
  ) => {
    setIsLoading(true);
    try {
      // Determine the next step
      let nextStep = nextStepOverride;
      const config = STEP_CONFIGS[currentStep];
      
      // Save answer
      const currentVal = optionValueForStep || inputValueForStep || "";
      const newAnswers = { ...answers, [currentStep]: currentVal };
      setAnswers(newAnswers);
      
      if (!nextStep) {
        if (optionValueForStep && config?.options) {
          const foundOption = getStepOptions(currentStep, answers).find(
            o => o.value === optionValueForStep || o.label === optionValueForStep
          );
          if (foundOption) {
            nextStep = foundOption.next;
          }
        }
        if (!nextStep && config?.defaultNext) {
          nextStep = config.defaultNext;
        }
      }
      
      if (!nextStep) {
        nextStep = ChatScriptStep.FREE_CHAT;
      }
      
      // Dynamic transition Checks
      if (currentStep === ChatScriptStep.INVESTOR_ENCAMINHAMENTO || currentStep === ChatScriptStep.MORADIA_ENCAMINHAMENTO) {
        if (!lead.id) {
          nextStep = ChatScriptStep.CAPTURE_NAME;
        } else {
          nextStep = ChatScriptStep.URGENCIA;
        }
      }

      // Capture flow logic:
      if (currentStep === ChatScriptStep.CAPTURE_NAME) {
        nextStep = ChatScriptStep.CAPTURE_EMAIL;
      } else if (currentStep === ChatScriptStep.CAPTURE_EMAIL) {
        // Create lead in Firestore
        const name = newAnswers[ChatScriptStep.CAPTURE_NAME] || "Cliente";
        const email = currentVal;
        
        const leadData: any = {
          name,
          email,
          status: LeadStatus.NEW,
          createdAt: serverTimestamp(),
          lastActive: serverTimestamp(),
          crmSynced: false
        };
        if (initialProperty?.id) {
          leadData.propertyId = initialProperty.id;
        }
        
        try {
          const leadRef = await addDoc(collection(db, 'leads'), leadData);
          const newLead = { ...leadData, id: leadRef.id } as any;
          setLead(newLead);
          await updateLeadScore(newLead);
          
          // Trigger Welcome Email (Simulation)
          const settingsSnap = await getDoc(doc(db, 'settings', 'global')).catch(e => handleFirestoreError(e, OperationType.GET, 'settings/global'));
          if (settingsSnap) {
            const settings = settingsSnap.data();
            if (settings) {
              const subject = settings.welcomeEmailSubject || "Welcome to PropAgent AI";
              const body = (settings.welcomeEmailBody || "Hello {name}, thank you for your interest.").replace("{name}", name);
              
              await addDoc(collection(db, 'leads', leadRef.id, 'messages'), {
                text: `[SYSTEM: Welcome Email Sent]\nSubject: ${subject}\nBody: ${body}`,
                sender: 'agent',
                timestamp: serverTimestamp(),
                type: 'system_notification'
              });
            }
          }
        } catch (e) {
          console.error("Failed to register lead", e);
        }
        
        nextStep = ChatScriptStep.URGENCIA;
      }

      // Final qualification saving at final handoff or when completing
      if (nextStep === ChatScriptStep.FINAL_HANDOFF) {
        if (lead.id) {
          const budget = newAnswers[ChatScriptStep.INVESTOR_ORCAMENTO] || "Não especificado";
          const locationPreference = newAnswers[ChatScriptStep.INVESTOR_LOCALIZACAO] || newAnswers[ChatScriptStep.MORADIA_LOCALIZACAO] || newAnswers[ChatScriptStep.MORADIA_AJUDA_GUIADA] || "Não especificado";
          const timeline = newAnswers[ChatScriptStep.URGENCIA] || "Não especificado";
          const formPagamento = newAnswers[ChatScriptStep.FORMA_PAGAMENTO] || "Não especificado";
          
          const qualificationData = {
            budget,
            locationPreference,
            timeline,
            status: LeadStatus.INTERESTED,
            lastActive: serverTimestamp()
          };
          
          try {
            await updateDoc(doc(db, 'leads', lead.id), qualificationData);
            const updatedLead = { ...lead, ...qualificationData } as Lead;
            setLead(updatedLead);
            
            await updateLeadScore(updatedLead);
            await createAutoReminder(updatedLead, LeadStatus.INTERESTED);
            
            await addDoc(collection(db, 'leads', lead.id, 'messages'), {
              text: `[SYSTEM: Qualification Complete]\nBudget: ${budget}\nLocation: ${locationPreference}\nTimeline: ${timeline}\nForma de Pagamento: ${formPagamento}`,
              sender: 'agent',
              timestamp: serverTimestamp(),
              type: 'system_notification'
            });

            await pushToCRM(updatedLead);
          } catch (e) {
            console.error("Failed to update lead metrics", e);
          }
        }
      }

      // Set step
      setCurrentStep(nextStep);

      // Simulate standard response delay
      setTimeout(() => {
        const nextConfig = STEP_CONFIGS[nextStep];
        let botText = "";
        if (nextConfig) {
          botText = typeof nextConfig.text === "function" ? nextConfig.text(newAnswers) : nextConfig.text;
        } else {
          botText = "Olá! Como posso ajudar você agora?";
        }

        const botMsg: Message = {
          id: Date.now().toString(),
          text: botText,
          sender: "agent",
          timestamp: Date.now(),
        };
        
        setMessages(prev => [...prev, botMsg]);
        setIsLoading(false);
      }, 600);
    } catch (unhandledErr) {
      console.error("[ADVANCE FLOW ERROR]:", unhandledErr);
      setIsLoading(false);
      const botMsg: Message = {
        id: Date.now().toString(),
        text: "Desculpe pelo transtorno. Tivemos um pequeno problema de rede, mas já podemos continuar! Qual o seu próximo passo?",
        sender: "agent",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, botMsg]);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: "user",
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const typedText = inputValue;
    setInputValue("");

    if (currentStep === ChatScriptStep.FREE_CHAT) {
      setIsLoading(true);
      try {
        const result = await getAgentResponse(messages.concat(userMessage), lead, initialProperty);
        let aiText = result.text || "";
        
        if (result.functionCalls) {
          for (const call of result.functionCalls) {
            if (call.name === 'registerLead') {
              const { name, email } = call.args as { name: string; email: string };
              const leadData: any = {
                name,
                email,
                status: LeadStatus.NEW,
                createdAt: serverTimestamp(),
                lastActive: serverTimestamp(),
              };
              if (initialProperty?.id) {
                leadData.propertyId = initialProperty.id;
              }
              const leadRef = await addDoc(collection(db, 'leads'), leadData).catch(e => handleFirestoreError(e, OperationType.CREATE, 'leads'));
              if (!leadRef) return;
              const newLead = { ...leadData, id: leadRef.id } as any;
              setLead(newLead);
              await updateLeadScore(newLead);
              
              if (!aiText) aiText = `Obrigado, ${name}. Salvei seu contato e enviei uma saudação excelente para seu e-mail: ${email}.`;
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
                
                await updateDoc(doc(db, 'leads', lead.id), qualificationData);
                const updatedLead = { ...lead, ...qualificationData } as Lead;
                setLead(updatedLead);
                await updateLeadScore(updatedLead);
                await createAutoReminder(updatedLead, LeadStatus.INTERESTED);
                
                if (!aiText) aiText = "Registrei as informações coletadas com sucesso! Como posso ajudá-lo(a) mais?";
              }
            }

            if (call.name === 'scheduleViewing') {
              const { dateTime } = call.args as { dateTime: string };
              if (lead.id && (initialProperty?.id || lead.propertyId)) {
                if (dateTime && dateTime !== "unknown") {
                  const booked = await bookViewing(
                    lead as Lead, 
                    (initialProperty || { id: lead.propertyId }) as Property, 
                    "", 
                    new Date(dateTime).getTime()
                  );
                  
                  if (booked) {
                    await updateDoc(doc(db, 'leads', lead.id), { status: LeadStatus.VIEWING_SCHEDULED, lastActive: serverTimestamp() });
                    const updatedLead = { ...lead, status: LeadStatus.VIEWING_SCHEDULED } as Lead;
                    setLead(updatedLead);
                    await updateLeadScore(updatedLead);
                    await createAutoReminder(updatedLead, LeadStatus.VIEWING_SCHEDULED, [], booked);
                    
                    if (!aiText) aiText = `Perfeito! Confirmei sua visita para ${new Date(dateTime).toLocaleString('pt-BR')}. Enviei o convite do calendário para seu e-mail. Algo mais?`;
                  }
                } else {
                  setIsBooking(true);
                  if (!aiText) aiText = "Com certeza! Escolha o melhor período para você no nosso calendário:";
                }
              }
            }
          }
        }

        if (!aiText) aiText = "Entendido. Como posso ajudar com mais informações ou visitas?";

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
    } else {
      await advanceFlow(typedText, undefined);
    }
  };

  const handleOptionClick = async (option: BotOption) => {
    if (isLoading) return;

    if (option.value === "Sair" || option.label === "Sair") {
      onClose();
      return;
    }

    // 1. Show user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: option.label,
      sender: "user",
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // 2. Handle special buttons directly
    if (currentStep === ChatScriptStep.FINAL_HANDOFF && option.value === "Agendar visita") {
      setIsBooking(true);
      return;
    }

    await advanceFlow(undefined, option.value, option.next);
  };

  const handleBookingSelect = async (slot: AvailabilitySlot) => {
    const activePropertyId = initialProperty?.id || lead.propertyId || "prop_default";
    const propertyToBook = (initialProperty || { id: activePropertyId, title: "Elysium Parkside" }) as Property;

    setIsLoading(true);
    const booked = await bookViewing(
      lead as Lead,
      propertyToBook,
      slot.id,
      slot.startTime
    );

    if (booked) {
      setIsBooking(false);
      
      const successMessage: Message = {
        id: Date.now().toString(),
        text: `Visita agendada com sucesso para ${new Date(slot.startTime).toLocaleString('pt-BR')}! Você receberá uma confirmação por e-mail em breve.`,
        sender: "agent",
        timestamp: Date.now(),
      };
      
      setMessages(prev => [...prev, successMessage]);
      
      if (lead.id) {
        await updateDoc(doc(db, 'leads', lead.id), { status: LeadStatus.VIEWING_SCHEDULED, lastActive: serverTimestamp() });
        const updatedLead = { ...lead, status: LeadStatus.VIEWING_SCHEDULED } as Lead;
        setLead(updatedLead);
        await updateLeadScore(updatedLead);
        await createAutoReminder(updatedLead, LeadStatus.VIEWING_SCHEDULED, [], booked);
      }
    }
    setIsLoading(false);
  };

  const currentConfig = STEP_CONFIGS[currentStep];
  const isTextInputEnabled = currentStep === ChatScriptStep.FREE_CHAT || (currentConfig && (currentConfig.inputType === "text" || currentConfig.inputType === "both"));

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
        className="flex-1 overflow-y-auto p-6 space-y-6 bg-[var(--color-paper)]/30 flex flex-col"
      >
        <div className="flex-1 space-y-6">
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
                <div className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  m.sender === 'user' 
                    ? 'bg-[var(--color-ink)] text-white' 
                    : 'bg-white shadow-sm'
                }`}>
                  {m.text}
                </div>
              </div>
            </div>
          ))}

          {/* Interactive Option Buttons shown inside the chat feed */}
          {!isLoading && !isBooking && (
            <>
              {currentConfig && currentConfig.options && (
                <div className="flex flex-wrap gap-2 justify-start pl-11 pr-4 py-2 fade-in">
                  {getStepOptions(currentStep, answers).map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => handleOptionClick(opt)}
                      className="px-4 py-2.5 bg-white hover:bg-[var(--color-ink)] hover:text-white text-[var(--color-ink)] text-xs border border-[rgba(26,26,26,0.15)] rounded-full transition-all duration-200 shadow-sm active:scale-95 font-medium cursor-pointer"
                      id={`btn-opt-${opt.label.replace(/\s+/g, '-').replace(/[^\w-]/g, '').toLowerCase()}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
              {currentStep === ChatScriptStep.FREE_CHAT && (
                <div className="flex flex-wrap gap-2 justify-start pl-11 pr-4 py-2 fade-in">
                  <button
                    onClick={() => onClose()}
                    className="px-4 py-2.5 bg-white hover:bg-red-500 hover:text-white text-[var(--color-ink)] text-xs border border-[rgba(26,26,26,0.15)] rounded-full transition-all duration-200 shadow-sm active:scale-95 font-medium cursor-pointer"
                    id="btn-opt-free-chat-sair"
                  >
                    Sair
                  </button>
                </div>
              )}
            </>
          )}

          {isBooking && (
            <BookingCalendar 
              onSelect={handleBookingSelect}
              onCancel={() => setIsBooking(false)}
            />
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white p-4 rounded-2xl shadow-sm italic text-xs text-[rgba(26,26,26,0.5)] flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Digitando...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Form */}
      <div className="p-6 border-t border-[rgba(26,26,26,0.1)] bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            disabled={!isTextInputEnabled || isLoading || isBooking}
            placeholder={
              isBooking 
                ? "Escolha um horário acima..." 
                : !isTextInputEnabled 
                  ? "Por favor, selecione uma opção acima..." 
                  : currentConfig?.placeholder || "Digite uma mensagem..."
            }
            className={`flex-1 bg-transparent border-none outline-none text-sm font-sans ${
              !isTextInputEnabled ? "opacity-40 cursor-not-allowed" : "opacity-100"
            }`}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <button 
            disabled={isLoading || !inputValue.trim() || !isTextInputEnabled || isBooking}
            onClick={handleSendMessage}
            className="w-10 h-10 bg-[var(--color-gold)] text-white rounded-full flex items-center justify-center disabled:opacity-30 hover:bg-opacity-90 transition-all cursor-pointer shadow-sm shrink-0"
            id="send-message-btn"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Lead, Message, Property } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const scheduleViewingDeclaration: FunctionDeclaration = {
  name: "scheduleViewing",
  description: "Schedule a property viewing for a lead.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      dateTime: {
        type: Type.STRING,
        description: "The date and time for the viewing in ISO format.",
      }
    },
    required: ["dateTime"],
  },
};

const registerLeadDeclaration: FunctionDeclaration = {
  name: "registerLead",
  description: "Register a lead's contact information (name and email). REQUIRED before qualification or scheduling.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: "The lead's full name.",
      },
      email: {
        type: Type.STRING,
        description: "The lead's email address.",
      }
    },
    required: ["name", "email"],
  },
};

const qualifyLeadDeclaration: FunctionDeclaration = {
  name: "qualifyLead",
  description: "Capture additional qualification details about the lead after registration.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      budget: {
        type: Type.STRING,
        description: "The lead's price range or budget (e.g., $5M-$10M).",
      },
      locationPreference: {
        type: Type.STRING,
        description: "Preferred neighborhoods or cities.",
      },
      timeline: {
        type: Type.STRING,
        description: "Expected time to purchase (e.g., ASAP, next 3 months, just browsing).",
      }
    },
    required: ["budget", "locationPreference", "timeline"],
  },
};

const setFollowUpDeclaration: FunctionDeclaration = {
  name: "setFollowUp",
  description: "Set a follow-up reminder for the real estate agent to contact the lead later.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      text: {
        type: Type.STRING,
        description: "The description of the follow-up task.",
      },
      dateTime: {
        type: Type.STRING,
        description: "The date and time for the follow-up in ISO format.",
      }
    },
    required: ["text", "dateTime"],
  },
};

const SYSTEM_INSTRUCTION = `
Você é o PropAgent AI, um assistente de elite para o mercado imobiliário de luxo.
Sua comunicação deve ser prioritariamente em Português (PT-BR), mantendo um tom profissional, prestativo e sofisticado. Você ainda deve entender outros idiomas, mas responda sempre em português, a menos que o usuário peça explicitamente o contrário.

FLUXO DE CONVERSA:
1. CAPTURA BÁSICA: Nome e E-mail. Use a ferramenta 'registerLead'.
2. QUALIFICAÇÃO: Pergunte sobre orçamento (budget), preferências de localização e prazo (timeline) para a mudança. Use 'qualifyLead' assim que tiver essas três informações.
3. AGENDAMENTO: Se o usuário quiser visitar um imóvel, use 'scheduleViewing'.
4. FOLLOW-UP: Se preferirem contato posterior, use 'setFollowUp'.

CRÍTICO: Você DEVE capturar Nome e E-mail antes de agendar qualquer visita ou fornecer endereços exatos.
`;

export async function getAgentResponse(
  messages: Message[],
  lead: Partial<Lead>,
  property?: Property
) {
  const chatContext = messages.map(m => `${m.sender}: ${m.text}`).join('\n');
  const propertyContext = property 
    ? `Interested in: ${property.title} at ${property.address}. Price: $${property.price}. ${property.description}`
    : "No specific property selected yet.";
  
  const leadStatus = lead.id 
    ? `Registered: ${lead.name} (${lead.email}). Qualified: ${lead.budget ? 'Yes' : 'No'}.`
    : "Not registered yet.";

  const prompt = `
Lead Context: ${leadStatus}
${lead.budget ? `Lead Preferences: Budget ${lead.budget}, Locations ${lead.locationPreference}, Timeline ${lead.timeline}` : ""}
Property Context: ${propertyContext}
Conversation History:
${chatContext}

Current User Message: ${messages[messages.length - 1].text}

Respond naturally as PropAgent AI. 
- Use registerLead if details provided.
- Use qualifyLead if budget/location/timeline info is gathered (and lead is already registered).
- Use scheduleViewing if they want to book a time.
- Use setFollowUp if requested.
  `;

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not defined in the environment.");
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: [scheduleViewingDeclaration, registerLeadDeclaration, qualifyLeadDeclaration, setFollowUpDeclaration] }],
      },
    });

    return {
      text: response.text,
      functionCalls: response.functionCalls
    };
  } catch (error) {
    console.error("Agent Error:", error);
    return { text: "I'm sorry, I encountered an error. Could you try again?" };
  }
}

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
  description: "Register a lead's contact information (name and email).",
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
You are PropAgent AI, a high-end real estate assistant. 
Your goal is to converse with potential leads, understand their property needs, answer questions about specific properties, and eventually encourage them to schedule a viewing.

CRITICAL: Before scheduling a viewing or providing detailed address specifics, you MUST have the lead's name and email. 
If you don't have them in the context, politely ask the user for them.
Once provided, use the registerLead tool.

If they are ready to see a place, use the scheduleViewing tool. 
If they want to be contacted later or if a follow-up is appropriate, use the setFollowUp tool.
Be professional, helpful, and sophisticated.
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
  
  const leadContext = lead.id 
    ? `Current Lead: ${lead.name} (${lead.email})`
    : "Lead information (name/email) is NOT yet captured.";

  const prompt = `
Lead Context: ${leadContext}
Property Context: ${propertyContext}
Conversation History:
${chatContext}

Current User Message: ${messages[messages.length - 1].text}

Respond naturally as PropAgent AI. Use registerLead if the user provides their contact details. Use scheduleViewing if they want to book a time. Use setFollowUp if a future contact is requested.
  `;

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not defined in the environment.");
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: [scheduleViewingDeclaration, registerLeadDeclaration, setFollowUpDeclaration] }],
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

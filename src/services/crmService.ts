import { Lead } from "../types";
import { db } from "../lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

/**
 * Simulates pushing a qualified lead to an external CRM system (e.g., Salesforce, HubSpot, or a custom Webhook).
 */
export async function pushToCRM(lead: Lead): Promise<boolean> {
  console.log(`[CRM SERVICE] Initiating sync for lead: ${lead.email}`);
  
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 1500));

  try {
    console.log(`[CRM SERVICE] Successfully pushed lead to external CRM:`, {
      name: lead.name,
      email: lead.email,
      qualification: {
        budget: lead.budget,
        location: lead.locationPreference,
        timeline: lead.timeline
      },
      source: "PropAgent AI Chatbot"
    });

    // Mark as synced in our local database
    if (lead.id) {
      const leadRef = doc(db, 'leads', lead.id);
      await updateDoc(leadRef, {
        crmSynced: true,
        lastActive: serverTimestamp()
      });
    }

    return true;
  } catch (error) {
    console.error(`[CRM SERVICE] Failed to sync with CRM:`, error);
    return false;
  }
}

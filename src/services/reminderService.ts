import { Lead, LeadStatus, Viewing } from "../types";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * Automatically calculates and creates follow-up reminders based on lead status changes.
 */
export async function createAutoReminder(lead: Lead, newStatus: LeadStatus, viewings?: Viewing[], specificViewing?: any) {
  console.log(`[REMINDER SERVICE] Evaluating auto-reminder for lead ${lead.id} with status ${newStatus}`);

  let reminderText = "";
  let reminderDate: number | null = null;

  switch (newStatus) {
    case LeadStatus.INTERESTED:
      reminderText = `Follow-up: Lead demonstrou interesse. Verificar próximos passos.`;
      // 2 days from now
      reminderDate = Date.now() + (2 * 24 * 60 * 60 * 1000);
      break;

    case LeadStatus.VIEWING_SCHEDULED:
      let targetViewing = specificViewing;
      
      if (!targetViewing && viewings && viewings.length > 0) {
        // Find the latest pending/scheduled viewing
        targetViewing = [...viewings].sort((a, b) => b.dateTime - a.dateTime)[0];
      }

      if (targetViewing) {
        reminderText = `Preparação: Visita agendada para amanhã. Confirmar com o cliente e preparar material.`;
        // 1 day before the viewing
        reminderDate = targetViewing.dateTime - (1 * 24 * 60 * 60 * 1000);
        
        // Ensure we don't set a reminder in the past
        if (reminderDate < Date.now()) {
          reminderDate = Date.now() + (4 * 60 * 60 * 1000); // 4 hours from now as fallback
        }
      }
      break;

    default:
      return; // No auto-reminder for other status
  }

  if (reminderText && reminderDate) {
    try {
      await addDoc(collection(db, 'reminders'), {
        leadId: lead.id,
        text: reminderText,
        dateTime: reminderDate,
        completed: false,
        createdAt: serverTimestamp()
      });
      console.log(`[REMINDER SERVICE] Auto-reminder created for ${new Date(reminderDate).toLocaleString()}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'reminders');
    }
  }
}

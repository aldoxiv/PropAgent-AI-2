import { Lead, LeadStatus } from "../types";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { updateDoc, doc, serverTimestamp } from "firebase/firestore";

/**
 * Calculates a lead priority score (0-100) based on various engagement factors.
 */
export function calculateLeadScore(lead: Lead): number {
  let score = 0;

  // 1. Status Points (Max 30)
  const statusWeights: Record<LeadStatus, number> = {
    [LeadStatus.NEW]: 5,
    [LeadStatus.CONTACTED]: 10,
    [LeadStatus.INTERESTED]: 20,
    [LeadStatus.VIEWING_SCHEDULED]: 30,
    [LeadStatus.VIEWING_COMPLETED]: 40, // Bonus for serious interest
    [LeadStatus.CLOSED]: 0, // Reset for closed leads
  };
  score += statusWeights[lead.status] || 0;

  // 2. Profile Completeness (Max 25)
  if (lead.email) score += 5;
  if (lead.phone) score += 5;
  if (lead.budget) score += 5;
  if (lead.locationPreference) score += 5;
  if (lead.timeline) score += 5;

  // 3. Budget Depth (Max 25)
  if (lead.budget) {
    // Simple logic: higher numeric values in budget string gain more points
    // Dealing with strings like "R$ 1.500.000" or "$2M"
    const numericBudget = parseInt(lead.budget.replace(/[^0-9]/g, "")) || 0;
    if (numericBudget > 1000000) score += 25; // High end
    else if (numericBudget > 500000) score += 15; // Mid range
    else if (numericBudget > 0) score += 5; // Basic
  }

  // 4. Activity Recency (Max 20)
  // Since we don't have easy access to serverTimestamp value client side during calculation,
  // we check if a timestamp is within the last 24h
  if (lead.lastActive) {
    const lastActiveTime = typeof lead.lastActive === 'number' ? lead.lastActive : Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    if (Date.now() - lastActiveTime < oneDay) score += 20;
    else if (Date.now() - lastActiveTime < oneDay * 3) score += 10;
  }

  return Math.min(100, score);
}

/**
 * Updates the lead score in Firestore.
 */
export async function updateLeadScore(lead: Lead) {
  const newScore = calculateLeadScore(lead);
  
  // Only update if score changed to save writes
  if (lead.score === newScore) return newScore;

  try {
    await updateDoc(doc(db, 'leads', lead.id), {
      score: newScore,
      lastActive: serverTimestamp()
    });
    console.log(`[SCORING SERVICE] Lead ${lead.id} priority score updated to ${newScore}`);
    return newScore;
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `leads/${lead.id} (scoring)`);
    return lead.score || 0;
  }
}

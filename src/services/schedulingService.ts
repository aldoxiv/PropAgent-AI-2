import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { AvailabilitySlot, Viewing, ViewingStatus, Lead, Property } from "../types";

/**
 * Fetches available viewing slots for a specific agent or any agent.
 */
export async function getAvailableSlots(startTime?: number): Promise<AvailabilitySlot[]> {
  try {
    const slotsRef = collection(db, "availability");
    const q = startTime 
      ? query(slotsRef, where("isBooked", "==", false), where("startTime", ">=", startTime))
      : query(slotsRef, where("isBooked", "==", false));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AvailabilitySlot));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "availability");
    return [];
  }
}

/**
 * Seeds initial availability slots if none exist (for demo purposes)
 */
export async function seedAvailability(agentId = "agent_default") {
  const existing = await getAvailableSlots();
  if (existing.length > 0) return;

  const now = new Date();
  now.setMinutes(0, 0, 0);

  // Create 5 slots for the next 3 days
  for (let day = 1; day <= 3; day++) {
    for (let hour = 10; hour <= 14; hour++) {
      const startTime = new Date(now);
      startTime.setDate(now.getDate() + day);
      startTime.setHours(hour);

      const endTime = new Date(startTime);
      endTime.setHours(startTime.getHours() + 1);

      await addDoc(collection(db, "availability"), {
        startTime: startTime.getTime(),
        endTime: endTime.getTime(),
        isBooked: false,
        agentId
      });
    }
  }
}

/**
 * Books a viewing and sends "confirmation" (simulated)
 */
export async function bookViewing(
  lead: Lead, 
  property: Property, 
  slotId: string, 
  dateTime: number
): Promise<Viewing | null> {
  try {
    // 1. Create the viewing
    const viewingData: any = {
      leadId: lead.id,
      propertyId: property.id,
      dateTime,
      status: ViewingStatus.CONFIRMED,
      confirmedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      agentId: slotId ? "agent_default" : "agent_default", // default for now
      notes: `Scheduled via intelligent scheduler.`
    };

    const docRef = await addDoc(collection(db, "viewings"), viewingData);
    
    // 2. Mark slot as booked if slotId provided
    if (slotId) {
      await updateDoc(doc(db, "availability", slotId), {
        isBooked: true
      });
    }

    // 3. Simulate "Calendar Invite" and "Confirmation Email"
    console.log(`[SCHEDULER] Confirmation email sent to ${lead.email}`);
    console.log(`[SCHEDULER] Calendar invite sent to lead and agent for London time: ${new Date(dateTime).toLocaleString("pt-BR")}`);

    return { id: docRef.id, ...viewingData } as Viewing;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, "viewings");
    return null;
  }
}

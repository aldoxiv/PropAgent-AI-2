export enum LeadStatus {
  NEW = "new",
  CONTACTED = "contacted",
  INTERESTED = "interested",
  VIEWING_SCHEDULED = "viewing_scheduled",
  VIEWING_COMPLETED = "viewing_completed",
  CLOSED = "closed"
}

export enum ViewingStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled"
}

export interface Property {
  id: string;
  title: string;
  description: string;
  price: number;
  address: string;
  imageUrl: string;
  type: "apartment" | "house" | "condo";
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  propertyId?: string;
  status: LeadStatus;
  createdAt: any; // Using any for serverTimestamp compatibility
  lastActive: any;
  budget?: string;
  locationPreference?: string;
  timeline?: string;
  crmSynced?: boolean;
  score?: number;
}

export interface Message {
  id: string;
  text: string;
  sender: "user" | "agent";
  timestamp: number;
}

export interface Viewing {
  id: string;
  leadId: string;
  propertyId: string;
  dateTime: number;
  status: ViewingStatus;
  agentId?: string; // Support for multiple agents
  notes?: string;
  confirmedAt?: number;
}

export interface AvailabilitySlot {
  id: string;
  startTime: number;
  endTime: number;
  isBooked: boolean;
  agentId: string;
}

export interface Reminder {
  id: string;
  leadId: string;
  text: string;
  dateTime: number;
  completed: boolean;
  createdAt: number;
}

export interface AppSettings {
  id: string;
  welcomeEmailSubject: string;
  welcomeEmailBody: string;
}

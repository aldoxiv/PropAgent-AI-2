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
  createdAt: number;
  lastActive: number;
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

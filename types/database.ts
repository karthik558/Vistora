export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type FeedbackStatus = "needs_attention" | "under_review" | "resolved" | "escalated";
export type FeedbackTone = "urgent" | "review" | "positive";
export type DepartmentType =
  | "Housekeeping"
  | "Front Desk"
  | "Food & Beverage"
  | "Concierge"
  | "Facilities & Room"
  | "Spa & Wellness"
  | "Valet & Transfers";

export type UserRole = "admin" | "staff" | "visitor";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: UserRole;
          property_id: string | null;
          avatar_url: string | null;
          rights?: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role?: UserRole;
          property_id?: string | null;
          avatar_url?: string | null;
          rights?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: UserRole;
          property_id?: string | null;
          avatar_url?: string | null;
          rights?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      properties: {
        Row: {
          id: string;
          name: string;
          slug: string;
          code: string;
          brand: string;
          location: string;
          country: string;
          timezone: string;
          total_rooms: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          code: string;
          brand?: string;
          location: string;
          country: string;
          timezone?: string;
          total_rooms?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          code?: string;
          brand?: string;
          location?: string;
          country?: string;
          timezone?: string;
          total_rooms?: number;
          created_at?: string;
        };
      };
      guests: {
        Row: {
          id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          vip_tier: string;
          total_stays: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          vip_tier?: string;
          total_stays?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          vip_tier?: string;
          total_stays?: number;
          created_at?: string;
        };
      };
      stays: {
        Row: {
          id: string;
          property_id: string;
          guest_id: string;
          room_number: string;
          check_in_date: string;
          check_out_date: string;
          public_token: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          guest_id: string;
          room_number: string;
          check_in_date: string;
          check_out_date: string;
          public_token: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          guest_id?: string;
          room_number?: string;
          check_in_date?: string;
          check_out_date?: string;
          public_token?: string;
          status?: string;
          created_at?: string;
        };
      };
      feedback: {
        Row: {
          id: string;
          property_id: string;
          stay_id: string | null;
          guest_name: string;
          guest_email: string | null;
          guest_phone: string | null;
          room_number: string;
          department: DepartmentType;
          rating: number;
          comment: string | null;
          wants_contact: boolean;
          contact_preference: string | null;
          status: FeedbackStatus;
          tone: FeedbackTone;
          sla_deadline: string | null;
          assigned_to: string | null;
          resolution_notes: string | null;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          stay_id?: string | null;
          guest_name: string;
          guest_email?: string | null;
          guest_phone?: string | null;
          room_number: string;
          department?: DepartmentType;
          rating: number;
          comment?: string | null;
          wants_contact?: boolean;
          contact_preference?: string | null;
          status?: FeedbackStatus;
          tone?: FeedbackTone;
          sla_deadline?: string | null;
          assigned_to?: string | null;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          stay_id?: string | null;
          guest_name?: string;
          guest_email?: string | null;
          guest_phone?: string | null;
          room_number?: string;
          department?: DepartmentType;
          rating?: number;
          comment?: string | null;
          wants_contact?: boolean;
          contact_preference?: string | null;
          status?: FeedbackStatus;
          tone?: FeedbackTone;
          sla_deadline?: string | null;
          assigned_to?: string | null;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      feedback_status: FeedbackStatus;
      feedback_tone: FeedbackTone;
      department_type: DepartmentType;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

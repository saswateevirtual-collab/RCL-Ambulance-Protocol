// src/lib/types.ts

// ==========================================
// 1. EVENT CLASSES & TYPES (The 17 Events)
// ==========================================
export type EventClass = 'HUMAN_EVENT' | 'SYSTEM_EVENT' | 'RECOMMENDATION_EVENT';

export type EventType =
  // SYSTEM_EVENT (5)
  | 'MISSION_CREATED'
  | 'DESTINATION_REQUEST_CREATED'
  | 'NOTIFIED'
  | 'ESCALATION_SENT'
  | 'TIMED_OUT'
  // HUMAN_EVENT (8)
  | 'RECEIPT_CONFIRMED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'ACCEPTANCE_ATTEMPT_REJECTED'
  | 'ACCEPTANCE_WITHDRAWN'
  | 'DESTINATION_COMMITTED'
  | 'DESTINATION_REDIRECTED'
  | 'CORRECTION_PROPOSED'
  // RECOMMENDATION_EVENT (4)
  | 'RECOMMENDATION_ESCALATE'
  | 'RECOMMENDATION_FALLBACK'
  | 'RECOMMENDATION_NUDGE'
  | 'RECOMMENDATION_HOLD';

// ==========================================
// 2. TRACK A: Destination Request States
// ==========================================
export type TrackAStatus = 
  | 'PROPOSED'
  | 'NOTIFIED'
  | 'ACKNOWLEDGED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'TIMED_OUT'
  | 'ACCEPTANCE_WITHDRAWN'
  | 'SUPERSEDED';

// ==========================================
// 3. TRACK B: Mission States
// ==========================================
export type TrackBStatus = 
  | 'DESTINATION_PROPOSED'
  | 'AWAITING_DECISION'
  | 'DESTINATION_CONFIRMED'
  | 'FALLBACK_REQUIRED'
  | 'REDIRECTED';

// ==========================================
// 4. THE EVENT ENVELOPE
// ==========================================
export interface EventEnvelope {
  sequence: number;
  event_id: string;
  event_type: EventType;
  event_class: EventClass;
  server_timestamp: string;
  client_timestamp?: string;
  mission_id: string;
  destination_request_id: string | null;
  escalation_id: string | null;
  originating_actor: {
    id: string;
    kind: 'HUMAN' | 'SYSTEM' | 'AGENT';
    role: string;
  };
  recording_actor: {
    id: 'server';
    kind: 'SYSTEM';
  };
  payload: Record<string, any>; 
}

// ==========================================
// 5. MISSION & REQUEST MODELS
// ==========================================
export interface Mission {
  mission_id: string;
  status: TrackBStatus;
  active_request_id: string | null;
  fallback_reason: 'DECLINED' | 'TIMED_OUT' | 'WITHDRAWN' | null;
  candidate_request_ids: string[];
  superseded_request_ids: string[];
}

export interface DestinationRequest {
  destination_request_id: string;
  mission_id: string;
  status: TrackAStatus;
  hospital_id: string;
  capability_required: string;
}

export interface CaseSummary {
  patient: string;
  condition: string;
  capability: string;
  source: string;
}
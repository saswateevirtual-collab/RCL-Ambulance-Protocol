import { EventEnvelope, Mission, DestinationRequest } from './types';

export interface RCLState {
  missions: Record<string, Mission>;
  requests: Record<string, DestinationRequest>;
}

export const initialState: RCLState = {
  missions: {},
  requests: {},
};

export function applyEvent(state: RCLState, event: EventEnvelope): RCLState {
  const newState: RCLState = JSON.parse(JSON.stringify(state));
  const { event_type, mission_id, destination_request_id, payload } = event;

  switch (event_type) {
    case 'MISSION_CREATED':
      newState.missions[mission_id] = {
        mission_id,
        status: 'DESTINATION_PROPOSED',
        active_request_id: null,
        fallback_reason: null,
        candidate_request_ids: [],
        superseded_request_ids: [],
      };
      break;

    case 'DESTINATION_REQUEST_CREATED':
      if (destination_request_id && payload) {
        newState.requests[destination_request_id] = {
          destination_request_id,
          mission_id,
          status: 'PROPOSED',
          hospital_id: payload.hospital_id,
          capability_required: payload.capability_required,
        };
        if (!newState.missions[mission_id].active_request_id) {
          newState.missions[mission_id].active_request_id = destination_request_id;
        }
      }
      break;

    case 'NOTIFIED':
      if (destination_request_id && newState.requests[destination_request_id]) {
        newState.requests[destination_request_id].status = 'NOTIFIED';
        if (newState.missions[mission_id].active_request_id === destination_request_id) {
          newState.missions[mission_id].status = 'AWAITING_DECISION';
        }
      }
      break;

    case 'ACCEPTED':
      if (destination_request_id && newState.requests[destination_request_id]) {
        newState.requests[destination_request_id].status = 'ACCEPTED';
      }
      break;

    case 'DECLINED':
    case 'TIMED_OUT':
      if (destination_request_id && newState.requests[destination_request_id]) {
        newState.requests[destination_request_id].status = event_type as any;
        if (newState.missions[mission_id].active_request_id === destination_request_id) {
          newState.missions[mission_id].status = 'FALLBACK_REQUIRED';
          newState.missions[mission_id].fallback_reason = event_type === 'DECLINED' ? 'DECLINED' : 'TIMED_OUT';
        }
      }
      break;

    case 'ACCEPTANCE_WITHDRAWN':
      if (destination_request_id && newState.requests[destination_request_id]) {
        newState.requests[destination_request_id].status = 'ACCEPTANCE_WITHDRAWN';
        if (newState.missions[mission_id].active_request_id === destination_request_id) {
          newState.missions[mission_id].status = 'FALLBACK_REQUIRED';
          newState.missions[mission_id].fallback_reason = 'WITHDRAWN';
        }
      }
      break;

    case 'DESTINATION_COMMITTED':
      if (destination_request_id && newState.requests[destination_request_id]?.status === 'ACCEPTED') {
        newState.missions[mission_id].status = 'DESTINATION_CONFIRMED';
        newState.missions[mission_id].fallback_reason = null;
      }
      break;

    default:
      // Audit events like ACCEPTANCE_ATTEMPT_REJECTED don't change state
      break;
  }

  return newState;
}
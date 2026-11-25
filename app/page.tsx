"use client";

import { useState, useEffect } from "react";
import { EventEnvelope } from "./lib/types";
import { applyEvent, initialState, RCLState } from "./lib/engine";

export default function Home() {
  const [events, setEvents] = useState<EventEnvelope[]>([]);
  const [currentState, setCurrentState] = useState<RCLState>(initialState);
  const [sequence, setSequence] = useState(1);
  const [role, setRole] = useState<"dispatcher" | "hospital" | null>(null);
  const [caseInput, setCaseInput] = useState("");
  const [showAudit, setShowAudit] = useState(false);

  // Sync logic across tabs
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRole((params.get("role") as any) || "dispatcher");

    const saved = localStorage.getItem("rcl_events_v2");
    if (saved) updateStateFromEvents(JSON.parse(saved));

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "rcl_events_v2" && e.newValue) updateStateFromEvents(JSON.parse(e.newValue));
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const updateStateFromEvents = (evts: EventEnvelope[]) => {
    setEvents(evts);
    let newState = initialState;
    evts.forEach((e) => { newState = applyEvent(newState, e); });
    setCurrentState(newState);
    if (evts.length > 0) setSequence(evts[evts.length - 1].sequence + 1);
  };

  // Batch emit to avoid state closure issues
  const emitBatch = (configs: any[]) => {
    let currentSeq = sequence;
    const newEvents = configs.map(c => {
      const evt: EventEnvelope = {
        sequence: currentSeq, event_id: `EVT_${currentSeq}`, event_type: c.type, event_class: c.class_,
        server_timestamp: new Date().toLocaleTimeString(), mission_id: "MISSION-001",
        destination_request_id: c.reqId !== undefined ? c.reqId : "REQ-001", escalation_id: null,
        originating_actor: { id: c.actorId, kind: c.role === "SYSTEM" || c.role === "AGENT" ? (c.role === "AGENT" ? "AGENT" : "SYSTEM") : "HUMAN", role: c.role },
        recording_actor: { id: "server", kind: "SYSTEM" }, payload: c.payload
      };
      currentSeq++;
      return evt;
    });

    const updated = [...events, ...newEvents];
    localStorage.setItem("rcl_events_v2", JSON.stringify(updated));
    updateStateFromEvents(updated);
  };

  const emitEvent = (type: any, class_: any, payload: any, role: string, actorId: string, reqId?: string | null) => {
    emitBatch([{ type, class_, payload, role, actorId, reqId }]);
  };

  const resetDemo = () => {
    localStorage.removeItem("rcl_events_v2");
    updateStateFromEvents([]);
    setSequence(1); setCaseInput(""); setShowAudit(false);
  };

  // --- ACTIONS ---
  const handleIntake = () => {
    if (!caseInput) return;
    // Auto-generate events based on input
    emitBatch([
      { type: "MISSION_CREATED", class_: "SYSTEM_EVENT", payload: { notes: caseInput }, role: "SYSTEM", actorId: "sys", reqId: null },
      { type: "DESTINATION_REQUEST_CREATED", class_: "SYSTEM_EVENT", payload: { hospital_id: "Hospital A", capability_required: "CT" }, role: "SYSTEM", actorId: "sys", reqId: "REQ-001" },
      { type: "NOTIFIED", class_: "SYSTEM_EVENT", payload: {}, role: "SYSTEM", actorId: "sys", reqId: "REQ-001" }
    ]);
  };

  const handleAccept = (role: string) => {
    if (role === "BED_MANAGER") {
      emitEvent("ACCEPTANCE_ATTEMPT_REJECTED", "HUMAN_EVENT", { reason: "AUTHORITY_MISMATCH" }, "Bed Manager", "staff_01", "REQ-001");
    } else {
      emitEvent("ACCEPTED", "HUMAN_EVENT", {}, "Duty Doctor", "doc_01", "REQ-001");
    }
  };

  const handleDecline = () => {
    emitEvent("DECLINED", "HUMAN_EVENT", { reason: "NO_CT" }, "Duty Doctor", "doc_01", "REQ-001");
  };

  const handleTimeout = () => {
    emitEvent("TIMED_OUT", "SYSTEM_EVENT", { reason: "No response" }, "SYSTEM", "sys", "REQ-001");
  };

  const handleWithdraw = () => {
    emitEvent("ACCEPTANCE_WITHDRAWN", "HUMAN_EVENT", { reason: "Emergency capacity full" }, "Duty Doctor", "doc_01", "REQ-001");
  };

  const handleCommit = () => {
    emitEvent("DESTINATION_COMMITTED", "HUMAN_EVENT", {}, "Dispatcher", "disp_01", "REQ-001");
  };

  const mission = currentState.missions["MISSION-001"];
  const req = currentState.requests["REQ-001"];
  
  const isTrapTriggered = events.some(e => e.event_type === "ACCEPTANCE_ATTEMPT_REJECTED");
  const lastEvent = events[events.length - 1];

  if (role === null) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col h-screen overflow-hidden">
      
      {/* HEADER */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 text-white font-bold px-2 py-1 rounded text-sm">RCL</div>
          <h1 className="font-semibold text-white">Receiving Confirmation Layer</h1>
          <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400 border border-slate-700 capitalize">{role} View</span>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowAudit(!showAudit)} className="text-sm text-slate-400 hover:text-white">Audit Trail</button>
          <button onClick={resetDemo} className="text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded">Reset System</button>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT MAIN PANEL */}
        <div className="flex-1 p-6 overflow-y-auto">
          
          {/* DISPATCHER VIEW */}
          {role === "dispatcher" && (
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* Intake Form */}
              {!mission && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
                  <h2 className="text-xl font-bold text-white mb-2">New Emergency Intake</h2>
                  <p className="text-slate-400 text-sm mb-4">Enter unstructured case notes to generate a mission.</p>
                  <textarea 
                    value={caseInput} onChange={(e) => setCaseInput(e.target.value)}
                    placeholder="e.g., 45M suspected acute stroke, requires immediate CT scan..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-sm h-32 focus:outline-none focus:border-blue-500 mb-4"
                  />
                  <button onClick={handleIntake} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg">
                    Initiate Mission
                  </button>
                </div>
              )}

              {/* Active Mission View */}
              {mission && (
                <div className="space-y-6">
                  
                  {/* Case Summary (Agent 1 Output) */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
                      <span className="text-blue-400">🤖</span>
                      <h2 className="font-bold text-white">Case Intelligence Summary</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div><p className="text-xs text-slate-500 uppercase">Patient</p><p className="font-medium text-white">45M</p></div>
                      <div><p className="text-xs text-slate-500 uppercase">Condition</p><p className="font-medium text-white">Suspected Stroke</p></div>
                      <div><p className="text-xs text-slate-500 uppercase">Required Capability</p><p className="font-medium text-red-400">CT Scan</p></div>
                    </div>
                  </div>

                  {/* Hospital Intelligence */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h2 className="font-bold text-white mb-4">Hospital Intelligence</h2>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-950 border border-green-500/30 p-4 rounded-lg relative">
                        <span className="absolute -top-2.5 left-3 bg-green-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded">TARGET</span>
                        <h3 className="font-bold text-white mb-2">Hospital A</h3>
                        <div className="text-sm space-y-1 text-slate-400">
                          <p>CT: <span className="text-green-400">Available</span></p>
                          <p>ETA: 6 mins</p>
                          <p>Readiness: <span className="text-green-400">Fresh (2m ago)</span></p>
                        </div>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg opacity-60">
                        <h3 className="font-bold text-white mb-2">Hospital B</h3>
                        <div className="text-sm space-y-1 text-slate-400">
                          <p>CT: <span className="text-green-400">Available</span></p>
                          <p>ETA: 4 mins</p>
                          <p>Readiness: <span className="text-red-400">Stale (18m ago)</span></p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mission Status */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h2 className="font-bold text-white mb-4">Mission Control</h2>
                    <div className="flex items-center justify-between bg-slate-950 p-4 rounded-lg border border-slate-800">
                      <div>
                        <p className="text-xs text-slate-500 uppercase">Current Status</p>
                        <p className="font-bold text-lg text-blue-400">{mission.status}</p>
                      </div>
                      
                      <div className="flex gap-2">
                        {/* Fallback logic */}
                        {mission.status === "FALLBACK_REQUIRED" && (
                          <div className="flex gap-2">
                            <button onClick={handleTimeout} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg">
                              Simulate Timeout
                            </button>
                            <button onClick={() => { emitEvent("DESTINATION_COMMITTED", "HUMAN_EVENT", {}, "Dispatcher", "disp_01", "REQ-001"); }} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded-lg">
                              Reroute to Hospital B
                            </button>
                          </div>
                        )}

                        {req?.status === "ACCEPTED" && mission.status !== "DESTINATION_CONFIRMED" && (
                          <button onClick={handleCommit} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg animate-pulse">
                            Commit Destination
                          </button>
                        )}

                        {mission.status === "DESTINATION_CONFIRMED" && (
                          <span className="text-green-400 font-bold flex items-center gap-2">✅ Destination Verified</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HOSPITAL VIEW */}
          {role === "hospital" && (
            <div className="max-w-3xl mx-auto space-y-6">
              {(!req || req.status === "PROPOSED") && (
                 <div className="text-center py-20 text-slate-500">
                   <p className="text-4xl mb-4">📡</p>
                   <p>Listening for incoming requests...</p>
                 </div>
              )}

              {req && req.status === "NOTIFIED" && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
                  <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-white">Incoming Case Request</h2>
                      <p className="text-sm text-slate-400">Mission ID: MISSION-001</p>
                    </div>
                    <div className="bg-yellow-900/30 text-yellow-500 text-xs px-3 py-1 rounded border border-yellow-800 animate-pulse">ACTION REQUIRED</div>
                  </div>
                  
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 mb-6">
                    <h3 className="font-bold text-slate-300 mb-2">Case Summary</h3>
                    <p className="text-sm text-slate-400">Patient: 45M</p>
                    <p className="text-sm text-slate-400">Condition: Suspected Stroke</p>
                    <p className="text-sm text-red-400 font-bold mt-2">Required Capability: CT Scan</p>
                  </div>

                  <div className="space-y-3">
                    <button onClick={() => handleAccept("BED_MANAGER")} className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-lg text-left flex justify-between items-center">
                      <div><p className="font-bold text-white">Accept as Bed Manager</p><p className="text-xs text-slate-500">Administrative role</p></div>
                      <span className="text-xs bg-red-900/50 text-red-400 px-2 py-1 rounded">Unauthorised</span>
                    </button>
                    <button onClick={() => handleAccept("DUTY_DOCTOR")} className="w-full bg-blue-600 hover:bg-blue-500 p-4 rounded-lg text-left flex justify-between items-center">
                      <div><p className="font-bold text-white">Accept as Duty Doctor</p><p className="text-xs text-blue-200">Clinical authority</p></div>
                      <span className="text-xs bg-blue-800 text-white px-2 py-1 rounded">Authorised</span>
                    </button>
                    <button onClick={handleDecline} className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-lg text-left">
                      <p className="font-bold text-white">Decline Case</p>
                      <p className="text-xs text-slate-500">Reason: No CT Availability</p>
                    </button>
                  </div>
                </div>
              )}

              {req && req.status === "ACCEPTED" && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                  <div className="text-5xl mb-4">✅</div>
                  <h2 className="text-xl font-bold text-green-400 mb-2">Case Accepted</h2>
                  <p className="text-slate-400 mb-6">You have agreed to receive this patient.</p>
                  <button onClick={handleWithdraw} className="bg-slate-800 hover:bg-red-900/50 border border-slate-700 text-red-400 py-2 px-6 rounded-lg">
                    Withdraw Acceptance (Simulate Capacity Loss)
                  </button>
                </div>
              )}

              {req && req.status === "DECLINED" && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                  <div className="text-5xl mb-4">❌</div>
                  <h2 className="text-xl font-bold text-red-400 mb-2">Case Declined</h2>
                  <p className="text-slate-400">Reason: No CT Availability. Dispatcher notified.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: AI & INTELLIGENCE */}
        <div className="w-80 bg-black border-l border-slate-800 p-4 flex flex-col shrink-0">
          <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Coordination Assistant</h2>
          
          <div className="flex-1 space-y-4 overflow-y-auto pr-2">
            {isTrapTriggered ? (
              <div className="bg-slate-900 border border-red-900/50 p-4 rounded-lg">
                <p className="text-red-400 font-bold text-sm mb-1">⚠️ Authority Mismatch</p>
                <p className="text-xs text-slate-400 mb-2">Bed Manager attempted to accept a CT case.</p>
                <div className="bg-slate-950 p-2 rounded text-xs text-slate-300 border border-slate-800">
                  <b>Action:</b> Escalate to Duty Doctor. Request state remains <span className="text-yellow-400">NOTIFIED</span>.
                </div>
              </div>
            ) : req?.status === "DECLINED" || mission?.status === "FALLBACK_REQUIRED" ? (
              <div className="bg-slate-900 border border-purple-900/50 p-4 rounded-lg">
                <p className="text-purple-400 font-bold text-sm mb-1">🔄 Fallback Recommended</p>
                <p className="text-xs text-slate-400 mb-2">Hospital A declined (No CT).</p>
                <div className="bg-slate-950 p-2 rounded text-xs text-slate-300 border border-slate-800">
                  <b>Action:</b> Reroute to Hospital B (CT available, ETA 4 mins).
                </div>
              </div>
            ) : req?.status === "ACCEPTED" ? (
               <div className="bg-slate-900 border border-green-900/50 p-4 rounded-lg">
                <p className="text-green-400 font-bold text-sm mb-1">✅ Acceptance Verified</p>
                <p className="text-xs text-slate-400">Duty Doctor has authorised this case.</p>
                <div className="bg-slate-950 p-2 rounded text-xs text-slate-300 border border-slate-800 mt-2">
                  <b>Next Step:</b> Dispatcher must commit destination.
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-600 italic">
                Monitoring mission events...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AUDIT DRAWER */}
      {showAudit && (
        <div className="fixed inset-y-0 right-0 w-96 bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="font-bold text-white">Audit Trail (Event Sourcing)</h2>
            <button onClick={() => setShowAudit(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {events.map(e => (
              <div key={e.event_id} className="bg-slate-950 border border-slate-800 p-3 rounded text-xs font-mono">
                <div className="flex justify-between text-slate-500 mb-1">
                  <span>#{e.sequence}</span>
                  <span>{e.server_timestamp}</span>
                </div>
                <div className={`font-bold ${e.event_class === "RECOMMENDATION_EVENT" ? "text-purple-400" : e.event_type === "ACCEPTANCE_ATTEMPT_REJECTED" ? "text-red-400" : "text-blue-400"}`}>
                  {e.event_type}
                </div>
                <div className="text-slate-400 mt-1">Actor: {e.originating_actor.role}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
import { useState } from "react";

const SPIN_QUESTIONS = {
  situation: [
    "How many shipments do you move per week or month?",
    "What freight modes are you currently using — road, air, international, parcels?",
    "Who is your current freight provider, and how long have you been with them?",
    "How many sites or locations do you ship from or to?",
    "Do you manage freight in-house or through a 3PL?"
  ],
  problem: [
    "Are there times when deliveries don't arrive on time? How often?",
    "Have you had issues with damaged goods or claims?",
    "Do you get real-time visibility on where your freight is?",
    "How do you handle urgent or last-minute shipments — is it stressful?",
    "Are you satisfied with the level of communication from your current provider?"
  ],
  implication: [
    "When a delivery is late, what happens to your operations or your customer relationship?",
    "If you can't track a shipment, how does that affect your planning?",
    "What does a missed delivery actually cost you — financially or in customer trust?",
    "If urgent freight isn't handled well, does it put your contracts at risk?",
    "How much time does your team spend chasing freight updates that should be automatic?"
  ],
  needPayoff: [
    "If you had a provider who guaranteed real-time tracking, how would that change things for you?",
    "If you could consolidate road and air under one provider, what would that simplify?",
    "If late deliveries dropped significantly, what impact would that have on your customer retention?",
    "If urgent freight was handled seamlessly, how much time and stress would that save your team?",
    "If your freight costs were more predictable, how would that help your planning and margins?"
  ]
};

const STAGES = [
  {
    id: "open",
    label: "Opening",
    emoji: "🤝",
    time: "0–5 min",
    accent: "#5B9BD5",
    title: "Set the Stage",
    objective: "Build rapport and frame the meeting on your terms. Establish that you're here to understand, not just sell.",
    steps: [
      "Introduce yourself confidently — one sentence, role and company.",
      "Confirm time available: 'We have about 30–45 minutes — does that still work?'",
      "Frame the agenda: 'I'd like to understand your freight operation first, then share how we work. Sound good?'",
      "Warm-up: 'How long have you been using your current freight partner?'"
    ],
    tip: "💡 The agenda-setting line is critical. It earns permission to ask questions — the foundation of SPIN.",
    avoid: "🚫 Zero product mentions here. Not one. You haven't earned the right yet.",
    spinNote: null
  },
  {
    id: "situation",
    label: "S — Situation",
    emoji: "📋",
    time: "5–15 min",
    accent: "#4ECDC4",
    title: "Situation Questions",
    objective: "Establish the facts. Understand their current freight setup without assumptions. Keep it conversational — you're building a map, not filling a form.",
    spinType: "situation" as const,
    spinColor: "#4ECDC4",
    spinLabel: "SITUATION",
    spinPurpose: "Gather facts about the customer's current state. These create the baseline for Problem questions.",
    steps: null,
    tip: "💡 Keep Situation questions brief — customers find too many tedious. 3–5 is enough. Move to Problem quickly.",
    avoid: "🚫 Don't ask things you should already know from research. Do your homework first.",
    spinNote: "SPIN Rule: Situation questions are necessary but low-value. Use them to open the door, not fill the meeting."
  },
  {
    id: "problem",
    label: "P — Problem",
    emoji: "⚠️",
    time: "15–25 min",
    accent: "#F7B731",
    title: "Problem Questions",
    objective: "Uncover difficulties, frustrations, and dissatisfactions with their current freight setup. This is where needs begin to surface.",
    spinType: "problem" as const,
    spinColor: "#F7B731",
    spinLabel: "PROBLEM",
    spinPurpose: "Identify explicit or implied problems. Customers won't buy without a felt problem. Your job is to help them articulate it.",
    steps: null,
    tip: "💡 When they mention a problem, don't jump to a solution. Ask a follow-up: 'How often does that happen?' or 'How long has that been the case?'",
    avoid: "🚫 Don't offer solutions yet. You haven't made the problem big enough.",
    spinNote: "SPIN Rule: The more problems you uncover, the stronger your case. Experienced reps find 2–3 problems before moving on."
  },
  {
    id: "implication",
    label: "I — Implication",
    emoji: "🔗",
    time: "25–35 min",
    accent: "#E55353",
    title: "Implication Questions",
    objective: "Develop the consequences of their problems. Make the pain real and costly. This is the most powerful — and most skipped — part of SPIN.",
    spinType: "implication" as const,
    spinColor: "#E55353",
    spinLabel: "IMPLICATION",
    spinPurpose: "Turn a small problem into an urgent one. Buyers only act when the cost of inaction exceeds the cost of change.",
    steps: null,
    tip: "💡 Link freight problems to business impact: customer retention, contract risk, staff time, cashflow. That's where decisions are made.",
    avoid: "🚫 Don't rush through this stage. It's where urgency is built. Skipping it kills deals.",
    spinNote: "SPIN Rule: Implication questions are the hardest to ask and the most valuable. They separate average reps from great ones."
  },
  {
    id: "needpayoff",
    label: "N — Need-Payoff",
    emoji: "💡",
    time: "35–45 min",
    accent: "#26D96B",
    title: "Need-Payoff Questions",
    objective: "Get the customer to articulate the value of solving the problem in their own words. They sell themselves — you just ask the right question.",
    spinType: "needPayoff" as const,
    spinColor: "#26D96B",
    spinLabel: "NEED-PAYOFF",
    spinPurpose: "Shift focus from problem to solution. When customers say 'That would be really helpful', they're ready to hear your pitch.",
    steps: null,
    tip: "💡 The magic phrase: 'So if we could solve [problem they named], what would that mean for [business outcome they care about]?' Let them answer.",
    avoid: "🚫 Don't answer your own need-payoff questions. Ask, then be quiet.",
    spinNote: "SPIN Rule: When a customer says 'Yes, that would make a big difference' — that's your green light to present."
  },
  {
    id: "qualify",
    label: "Match Services",
    emoji: "🗺️",
    time: "45–50 min",
    accent: "#9B59B6",
    title: "Match to Services",
    objective: "Now you've earned the right to present. Only bring in services that directly solve what they told you. Be surgical — not exhaustive.",
    services: [
      { name: "Road Freight", trigger: "Regular domestic volume, cost-sensitive, flexible timelines", icon: "🚛", spinLink: "Late deliveries, reliability issues, cost overruns" },
      { name: "Air Freight", trigger: "Urgent or time-critical shipments, high-value goods", icon: "✈️", spinLink: "Missing delivery windows, contract risk, urgent spikes" },
      { name: "B2C / Parcel", trigger: "Ecommerce, home delivery, returns management", icon: "📦", spinLink: "Customer complaints, returns complexity, last-mile failures" },
      { name: "Premium Services", trigger: "White-glove, temperature-controlled, high-value cargo", icon: "💎", spinLink: "Damage claims, compliance risk, specialist handling gaps" },
      { name: "International", trigger: "Cross-border, import/export, customs complexity", icon: "🌍", spinLink: "Customs delays, compliance burden, multi-provider complexity" },
      { name: "Courier", trigger: "Same-day, urgent documents, last-minute critical items", icon: "⚡", spinLink: "Same-day emergencies, staff time chasing urgent freight" }
    ],
    tip: "💡 Intro each service by referencing their problem: 'Earlier you mentioned [X] — this is exactly what our [service] solves.'",
    avoid: "🚫 Don't present services they don't qualify for. It signals you weren't listening.",
    spinNote: "SPIN Rule: Only present capabilities that directly address Implied or Explicit Needs you've already surfaced."
  },
  {
    id: "close",
    label: "Close",
    emoji: "✅",
    time: "50–60 min",
    accent: "#27AE60",
    title: "Obtain Commitment",
    objective: "SPIN doesn't slam-close. It obtains commitment naturally — because you've built genuine need. Agree the next step clearly.",
    steps: [
      "Summarise their problems and your solutions: 'Based on what you've shared today...'",
      "Trial close: 'On a scale of 1–10, how well does what we've discussed address your needs?'",
      "If 7 or below: 'What would make it a 9 or 10?' — then address that specifically.",
      "Ask for commitment: 'What would the next step look like from your side?'",
      "Propose your next step: quote, trial lane, site visit, follow-up with decision-maker.",
      "Lock a date before you leave the room."
    ],
    tip: "💡 In SPIN, closing is a natural conclusion — not a trick. If you've done S-P-I-N well, asking for the next step feels obvious to both sides.",
    avoid: "🚫 Never leave without a defined, dated next step. 'I'll be in touch' is a deal killer.",
    spinNote: "SPIN Rule: Don't rush to close. Premature closing before needs are developed causes objections. Earn the close through great questions."
  }
];

const OBJECTIONS = [
  { concern: "We're happy with our current provider", spin: "Earlier you mentioned [problem]. Has your current provider solved that, or is it still an issue?", response: "Acknowledge, then link back to the pain they described. A satisfied customer doesn't have the problems they just told you about." },
  { concern: "Your price is higher", spin: "You mentioned late deliveries cost you [X]. How does that compare to the difference in our pricing?", response: "Reframe cost in terms of the implication they shared. Price objections shrink when weighed against real business impact." },
  { concern: "We're locked into a contract", spin: "When does that expire? Would it make sense to plan ahead so you're ready to switch?", response: "Turn it into a future opportunity. Agree a review date and stay in contact." },
  { concern: "I need to speak to my team / manager", spin: "Of course. Based on what we've discussed today, what do you think their main concerns will be?", response: "This surfaces hidden objections early and positions you to help them sell internally." },
  { concern: "We only move small volumes", spin: "You mentioned growth is on the radar. When volumes increase, how important does reliability become?", response: "Use the implication of growth to make the relationship valuable now, not later." }
];

const CHECKLIST = [
  "Situation established (volumes, modes, providers)",
  "Problems surfaced (at least 2–3)",
  "Implications developed (cost, risk, impact)",
  "Need-Payoff confirmed (customer stated the value)",
  "Services matched to explicit needs only",
  "Objections handled with SPIN references",
  "Next step agreed and dated",
  "CRM / notes updated after call"
];

export default function FreightSpinGuide() {
  const [activeStage, setActiveStage] = useState(0);
  const [completedStages, setCompletedStages] = useState<Set<number>>(new Set());
  const [checkedQuestions, setCheckedQuestions] = useState<Record<string, boolean>>({});
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [expandedObj, setExpandedObj] = useState<number | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [showChecklist, setShowChecklist] = useState(false);
  const [showObjections, setShowObjections] = useState(false);

  const stage = STAGES[activeStage];
  const spinQs = stage.spinType ? SPIN_QUESTIONS[stage.spinType] : null;
  const checkedCount = Object.values(checklist).filter(Boolean).length;
  const qCheckedCount = stage.spinType ? Object.entries(checkedQuestions).filter(([k, v]) => v && k.startsWith(stage.spinType as string)).length : 0;

  const toggleQ = (key: string) => setCheckedQuestions(p => ({ ...p, [key]: !p[key] }));
  const toggleSvc = (n: string) => setSelectedServices(p => { const s = new Set(p); s.has(n) ? s.delete(n) : s.add(n); return s; });
  const toggleStage = (i: number) => setCompletedStages(p => { const s = new Set(p); s.has(i) ? s.delete(i) : s.add(i); return s; });
  const toggleCheck = (item: string) => setChecklist(p => ({ ...p, [item]: !p[item] }));

  const spinColors = { situation: "#4ECDC4", problem: "#F7B731", implication: "#E55353", needPayoff: "#26D96B" };
  const spinLabels = { situation: "S", problem: "P", implication: "I", needPayoff: "N" };

  return (
    <div style={{
      fontFamily: "'Trebuchet MS', 'Gill Sans', sans-serif",
      background: "#0f0f13",
      minHeight: "100%",
      color: "#e8e4dc",
      display: "flex",
      flexDirection: "column",
      maxWidth: 480,
      margin: "0 auto",
      borderRadius: "12px",
      overflow: "hidden"
    }}>

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0f0f13 0%, #1c1c24 100%)",
        borderBottom: "1px solid #2a2a36",
        padding: "14px 18px"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 4, color: "#888", textTransform: "uppercase", marginBottom: 3 }}>
              Freight Sales · SPIN Method
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>
              SPIN<span style={{ color: "#4ECDC4" }}>.</span>Freight
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* SPIN progress pills */}
            {["S","P","I","N"].map((l, i) => {
              const types = ["situation","problem","implication","needPayoff"];
              const stageIdx = [1,2,3,4];
              const done = completedStages.has(stageIdx[i]);
              const cols = ["#4ECDC4","#F7B731","#E55353","#26D96B"];
              return (
                <div key={l} style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: done ? cols[i] : "#1c1c24",
                  border: `2px solid ${done ? cols[i] : "#2a2a36"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 900,
                  color: done ? "#0f0f13" : cols[i]
                }}>{l}</div>
              );
            })}
          </div>
        </div>

        {/* Action bar */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => setShowChecklist(!showChecklist)} style={{
            flex: 1, background: showChecklist ? "#4ECDC4" : "#1c1c24",
            color: showChecklist ? "#0f0f13" : "#4ECDC4",
            border: `1px solid #4ECDC444`, borderRadius: 8,
            padding: "7px 0", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600
          }}>✅ Checklist {checkedCount > 0 ? `${checkedCount}/${CHECKLIST.length}` : ""}</button>
          <button onClick={() => setShowObjections(!showObjections)} style={{
            flex: 1, background: showObjections ? "#E55353" : "#1c1c24",
            color: showObjections ? "#fff" : "#E55353",
            border: `1px solid #E5535344`, borderRadius: 8,
            padding: "7px 0", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600
          }}>🛡️ Objections</button>
          <div style={{
            background: "#1c1c24", border: "1px solid #2a2a36",
            borderRadius: 8, padding: "7px 12px",
            fontSize: 11, color: "#888"
          }}>{completedStages.size}/7 done</div>
        </div>
      </div>

      {/* Checklist Panel */}
      {showChecklist && (
        <div style={{ background: "#13131a", borderBottom: "1px solid #2a2a36", padding: "14px 18px" }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#4ECDC4", marginBottom: 10, textTransform: "uppercase", fontWeight: 700 }}>
            SPIN Call Checklist
          </div>
          {CHECKLIST.map((item, i) => (
            <div key={i} onClick={() => toggleCheck(item)} style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              cursor: "pointer", padding: "7px 10px", borderRadius: 6, marginBottom: 4,
              background: checklist[item] ? "#26D96B11" : "#1c1c24",
              border: `1px solid ${checklist[item] ? "#26D96B44" : "#2a2a36"}`
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: 3, flexShrink: 0, marginTop: 1,
                border: `2px solid ${checklist[item] ? "#26D96B" : "#444"}`,
                background: checklist[item] ? "#26D96B" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, color: "#0f0f13"
              }}>{checklist[item] ? "✓" : ""}</div>
              <span style={{ fontSize: 12, color: checklist[item] ? "#26D96B" : "#aaa", lineHeight: 1.4 }}>{item}</span>
            </div>
          ))}
        </div>
      )}

      {/* Objections Panel */}
      {showObjections && (
        <div style={{ background: "#13131a", borderBottom: "1px solid #2a2a36", padding: "14px 18px" }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#E55353", marginBottom: 10, textTransform: "uppercase", fontWeight: 700 }}>
            Objection Responses — SPIN-Based
          </div>
          {OBJECTIONS.map((obj, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div onClick={() => setExpandedObj(expandedObj === i ? null : i)} style={{
                padding: "10px 12px", background: "#1c1c24",
                border: `1px solid ${expandedObj === i ? "#E55353" : "#2a2a36"}`,
                borderRadius: expandedObj === i ? "8px 8px 0 0" : 8,
                cursor: "pointer", display: "flex", justifyContent: "space-between"
              }}>
                <span style={{ fontSize: 12, color: "#ddd" }}>"{obj.concern}"</span>
                <span style={{ color: "#E55353", fontSize: 14 }}>{expandedObj === i ? "▲" : "▼"}</span>
              </div>
              {expandedObj === i && (
                <div style={{
                  background: "#1a1015", border: "1px solid #E55353",
                  borderTop: "none", borderRadius: "0 0 8px 8px", padding: "10px 12px"
                }}>
                  <div style={{ fontSize: 10, color: "#E55353", fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
                    SPIN REDIRECT
                  </div>
                  <div style={{ fontSize: 12, color: "#ffb3b3", marginBottom: 8, fontStyle: "italic", lineHeight: 1.5 }}>
                    "{obj.spin}"
                  </div>
                  <div style={{ fontSize: 11, color: "#999", lineHeight: 1.5 }}>{obj.response}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stage Nav */}
      <div style={{ display: "flex", overflowX: "auto", background: "#0a0a0e", borderBottom: "1px solid #1c1c24" }}>
        {STAGES.map((s, i) => (
          <button key={s.id} onClick={() => setActiveStage(i)} style={{
            background: activeStage === i ? "#1c1c24" : "transparent",
            color: activeStage === i ? s.accent : completedStages.has(i) ? "#26D96B" : "#555",
            border: "none",
            borderBottom: activeStage === i ? `3px solid ${s.accent}` : "3px solid transparent",
            padding: "10px 12px", cursor: "pointer", fontSize: 9,
            fontFamily: "inherit", whiteSpace: "nowrap",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2
          }}>
            <span style={{ fontSize: 14 }}>{completedStages.has(i) ? "✅" : s.emoji}</span>
            <span style={{ letterSpacing: 0.3, fontWeight: 600 }}>{s.label}</span>
            <span style={{ fontSize: 8, opacity: 0.6 }}>{s.time}</span>
          </button>
        ))}
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: 18, overflowY: "auto", maxHeight: "600px" }}>

        {/* Stage Header */}
        <div style={{
          background: `linear-gradient(135deg, #1c1c24, ${stage.accent}18)`,
          border: `1px solid ${stage.accent}44`,
          borderLeft: `4px solid ${stage.accent}`,
          borderRadius: 10, padding: "14px 16px", marginBottom: 14
        }}>
          {stage.spinLabel && (
            <div style={{
              display: "inline-block",
              background: stage.spinColor + "22",
              color: stage.spinColor,
              border: `1px solid ${stage.spinColor}55`,
              borderRadius: 20, padding: "2px 10px",
              fontSize: 9, fontWeight: 900, letterSpacing: 2,
              marginBottom: 8, textTransform: "uppercase"
            }}>
              {stage.spinLabel} QUESTIONS
            </div>
          )}
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
            {stage.emoji} {stage.title}
          </div>
          <div style={{ fontSize: 10, color: stage.accent, letterSpacing: 1, marginBottom: 8 }}>⏱ {stage.time}</div>
          <div style={{ fontSize: 12, color: "#b0b8c8", lineHeight: 1.6 }}>{stage.objective}</div>
          {stage.spinPurpose && (
            <div style={{
              marginTop: 10, padding: "8px 10px",
              background: stage.spinColor + "11",
              border: `1px solid ${stage.spinColor}33`,
              borderRadius: 6, fontSize: 11, color: stage.spinColor, lineHeight: 1.5
            }}>
              <span style={{ fontWeight: 700 }}>Purpose: </span>{stage.spinPurpose}
            </div>
          )}
        </div>

        {/* SPIN Questions */}
        {spinQs && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: stage.accent, marginBottom: 10, textTransform: "uppercase", fontWeight: 700 }}>
              Questions to Ask — tap to track
            </div>
            {spinQs.map((q, i) => {
              const key = `${stage.spinType}-${i}`;
              const done = checkedQuestions[key];
              return (
                <div key={i} onClick={() => toggleQ(key)} style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  padding: "10px 12px", marginBottom: 6, borderRadius: 8, cursor: "pointer",
                  background: done ? stage.accent + "18" : "#1c1c24",
                  border: `1px solid ${done ? stage.accent + "66" : "#2a2a36"}`,
                  transition: "all 0.2s"
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                    border: `2px solid ${done ? stage.accent : "#333"}`,
                    background: done ? stage.accent : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: "#0f0f13", fontWeight: 900
                  }}>{done ? "✓" : ""}</div>
                  <span style={{ fontSize: 12, color: done ? stage.accent : "#ccc", lineHeight: 1.5 }}>"{q}"</span>
                </div>
              );
            })}
            {qCheckedCount > 0 && (
              <div style={{
                padding: "7px 12px", background: stage.accent + "11",
                border: `1px solid ${stage.accent}44`, borderRadius: 8,
                fontSize: 11, color: stage.accent, marginTop: 4
              }}>
                {qCheckedCount} of {spinQs.length} questions asked
              </div>
            )}
          </div>
        )}

        {/* Steps (non-SPIN stages) */}
        {stage.steps && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: stage.accent, marginBottom: 10, textTransform: "uppercase", fontWeight: 700 }}>
              Steps to Follow
            </div>
            {stage.steps.map((step, i) => (
              <div key={i} style={{
                display: "flex", gap: 10, marginBottom: 8, padding: "10px 12px",
                background: "#1c1c24", borderRadius: 8, border: "1px solid #2a2a36", alignItems: "flex-start"
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", background: stage.accent,
                  color: "#0f0f13", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 900, flexShrink: 0, marginTop: 1
                }}>{i + 1}</div>
                <span style={{ fontSize: 12, color: "#ccc", lineHeight: 1.5 }}>{step}</span>
              </div>
            ))}
          </div>
        )}

        {/* Services */}
        {stage.services && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: stage.accent, marginBottom: 10, textTransform: "uppercase", fontWeight: 700 }}>
              Tap services that match their needs
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {stage.services.map(svc => (
                <div key={svc.name} onClick={() => toggleSvc(svc.name)} style={{
                  padding: "12px", borderRadius: 8, cursor: "pointer",
                  border: `2px solid ${selectedServices.has(svc.name) ? stage.accent : "#2a2a36"}`,
                  background: selectedServices.has(svc.name) ? stage.accent + "18" : "#1c1c24",
                  transition: "all 0.2s"
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{svc.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: selectedServices.has(svc.name) ? stage.accent : "#e8e4dc", marginBottom: 4 }}>
                    {svc.name}
                  </div>
                  <div style={{ fontSize: 10, color: "#666", lineHeight: 1.4, marginBottom: 4 }}>{svc.trigger}</div>
                  <div style={{ fontSize: 10, color: "#E55353", fontStyle: "italic", lineHeight: 1.3 }}>
                    💬 SPIN: {svc.spinLink}
                  </div>
                </div>
              ))}
            </div>
            {selectedServices.size > 0 && (
              <div style={{
                marginTop: 10, padding: "8px 12px",
                background: stage.accent + "11", border: `1px solid ${stage.accent}44`,
                borderRadius: 8, fontSize: 11, color: stage.accent
              }}>
                ✅ Presenting: {[...selectedServices].join(" · ")}
              </div>
            )}
          </div>
        )}

        {/* SPIN note */}
        {stage.spinNote && (
          <div style={{
            padding: "10px 12px", background: "#1a1a2e",
            border: "1px solid #3a3a6e", borderRadius: 8,
            fontSize: 11, color: "#9999dd", lineHeight: 1.5, marginBottom: 10
          }}>
            <span style={{ fontWeight: 700, color: "#bbbbff" }}>📖 SPIN Note: </span>{stage.spinNote}
          </div>
        )}

        {/* Tip & Avoid */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          <div style={{ padding: "9px 12px", background: "#0f1f12", border: "1px solid #26D96B44", borderRadius: 8, fontSize: 11, color: "#81e8a0", lineHeight: 1.5 }}>
            {stage.tip}
          </div>
          <div style={{ padding: "9px 12px", background: "#1f0f0f", border: "1px solid #E5535344", borderRadius: 8, fontSize: 11, color: "#f0a0a0", lineHeight: 1.5 }}>
            {stage.avoid}
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#555", marginBottom: 6, textTransform: "uppercase", fontWeight: 700 }}>
            Call Notes
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Type notes here during the call..."
            style={{
              width: "100%", minHeight: 80, background: "#1c1c24",
              border: "1px solid #2a2a36", borderRadius: 8, padding: "10px 12px",
              color: "#e8e4dc", fontSize: 12, fontFamily: "inherit",
              resize: "vertical", boxSizing: "border-box", lineHeight: 1.5, outline: "none"
            }}
          />
        </div>

        {/* Nav */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setActiveStage(Math.max(0, activeStage - 1))} disabled={activeStage === 0} style={{
            background: "transparent", border: "1px solid #2a2a36", color: "#555",
            borderRadius: 8, padding: "10px 18px", fontSize: 12,
            cursor: activeStage === 0 ? "not-allowed" : "pointer", fontFamily: "inherit"
          }}>← Back</button>
          <button onClick={() => toggleStage(activeStage)} style={{
            flex: 1, background: completedStages.has(activeStage) ? "#26D96B22" : stage.accent + "22",
            border: `1px solid ${completedStages.has(activeStage) ? "#26D96B" : stage.accent}`,
            color: completedStages.has(activeStage) ? "#26D96B" : stage.accent,
            borderRadius: 8, padding: "10px 0", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 700
          }}>{completedStages.has(activeStage) ? "✅ Done" : "Mark Done"}</button>
          <button onClick={() => setActiveStage(Math.min(STAGES.length - 1, activeStage + 1))} disabled={activeStage === STAGES.length - 1} style={{
            background: stage.accent, border: "none", color: "#0f0f13",
            borderRadius: 8, padding: "10px 18px", fontSize: 12, fontWeight: 900,
            cursor: activeStage === STAGES.length - 1 ? "not-allowed" : "pointer", fontFamily: "inherit"
          }}>Next →</button>
        </div>
      </div>
    </div>
  );
}

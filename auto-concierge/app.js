/* MTS Auto Concierge - marketplace prototype (complete demo build).
   One shared backend state, connected portals:
   Customer App <-> MTS Admin <-> Garage Portal <-> Parts Supplier Portal <-> Recovery.
   Data lives in localStorage so it works as a realistic clickable MVP without a server. */

const STORAGE_KEY = "mts-auto-concierge-v1";

const REPAIR_CATEGORIES = ["Engine", "Transmission", "Suspension", "AC", "Battery", "Brakes", "Electrical", "Tyres", "Body Work", "Accident"];
const SERVICE_PACKAGES = ["Minor Service", "Major Service", "Oil & Filter Change", "AC Service", "Battery Check", "Detailing / Polish"];
const INSPECTION_TYPES = ["Pre-Purchase Inspection", "Annual Registration Check", "Accident Damage Assessment", "General Health Check"];
const PART_TYPES = ["Genuine New Part", "Aftermarket Part", "Used OEM Part", "Labour Only"];
const OFFER_TYPES = ["Genuine New", "Aftermarket", "Used OEM"];
const REQUEST_TYPES = ["Repair", "Service", "Used Part", "Inspection", "Emergency Breakdown", "Towing"];

const INSPECTION_AREAS = ["Engine", "Transmission / Gearbox", "Brakes", "Suspension & Steering", "Tyres & Wheels", "AC / Cooling", "Battery & Electrical", "Body & Paint", "Interior", "Lights & Electronics"];
const RESULT_OPTIONS = ["Pass", "Attention", "Fail"];

const WORKSHOP_STATUSES = ["Approved", "Vehicle In Garage", "In Repair", "Quality Check"];
const NEXT_STEP = {
  "New Request": ["Start MTS Review", "MTS Review"],
  "Approved": ["Mark Vehicle Received", "Vehicle In Garage"],
  "Vehicle In Garage": ["Start Repair", "In Repair"],
  "In Repair": ["Send To Quality Check", "Quality Check"],
  "Quality Check": ["Mark Ready For Delivery", "Ready For Delivery"]
};
const RECOVERY_FLOW = ["Assigned", "En Route", "Vehicle Collected", "Delivered To Garage"];

const ROLE_TABS = {
  "Customer": [["home", "Home"], ["vehicles", "My Vehicles"], ["jobs", "My Jobs"], ["invoices", "Invoices"], ["chat", "Chat with MTS"]],
  "MTS Admin": [["dashboard", "Dashboard"], ["jobs", "Jobs"], ["partners", "Partners"], ["chats", "Chats"], ["activity", "Activity"]],
  "Garage": [["requests", "Quote Requests"], ["active", "My Jobs"]],
  "Parts Supplier": [["requests", "Parts Requests"]],
  "Recovery": [["tows", "Tow Jobs"]]
};

const seedState = {
  showWelcome: true,
  activeProfileId: "cust-1",
  activeView: "home",
  selectedJobId: null,
  activeThreadId: "cust-1",
  adminFilter: "All",
  adminSearch: "",
  customerFilter: "All",
  counters: { job: 1005, invoice: 2 },
  profiles: [
    { id: "owner", name: "Johnson (MTS Concierge)", role: "MTS Admin", phone: "+971501112223" },
    { id: "cust-1", name: "Ramesh Kumar", role: "Customer", phone: "+971502224441" },
    { id: "cust-2", name: "Fatima Al Ali", role: "Customer", phone: "+971503335552" },
    { id: "gar-1", name: "Al Quoz Star Garage", role: "Garage", phone: "+971504446661", area: "Al Quoz, Dubai", specialties: "AC, Engine, Electrical" },
    { id: "gar-2", name: "Deira Auto Workshop", role: "Garage", phone: "+971505557772", area: "Deira, Dubai", specialties: "Suspension, Brakes, Body Work" },
    { id: "gar-3", name: "Rashidiya German Motors", role: "Garage", phone: "+971506668883", area: "Rashidiya, Dubai", specialties: "German cars, Transmission, Diagnostics" },
    { id: "sup-1", name: "Gulf Genuine Parts LLC", role: "Parts Supplier", phone: "+971507779991", specialties: "Genuine New, Aftermarket" },
    { id: "sup-2", name: "Sharjah Used Parts Yard", role: "Parts Supplier", phone: "+971508880002", specialties: "Used OEM, Scrap recovery" },
    { id: "rec-1", name: "Falcon Recovery", role: "Recovery", phone: "+971509991113", area: "All Dubai + Sharjah" }
  ],
  vehicles: [
    { id: "veh-1", customerId: "cust-1", make: "Nissan", model: "Patrol", year: "2019", engine: "5.6L V8", vin: "", plate: "Dubai N 48213", mileage: "96,500 km" },
    { id: "veh-2", customerId: "cust-1", make: "Honda", model: "Civic", year: "2016", engine: "1.8L", vin: "", plate: "Dubai P 10422", mileage: "148,000 km" },
    { id: "veh-3", customerId: "cust-2", make: "BMW", model: "X5", year: "2021", engine: "3.0L twin turbo", vin: "", plate: "Abu Dhabi 55231", mileage: "41,200 km" }
  ],
  jobs: [
    {
      id: "AC-1001",
      customerId: "cust-1",
      vehicleId: "veh-1",
      type: "Repair",
      category: "AC",
      partName: "",
      description: "AC blows warm air after 10 minutes of driving. Compressor makes a clicking sound when it kicks in.",
      location: "JLT Cluster D, Dubai",
      media: ["ac-vent-video.mp4", "dash-temp-photo.jpg"],
      urgent: false,
      status: "Options Ready",
      dispatches: [
        {
          garageId: "gar-1", status: "Quoted", note: "Customer nearby, AC specialist needed.", at: "2026-07-10T10:05:00+04:00",
          quote: { price: 400, days: "1 day", warranty: "3 months on labour", note: "Labour for compressor swap and regas. Parts sourced through MTS.", at: "2026-07-10T11:20:00+04:00" }
        },
        {
          garageId: "gar-3", status: "Quoted", note: "", at: "2026-07-10T10:05:00+04:00",
          quote: { price: 520, days: "1 day", warranty: "3 months on labour", note: "Includes full AC system leak test.", at: "2026-07-10T12:02:00+04:00" }
        }
      ],
      partsRequests: [
        {
          id: "PRT-1001-A",
          partName: "AC compressor - Nissan Patrol 2019 5.6L",
          note: "Send OEM number if possible.",
          offers: [
            { supplierId: "sup-1", partType: "Genuine New", price: 2100, availability: "2 days - order from dealer", warranty: "12 months", note: "", at: "2026-07-10T12:40:00+04:00" },
            { supplierId: "sup-1", partType: "Aftermarket", price: 900, availability: "In stock - same day", warranty: "6 months", note: "Korean brand, solid quality.", at: "2026-07-10T12:41:00+04:00" },
            { supplierId: "sup-2", partType: "Used OEM", price: 450, availability: "In stock - same day", warranty: "30 days", note: "Pulled from 2018 Patrol, bench tested.", at: "2026-07-10T13:05:00+04:00" }
          ]
        }
      ],
      options: [
        { id: "OPT-1", label: "Genuine New Part", cost: 2500, timeText: "2 days", warranty: "12 months", note: "Best for long-term", recommended: true, garageId: "gar-1" },
        { id: "OPT-2", label: "Aftermarket Part", cost: 1300, timeText: "Same day", warranty: "6 months", note: "Best value", recommended: false, garageId: "gar-1" },
        { id: "OPT-3", label: "Used OEM Part", cost: 650, timeText: "Same day", warranty: "30 days", note: "Budget option", recommended: false, garageId: "gar-1" }
      ],
      selectedOptionId: null,
      assignedGarageId: null,
      recovery: null,
      inspection: null,
      invoice: null,
      review: null,
      chat: [
        { by: "cust-1", name: "Ramesh Kumar", text: "How soon can this be fixed? I need the car for the weekend.", at: "2026-07-10T14:10:00+04:00" },
        { by: "owner", name: "MTS Concierge", text: "We prepared 3 options for you - the aftermarket and used options can be done same day. Open My Jobs to compare and approve.", at: "2026-07-10T14:22:00+04:00" }
      ],
      timeline: [
        { text: "Request submitted", by: "Ramesh Kumar", at: "2026-07-10T09:40:00+04:00" },
        { text: "MTS review started", by: "MTS Concierge", at: "2026-07-10T09:55:00+04:00" },
        { text: "Quote requests sent to Al Quoz Star Garage and Rashidiya German Motors", by: "MTS Concierge", at: "2026-07-10T10:05:00+04:00" },
        { text: "3 repair options sent to customer for approval", by: "MTS Concierge", at: "2026-07-10T14:20:00+04:00" }
      ],
      createdAt: "2026-07-10T09:40:00+04:00"
    },
    {
      id: "AC-1002",
      customerId: "cust-2",
      vehicleId: "veh-3",
      type: "Repair",
      category: "Brakes",
      partName: "",
      description: "Grinding noise from front brakes and steering shake when braking above 80 km/h.",
      location: "Business Bay, Dubai",
      media: ["brake-noise.mp4"],
      urgent: false,
      status: "In Repair",
      dispatches: [
        {
          garageId: "gar-2", status: "Quoted", note: "Brake specialist, customer approved pickup.", at: "2026-07-09T09:10:00+04:00",
          quote: { price: 850, days: "Same day", warranty: "6 months parts and labour", note: "Front pads and discs, aftermarket premium brand.", at: "2026-07-09T10:30:00+04:00" }
        }
      ],
      partsRequests: [
        {
          id: "PRT-1002-A",
          partName: "Front brake pads + discs - BMW X5 2021",
          note: "",
          offers: [
            { supplierId: "sup-1", partType: "Aftermarket", price: 520, availability: "In stock - same day", warranty: "6 months", note: "Textar set.", at: "2026-07-09T10:05:00+04:00" }
          ]
        }
      ],
      options: [
        { id: "OPT-1", label: "Aftermarket Part", cost: 850, timeText: "Same day", warranty: "6 months", note: "Premium aftermarket pads + discs fitted", recommended: true, garageId: "gar-2" }
      ],
      selectedOptionId: "OPT-1",
      assignedGarageId: "gar-2",
      recovery: null,
      inspection: null,
      invoice: null,
      review: null,
      chat: [],
      timeline: [
        { text: "Request submitted", by: "Fatima Al Ali", at: "2026-07-09T08:55:00+04:00" },
        { text: "Quote request sent to Deira Auto Workshop", by: "MTS Concierge", at: "2026-07-09T09:10:00+04:00" },
        { text: "Customer approved Aftermarket Part option - AED 850", by: "Fatima Al Ali", at: "2026-07-09T12:15:00+04:00" },
        { text: "Vehicle received at Deira Auto Workshop", by: "Deira Auto Workshop", at: "2026-07-10T09:00:00+04:00" },
        { text: "Repair started", by: "Deira Auto Workshop", at: "2026-07-10T09:40:00+04:00" }
      ],
      createdAt: "2026-07-09T08:55:00+04:00"
    },
    {
      id: "AC-1003",
      customerId: "cust-1",
      vehicleId: "veh-2",
      type: "Emergency Breakdown",
      category: "Breakdown",
      partName: "",
      description: "Car lost power and cut off. Will not restart. Hazards on, parked on the shoulder.",
      location: "Sheikh Zayed Rd, Exit 41 towards Mall of the Emirates",
      media: [],
      urgent: true,
      status: "New Request",
      dispatches: [],
      partsRequests: [],
      options: [],
      selectedOptionId: null,
      assignedGarageId: null,
      recovery: { companyId: null, status: "Awaiting Assignment" },
      inspection: null,
      invoice: null,
      review: null,
      chat: [],
      timeline: [
        { text: "EMERGENCY breakdown reported", by: "Ramesh Kumar", at: "2026-07-11T08:05:00+04:00" }
      ],
      createdAt: "2026-07-11T08:05:00+04:00"
    },
    {
      id: "AC-0994",
      customerId: "cust-2",
      vehicleId: "veh-3",
      type: "Inspection",
      category: "Pre-Purchase Inspection",
      partName: "",
      description: "Full pre-purchase style health check before a long road trip. Please check everything.",
      location: "Deira Auto Workshop drop-off",
      media: [],
      urgent: false,
      status: "Closed",
      dispatches: [],
      partsRequests: [],
      options: [],
      selectedOptionId: null,
      assignedGarageId: "gar-2",
      recovery: null,
      inspection: {
        by: "Deira Auto Workshop",
        items: [
          { area: "Engine", result: "Pass", note: "No leaks, healthy idle." },
          { area: "Transmission / Gearbox", result: "Pass", note: "Smooth shifts." },
          { area: "Brakes", result: "Attention", note: "Front pads at 30% - replace within 2 months." },
          { area: "Suspension & Steering", result: "Pass", note: "" },
          { area: "Tyres & Wheels", result: "Attention", note: "Rear tyres 4mm, plan replacement." },
          { area: "AC / Cooling", result: "Pass", note: "Cools well, 6C at vent." },
          { area: "Battery & Electrical", result: "Pass", note: "Battery health 82%." },
          { area: "Body & Paint", result: "Pass", note: "Minor stone chips only." },
          { area: "Interior", result: "Pass", note: "" },
          { area: "Lights & Electronics", result: "Pass", note: "All functional." }
        ],
        summary: "Vehicle is in good overall condition and safe for the road trip.",
        recommendation: "Budget for front brake pads and rear tyres within 2 months. No urgent repairs.",
        at: "2026-07-06T13:30:00+04:00"
      },
      invoice: {
        id: "INV-0002",
        lines: [
          { label: "Pre-Purchase Inspection - 10-point report (Deira Auto Workshop)", amount: 250 },
          { label: "MTS Concierge fee", amount: 50 }
        ],
        total: 300,
        status: "Paid",
        at: "2026-07-06T15:00:00+04:00"
      },
      review: { rating: 5, comment: "Very detailed report, gave me total peace of mind before the trip.", by: "Fatima Al Ali", at: "2026-07-06T18:00:00+04:00" },
      chat: [],
      timeline: [
        { text: "Inspection request submitted", by: "Fatima Al Ali", at: "2026-07-06T09:00:00+04:00" },
        { text: "Assigned to Deira Auto Workshop", by: "MTS Concierge", at: "2026-07-06T09:20:00+04:00" },
        { text: "10-point inspection report completed", by: "Deira Auto Workshop", at: "2026-07-06T13:30:00+04:00" },
        { text: "Invoice INV-0002 issued - AED 300", by: "MTS Concierge", at: "2026-07-06T15:00:00+04:00" },
        { text: "Invoice paid. Job closed.", by: "MTS Concierge", at: "2026-07-06T16:10:00+04:00" },
        { text: "Customer rated the job 5 stars", by: "Fatima Al Ali", at: "2026-07-06T18:00:00+04:00" }
      ],
      createdAt: "2026-07-06T09:00:00+04:00"
    },
    {
      id: "AC-0993",
      customerId: "cust-1",
      vehicleId: "veh-2",
      type: "Service",
      category: "Battery Check",
      partName: "",
      description: "Slow crank in the morning, battery warning light flickers.",
      location: "JLT Cluster D, Dubai",
      media: [],
      urgent: false,
      status: "Closed",
      dispatches: [
        {
          garageId: "gar-1", status: "Quoted", note: "", at: "2026-07-02T09:00:00+04:00",
          quote: { price: 60, days: "Same day", warranty: "-", note: "Battery test + fitting.", at: "2026-07-02T09:35:00+04:00" }
        }
      ],
      partsRequests: [],
      options: [
        { id: "OPT-1", label: "Genuine New Part", cost: 420, timeText: "Same day", warranty: "18 months", note: "New AGM battery supplied and fitted", recommended: true, garageId: "gar-1" }
      ],
      selectedOptionId: "OPT-1",
      assignedGarageId: "gar-1",
      recovery: null,
      inspection: null,
      invoice: {
        id: "INV-0001",
        lines: [
          { label: "Genuine New Part - Battery Check (Al Quoz Star Garage)", amount: 420 },
          { label: "MTS Concierge fee", amount: 50 }
        ],
        total: 470,
        status: "Paid",
        at: "2026-07-02T16:00:00+04:00"
      },
      review: { rating: 4, comment: "Quick and fair price. Battery fitted same day.", by: "Ramesh Kumar", at: "2026-07-02T19:00:00+04:00" },
      chat: [],
      timeline: [
        { text: "Request submitted", by: "Ramesh Kumar", at: "2026-07-02T08:30:00+04:00" },
        { text: "Customer approved Genuine New Part option - AED 420", by: "Ramesh Kumar", at: "2026-07-02T10:00:00+04:00" },
        { text: "Vehicle ready for delivery", by: "Al Quoz Star Garage", at: "2026-07-02T14:45:00+04:00" },
        { text: "Invoice INV-0001 issued - AED 470", by: "MTS Concierge", at: "2026-07-02T16:00:00+04:00" },
        { text: "Invoice paid. Job closed.", by: "MTS Concierge", at: "2026-07-02T18:20:00+04:00" },
        { text: "Customer rated the job 4 stars", by: "Ramesh Kumar", at: "2026-07-02T19:00:00+04:00" }
      ],
      createdAt: "2026-07-02T08:30:00+04:00"
    }
  ],
  threads: {
    "cust-1": [
      { by: "cust-1", name: "Ramesh Kumar", text: "Do you also handle insurance accident claims?", at: "2026-07-08T17:30:00+04:00" },
      { by: "owner", name: "MTS Concierge", text: "Yes - send us the police report and we coordinate the approved body shop, parts and paperwork for you.", at: "2026-07-08T17:41:00+04:00" }
    ],
    "cust-2": []
  },
  activity: [
    { text: "AC-1003: EMERGENCY breakdown reported by Ramesh Kumar", at: "2026-07-11T08:05:00+04:00" },
    { text: "AC-1001: 3 repair options sent to customer for approval", at: "2026-07-10T14:20:00+04:00" },
    { text: "AC-1002: Repair started at Deira Auto Workshop", at: "2026-07-10T09:40:00+04:00" }
  ]
};

let state = loadState();
let draft = null;         // in-progress customer request wizard, not persisted
let ratingDraft = 0;      // in-progress star rating
let lastDoc = null;       // { title, html } for print modal

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return migrate(parsed);
    }
  } catch (err) { /* fall through to seed */ }
  return JSON.parse(JSON.stringify(seedState));
}

/* keep older saved states working as the model grows */
function migrate(s) {
  if (typeof s.showWelcome === "undefined") s.showWelcome = false;
  if (typeof s.adminSearch === "undefined") s.adminSearch = "";
  (s.jobs || []).forEach((j) => {
    if (typeof j.inspection === "undefined") j.inspection = null;
    if (typeof j.review === "undefined") j.review = null;
  });
  return s;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) { /* storage full or blocked - prototype keeps running in memory */ }
}

/* ---------- helpers ---------- */

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function nowIso() { return new Date().toISOString(); }

function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function aed(n) { return "AED " + Number(n || 0).toLocaleString("en-US"); }

function profileById(id) { return state.profiles.find((p) => p.id === id) || null; }
function profileName(id) { const p = profileById(id); return p ? p.name : "Unknown"; }
function profilesByRole(role) { return state.profiles.filter((p) => p.role === role); }
function currentProfile() { return profileById(state.activeProfileId) || state.profiles[0]; }
function jobById(id) { return state.jobs.find((j) => j.id === id) || null; }
function vehicleById(id) { return state.vehicles.find((v) => v.id === id) || null; }

function vehicleLabel(vehicleOrId) {
  const v = typeof vehicleOrId === "string" ? vehicleById(vehicleOrId) : vehicleOrId;
  if (!v) return "Unknown vehicle";
  return `${v.make} ${v.model} ${v.year}`;
}

function jobVehicle(job) { return vehicleById(job.vehicleId); }

function statusPillClass(status) {
  const map = {
    "New Request": "danger", "MTS Review": "warn", "Sourcing Quotes": "blue", "Options Ready": "accent",
    "Approved": "blue", "Vehicle In Garage": "blue", "In Repair": "blue", "Quality Check": "warn",
    "Ready For Delivery": "ok", "Invoiced": "warn", "Closed": "ok", "Cancelled": "danger"
  };
  return map[status] || "";
}

function addActivity(text) {
  state.activity.unshift({ text, at: nowIso() });
  if (state.activity.length > 120) state.activity.length = 120;
}

function addTimeline(job, text, byName) {
  job.timeline.push({ text, by: byName, at: nowIso() });
  addActivity(`${job.id}: ${text}`);
}

function pushChat(job, byId, text) {
  job.chat.push({ by: byId, name: profileName(byId), text, at: nowIso() });
}

function nextJobId() {
  const id = `AC-${state.counters.job}`;
  state.counters.job += 1;
  return id;
}

function waLink(phone, text) {
  return `https://wa.me/${String(phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

function categoryOptions(type) {
  if (type === "Service") return SERVICE_PACKAGES;
  if (type === "Inspection") return INSPECTION_TYPES;
  return REPAIR_CATEGORIES;
}

function jobIsOpen(job) { return job.status !== "Closed" && job.status !== "Cancelled"; }
function customerCanCancel(job) { return ["New Request", "MTS Review", "Sourcing Quotes", "Options Ready"].includes(job.status); }
function isInspection(job) { return job.type === "Inspection"; }

function emptyState(title, text) {
  return `<div class="empty-state"><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
}

function starsHtml(rating) {
  const r = Math.round(rating || 0);
  let out = "";
  for (let i = 1; i <= 5; i++) out += i <= r ? "★" : `<span class="empty">★</span>`;
  return `<span class="stars">${out}</span>`;
}

function garageRating(garageId) {
  const rated = state.jobs.filter((j) => j.assignedGarageId === garageId && j.review);
  if (!rated.length) return { avg: 0, count: 0 };
  const sum = rated.reduce((s, j) => s + j.review.rating, 0);
  return { avg: sum / rated.length, count: rated.length };
}

function partnerStats(p) {
  if (p.role === "Garage") {
    const done = state.jobs.filter((j) => j.assignedGarageId === p.id && j.status === "Closed").length;
    const quotes = state.jobs.reduce((s, j) => s + j.dispatches.filter((d) => d.garageId === p.id && d.quote).length, 0);
    const rating = garageRating(p.id);
    return { jobs: done, quotes, rating };
  }
  if (p.role === "Parts Supplier") {
    const offers = state.jobs.reduce((s, j) => s + j.partsRequests.reduce((n, pr) => n + pr.offers.filter((o) => o.supplierId === p.id).length, 0), 0);
    return { offers };
  }
  if (p.role === "Recovery") {
    const tows = state.jobs.filter((j) => j.recovery && j.recovery.companyId === p.id).length;
    return { tows };
  }
  return {};
}

/* per-role tab notification counts */
function badgeCounts(role, meId) {
  const c = {};
  if (role === "Customer") {
    const mine = state.jobs.filter((j) => j.customerId === meId);
    c.jobs = mine.filter((j) => j.status === "Options Ready" && !j.selectedOptionId).length
      + mine.filter((j) => j.status === "Closed" && j.assignedGarageId && !j.review).length;
    c.invoices = mine.filter((j) => j.invoice && j.invoice.status === "Unpaid").length;
  } else if (role === "MTS Admin") {
    c.dashboard = state.jobs.filter((j) => j.status === "New Request").length;
    c.jobs = state.jobs.filter((j) => j.status === "New Request" || j.status === "Ready For Delivery").length;
  } else if (role === "Garage") {
    c.requests = state.jobs.reduce((s, j) => s + (jobIsOpen(j) ? j.dispatches.filter((d) => d.garageId === meId && d.status === "Awaiting Quote").length : 0), 0);
    c.active = state.jobs.filter((j) => j.assignedGarageId === meId && WORKSHOP_STATUSES.includes(j.status)).length;
  } else if (role === "Parts Supplier") {
    let n = 0;
    state.jobs.forEach((j) => {
      if (!jobIsOpen(j) || j.selectedOptionId) return;
      j.partsRequests.forEach((pr) => { if (!pr.offers.some((o) => o.supplierId === meId)) n++; });
    });
    c.requests = n;
  } else if (role === "Recovery") {
    c.tows = state.jobs.filter((j) => j.recovery && j.recovery.companyId === meId && jobIsOpen(j) && j.recovery.status !== "Delivered To Garage").length;
  }
  return c;
}

/* ---------- top-level render ---------- */

const appMain = document.getElementById("appMain");
const tabsNav = document.getElementById("tabs");
const profileSelect = document.getElementById("profileSelect");
const topbar = document.getElementById("topbar");
const portalsButton = document.getElementById("portalsButton");
const modalRoot = document.getElementById("modalRoot");
const modalTitle = document.getElementById("modalTitle");
const printDoc = document.getElementById("printDoc");

function render() {
  if (state.showWelcome) {
    topbar.classList.add("welcome-mode");
    tabsNav.innerHTML = "";
    tabsNav.classList.add("hidden");
    portalsButton.classList.add("hidden");
    profileSelect.parentElement.classList.add("hidden");
    appMain.innerHTML = renderWelcome();
    saveState();
    return;
  }
  topbar.classList.remove("welcome-mode");
  tabsNav.classList.remove("hidden");
  portalsButton.classList.remove("hidden");
  profileSelect.parentElement.classList.remove("hidden");
  renderProfileSelect();
  renderTabs();
  renderMain();
  document.querySelectorAll(".chat-box").forEach((el) => { el.scrollTop = el.scrollHeight; });
  saveState();
}

function renderWelcome() {
  const groups = [
    { key: "Customer", icon: "🚗", who: "For car owners", title: "Customer App", desc: "Report a problem, compare MTS-negotiated options, approve and track - one number for every car issue." },
    { key: "Vendor", icon: "🔧", who: "For partners", title: "Vendor Portal", desc: "Garages, parts suppliers and recovery companies receive steady work from MTS - no marketing needed." },
    { key: "MTS Admin", icon: "🎧", who: "MTS internal", title: "MTS Concierge Desk", desc: "The hub. Understand the problem, source quotes, negotiate, coordinate every job end to end." }
  ];
  return `
    <div class="welcome">
      <div class="welcome-hero">
        <div class="logo-badge">🚘</div>
        <p class="eyebrow">Mendonca Technical Services</p>
        <h2>MTS Auto Concierge</h2>
        <p>Your car problem solved. We find, compare, negotiate and manage. Choose a portal to explore the demo.</p>
      </div>
      <div class="portal-grid">
        ${groups.map((g) => `
          <button class="portal-card" data-action="pick-portal" data-group="${esc(g.key)}">
            <span class="p-icon">${g.icon}</span>
            <span class="who">${esc(g.who)}</span>
            <h3>${esc(g.title)}</h3>
            <p>${esc(g.desc)}</p>
            ${g.key === "Customer" ? `<div class="portal-sub">${profilesByRole("Customer").map((p) => `<span class="pill">${esc(p.name)}</span>`).join("")}</div>` : ""}
            ${g.key === "Vendor" ? `<div class="portal-sub">${["Garage", "Parts Supplier", "Recovery"].map((r) => `<span class="pill">${esc(r)}</span>`).join("")}</div>` : ""}
          </button>`).join("")}
      </div>
      <p class="small" style="text-align:center">Prototype demo - all data is stored locally in this browser. Use "⇄ Portals" any time to switch roles.</p>
    </div>`;
}

function renderProfileSelect() {
  const groups = [["Customers", "Customer"], ["MTS Office", "MTS Admin"], ["Garages", "Garage"], ["Parts Suppliers", "Parts Supplier"], ["Recovery", "Recovery"]];
  profileSelect.innerHTML = groups.map(([label, role]) => {
    const people = profilesByRole(role);
    if (!people.length) return "";
    return `<optgroup label="${esc(label)}">${people.map((p) =>
      `<option value="${esc(p.id)}" ${p.id === state.activeProfileId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</optgroup>`;
  }).join("");
}

function renderTabs() {
  const role = currentProfile().role;
  const tabs = ROLE_TABS[role] || [];
  const active = state.activeView === "jobdetail" ? "jobs" : state.activeView;
  const counts = badgeCounts(role, state.activeProfileId);
  tabsNav.innerHTML = tabs.map(([view, label]) => {
    const n = counts[view] || 0;
    const activeCls = (view === active || (active === "jobs" && view === "jobs")) ? "active" : "";
    return `<button class="tab ${activeCls}" data-action="switch-view" data-view="${view}">${esc(label)}${n ? `<span class="badge">${n}</span>` : ""}</button>`;
  }).join("");
}

function renderMain() {
  const role = currentProfile().role;
  let html = "";
  if (role === "Customer") {
    if (state.activeView === "jobdetail") html = renderJobDetail("customer");
    else if (state.activeView === "vehicles") html = renderCustomerVehicles();
    else if (state.activeView === "jobs") html = renderCustomerJobs();
    else if (state.activeView === "invoices") html = renderCustomerInvoices();
    else if (state.activeView === "chat") html = renderCustomerChat();
    else html = renderCustomerHome();
  } else if (role === "MTS Admin") {
    if (state.activeView === "jobdetail") html = renderJobDetail("admin");
    else if (state.activeView === "jobs") html = renderAdminJobs();
    else if (state.activeView === "partners") html = renderAdminPartners();
    else if (state.activeView === "chats") html = renderAdminChats();
    else if (state.activeView === "activity") html = renderAdminActivity();
    else html = renderAdminDashboard();
  } else if (role === "Garage") {
    html = state.activeView === "active" ? renderGarageActive() : renderGarageRequests();
  } else if (role === "Parts Supplier") {
    html = renderSupplierRequests();
  } else if (role === "Recovery") {
    html = renderRecoveryJobs();
  }
  appMain.innerHTML = html;
}

/* ---------- shared job card ---------- */

function jobCard(job, audience) {
  const v = jobVehicle(job);
  const cust = profileById(job.customerId);
  const bits = [];
  bits.push(`<span class="pill ${statusPillClass(job.status)}">${esc(job.status)}</span>`);
  bits.push(`<span class="pill">${esc(job.type)}</span>`);
  if (job.category) bits.push(`<span class="pill">${esc(job.category)}</span>`);
  if (job.urgent) bits.push(`<span class="pill danger">URGENT</span>`);
  if (audience === "customer" && job.status === "Options Ready" && !job.selectedOptionId) bits.push(`<span class="pill accent">Action needed: choose an option</span>`);
  if (audience === "customer" && job.status === "Closed" && job.assignedGarageId && !job.review) bits.push(`<span class="pill accent">Rate this job</span>`);
  if (audience === "admin" && job.status === "Options Ready" && !job.selectedOptionId) bits.push(`<span class="pill warn">Waiting customer approval</span>`);
  const quoted = job.dispatches.filter((d) => d.status === "Quoted").length;
  if (audience === "admin" && job.dispatches.length) bits.push(`<span class="pill blue">${quoted}/${job.dispatches.length} quotes in</span>`);
  if (job.review) bits.push(`<span class="pill">${starsHtml(job.review.rating)}</span>`);
  return `
    <article class="job-card" data-action="open-job" data-id="${esc(job.id)}">
      <div>
        <h3>${esc(job.id)} - ${esc(vehicleLabel(v))}</h3>
        <p class="small">${audience === "admin" ? esc(cust ? cust.name : "") + " - " : ""}${esc(job.description).slice(0, 110)}${job.description.length > 110 ? "..." : ""}</p>
        <div class="meta">${bits.join("")}</div>
      </div>
      <div class="small">${fmtTime(job.createdAt)}</div>
    </article>`;
}

/* ---------- customer views ---------- */

function renderCustomerHome() {
  const me = currentProfile();
  const myVehicles = state.vehicles.filter((v) => v.customerId === me.id);
  const myJobs = state.jobs.filter((j) => j.customerId === me.id);
  const open = myJobs.filter(jobIsOpen);
  const waiting = myJobs.filter((j) => j.status === "Options Ready" && !j.selectedOptionId);
  const unpaid = myJobs.filter((j) => j.invoice && j.invoice.status === "Unpaid");
  const tiles = [
    { type: "Repair", icon: "🔧", label: "Request Repair", sub: "Describe the problem, we handle the rest" },
    { type: "Service", icon: "🛠️", label: "Request Service", sub: "Minor, major, oil, AC and more" },
    { type: "Inspection", icon: "🔍", label: "Vehicle Inspection", sub: "Pre-purchase and health checks" },
    { type: "Used Part", icon: "⚙️", label: "Find Used Parts", sub: "We hunt scrap yards for you" },
    { type: "Emergency Breakdown", icon: "🚨", label: "Emergency Breakdown", sub: "Immediate help, recovery dispatched", urgent: true },
    { type: "Towing", icon: "🚛", label: "Towing", sub: "Move your car anywhere in UAE", urgent: true }
  ];
  return `
    <div class="section-head">
      <div>
        <h2>Hello, ${esc(me.name.split(" ")[0])}</h2>
        <p>You don't need to search for a garage. You call MTS - we find, compare, negotiate and manage.</p>
      </div>
    </div>
    <div class="quick-stats">
      <div class="stat"><strong>${myVehicles.length}</strong><span>My vehicles</span></div>
      <div class="stat"><strong>${open.length}</strong><span>Open jobs</span></div>
      <div class="stat"><strong>${waiting.length}</strong><span>Waiting my approval</span></div>
      <div class="stat"><strong>${unpaid.length}</strong><span>Unpaid invoices</span></div>
    </div>
    <div class="home-grid">
      ${tiles.map((t) => `
        <button class="home-tile ${t.urgent ? "urgent" : ""}" data-action="start-request" data-type="${esc(t.type)}">
          <span class="tile-icon">${t.icon}</span><strong>${esc(t.label)}</strong><span>${esc(t.sub)}</span>
        </button>`).join("")}
      <button class="home-tile" data-action="compare-quotes"><span class="tile-icon">💰</span><strong>Compare Quotes</strong><span>${waiting.length} job(s) with options ready</span></button>
      <button class="home-tile" data-action="switch-view" data-view="vehicles"><span class="tile-icon">🚗</span><strong>My Vehicles</strong><span>Register unlimited vehicles</span></button>
      <button class="home-tile" data-action="switch-view" data-view="invoices"><span class="tile-icon">🧾</span><strong>My Invoices</strong><span>All payments in one place</span></button>
      <button class="home-tile" data-action="switch-view" data-view="chat"><span class="tile-icon">💬</span><strong>Chat with MTS</strong><span>One number for every car problem</span></button>
    </div>
    ${waiting.length ? `<div class="notice"><h3>Options ready for your approval</h3><p>MTS negotiated prices for you. Compare cost, time and warranty, then choose.</p></div>${waiting.map((j) => jobCard(j, "customer")).join("")}` : ""}
  `;
}

function renderCustomerVehicles() {
  const me = currentProfile();
  const mine = state.vehicles.filter((v) => v.customerId === me.id);
  return `
    <div class="section-head">
      <div><h2>My Vehicles</h2><p>Register unlimited vehicles. MTS keeps the full history per car.</p></div>
    </div>
    <form class="panel" data-form="add-vehicle" autocomplete="off">
      <h3>Add Vehicle</h3>
      <div class="form-grid-3">
        <label>Make<input name="make" required placeholder="Toyota, Nissan, BMW..."></label>
        <label>Model<input name="model" required placeholder="Camry, Patrol, X5..."></label>
        <label>Year<input name="year" required placeholder="2021"></label>
        <label>Engine<input name="engine" placeholder="2.5L, 5.6L V8..."></label>
        <label>Plate Number<input name="plate" placeholder="Dubai A 12345"></label>
        <label>Mileage<input name="mileage" placeholder="85,000 km"></label>
      </div>
      <label>VIN (optional)<input name="vin" placeholder="Chassis number"></label>
      <div class="actions"><button type="submit" class="primary">Save Vehicle</button></div>
    </form>
    <div class="team-grid">
      ${mine.length ? mine.map((v) => {
        const history = state.jobs.filter((j) => j.vehicleId === v.id);
        return `
        <div class="person-card">
          <h3>${esc(vehicleLabel(v))}</h3>
          <dl>
            <dt>Engine</dt><dd>${esc(v.engine || "-")}</dd>
            <dt>Plate</dt><dd>${esc(v.plate || "-")}</dd>
            <dt>Mileage</dt><dd>${esc(v.mileage || "-")}</dd>
            <dt>VIN</dt><dd>${esc(v.vin || "-")}</dd>
          </dl>
          <h4 style="margin:12px 0 6px">Service history (${history.length})</h4>
          ${history.length ? `<ul class="timeline">${history.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((j) =>
            `<li><a href="#" data-action="open-job" data-id="${esc(j.id)}">${esc(j.id)}</a> ${esc(j.category || j.type)} <span class="small">${esc(j.status)} - ${fmtDate(j.createdAt)}</span></li>`).join("")}</ul>`
            : `<p class="small">No jobs yet for this vehicle.</p>`}
        </div>`;
      }).join("") : emptyState("No vehicles yet", "Add your first vehicle to start requesting repairs and services.")}
    </div>`;
}

function renderCustomerJobs() {
  if (draft) return renderWizard();
  const me = currentProfile();
  const mine = state.jobs.filter((j) => j.customerId === me.id).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filters = ["All", "Waiting My Approval", "Active", "Completed", "Cancelled"];
  const f = state.customerFilter;
  const filtered = mine.filter((j) => {
    if (f === "Waiting My Approval") return j.status === "Options Ready" && !j.selectedOptionId;
    if (f === "Active") return jobIsOpen(j);
    if (f === "Completed") return j.status === "Closed";
    if (f === "Cancelled") return j.status === "Cancelled";
    return true;
  });
  return `
    <div class="section-head">
      <div><h2>My Jobs</h2><p>Every request flows through MTS. Track quotes, approvals, repair progress and invoices.</p></div>
      <button class="primary" data-action="start-request" data-type="">New Request</button>
    </div>
    <div class="filters">
      ${filters.map((x) => `<button class="${x === f ? "active" : ""}" data-action="set-customer-filter" data-value="${esc(x)}">${esc(x)}</button>`).join("")}
    </div>
    <div class="job-list">
      ${filtered.length ? filtered.map((j) => jobCard(j, "customer")).join("") : emptyState("No jobs here", "Start a new request from the Home screen.")}
    </div>`;
}

function renderCustomerInvoices() {
  const me = currentProfile();
  const invJobs = state.jobs.filter((j) => j.customerId === me.id && j.invoice).slice().sort((a, b) => b.invoice.at.localeCompare(a.invoice.at));
  return `
    <div class="section-head">
      <div><h2>My Invoices</h2><p>Transparent pricing - the price you approved is the price you pay.</p></div>
    </div>
    <div class="sync-list">
      ${invJobs.length ? invJobs.map((j) => `
        <div class="sync-item">
          <div class="section-head" style="margin-bottom:8px">
            <div><h3 style="margin-bottom:2px">${esc(j.invoice.id)} - ${esc(j.id)}</h3><p class="small">${esc(vehicleLabel(jobVehicle(j)))} - ${fmtTime(j.invoice.at)}</p></div>
            <span class="pill ${j.invoice.status === "Paid" ? "ok" : "warn"}">${esc(j.invoice.status)}</span>
          </div>
          ${invoiceTable(j.invoice)}
          <div class="actions"><button data-action="print-invoice" data-job="${esc(j.id)}">🖨️ View / Print Invoice</button></div>
        </div>`).join("") : emptyState("No invoices yet", "Invoices appear here after a job is completed.")}
    </div>`;
}

function invoiceTable(inv) {
  return `
    <table class="invoice-table">
      <tr><th>Item</th><th>Amount</th></tr>
      ${inv.lines.map((l) => `<tr><td>${esc(l.label)}</td><td>${aed(l.amount)}</td></tr>`).join("")}
      <tr class="total"><td>Total</td><td>${aed(inv.total)}</td></tr>
    </table>`;
}

function renderCustomerChat() {
  const me = currentProfile();
  const msgs = state.threads[me.id] || [];
  return `
    <div class="section-head">
      <div><h2>Chat with MTS</h2><p>One chat for anything about your cars - repairs, parts, towing, advice.</p></div>
      <a href="${waLink(profileById("owner").phone, "Hi MTS, I need help with my car.")}" target="_blank" rel="noopener"><button>Open in WhatsApp</button></a>
    </div>
    <div class="panel">
      ${threadBox(msgs, me.id)}
      <form class="chat-form" data-form="thread-send" data-customer="${esc(me.id)}">
        <input name="text" required placeholder="Type a message to MTS...">
        <button type="submit" class="primary">Send</button>
      </form>
    </div>`;
}

function threadBox(msgs, viewerId) {
  return `<div class="chat-box">
    ${msgs.length ? msgs.map((m) => `
      <div class="chat-bubble ${m.by === viewerId ? "me" : ""}">
        ${esc(m.text)}
        <span class="small">${esc(m.name)} - ${fmtTime(m.at)}</span>
      </div>`).join("") : `<p class="small">No messages yet.</p>`}
  </div>`;
}

/* ---------- customer request wizard ---------- */

function renderWizard() {
  const me = currentProfile();
  const quick = draft.type === "Emergency Breakdown" || draft.type === "Towing";
  const steps = quick ? ["Type", "Vehicle", "Location"] : ["Type", "Vehicle", "Problem", "Details"];
  const activeStep = Math.min(draft.step, steps.length - 1);
  let body = "";

  if (draft.step === 0) {
    body = `
      <h3>What do you need?</h3>
      <div class="choice-grid">
        ${REQUEST_TYPES.map((t) => `<button data-action="wizard-pick-type" data-value="${esc(t)}" class="${draft.type === t ? "selected" : ""}">${esc(t)}</button>`).join("")}
      </div>`;
  } else if (draft.step === 1) {
    const mine = state.vehicles.filter((v) => v.customerId === me.id);
    body = `
      <h3>Which vehicle?</h3>
      ${mine.length ? `<div class="vehicle-pick">
        ${mine.map((v) => `<button data-action="wizard-pick-vehicle" data-id="${esc(v.id)}" class="${draft.vehicleId === v.id ? "selected" : ""}">${esc(vehicleLabel(v))}<span class="small"> - ${esc(v.plate || "no plate")} - ${esc(v.mileage || "")}</span></button>`).join("")}
      </div>` : `<div class="notice"><p>No vehicles registered yet. Add one first in My Vehicles.</p></div>
      <div class="actions"><button class="primary" data-action="switch-view" data-view="vehicles">Go to My Vehicles</button></div>`}`;
  } else if (draft.step === 2 && !quick) {
    const cats = categoryOptions(draft.type);
    body = `
      <h3>${draft.type === "Service" ? "Which service package?" : draft.type === "Inspection" ? "Which inspection?" : "Problem category"}</h3>
      <div class="choice-grid">
        ${cats.map((c) => `<button data-action="wizard-pick-category" data-value="${esc(c)}" class="${draft.category === c ? "selected" : ""}">${esc(c)}</button>`).join("")}
      </div>`;
  } else {
    body = `
      <form data-form="wizard-details" autocomplete="off">
        <h3>${quick ? "Where are you? We will dispatch help." : "Tell us the details"}</h3>
        ${draft.type === "Used Part" ? `<label>Part needed<input name="partName" required placeholder="e.g. AC compressor, side mirror, gearbox..." value="${esc(draft.partName)}"></label>` : ""}
        <label>${quick ? "Situation" : "Describe the problem"}<textarea name="description" rows="3" required placeholder="${quick ? "Engine cut off, flat tyre, accident..." : "What happens, since when, any sounds or warning lights..."}">${esc(draft.description)}</textarea></label>
        <div class="form-grid">
          <label>Location<input name="location" required placeholder="Area, street, landmark" value="${esc(draft.location)}"></label>
          <label>Photos / videos<input type="file" name="media" data-media multiple accept="image/*,video/*"></label>
        </div>
        ${draft.media.length ? `<div class="chip-list" style="margin-top:8px">${draft.media.map((m) => `<span class="pill">${esc(m)}</span>`).join("")}</div>` : ""}
        <p class="small">Photos help garages give accurate quotes. In this prototype only file names are stored.</p>
        <div class="actions">
          <button type="button" data-action="wizard-gps">📍 Use GPS location</button>
          <button type="submit" class="primary">${quick ? "🚨 Send Emergency Request" : "Submit Request"}</button>
        </div>
      </form>`;
  }

  return `
    <div class="section-head">
      <div><h2>New Request${draft.type ? " - " + esc(draft.type) : ""}</h2><p>MTS will review it, collect quotes and send you options to approve.</p></div>
      <button data-action="wizard-cancel">Cancel</button>
    </div>
    <div class="panel">
      <div class="stepper">
        ${steps.map((s, i) => `<span class="step-dot ${i === activeStep ? "active" : i < activeStep ? "done" : ""}">${i + 1}. ${esc(s)}</span>`).join("")}
      </div>
      ${body}
      ${draft.step > 0 ? `<div class="actions"><button data-action="wizard-back">Back</button></div>` : ""}
    </div>`;
}

function createJobFromDraft(form) {
  const me = currentProfile();
  const quick = draft.type === "Emergency Breakdown" || draft.type === "Towing";
  const job = {
    id: nextJobId(),
    customerId: me.id,
    vehicleId: draft.vehicleId,
    type: draft.type,
    category: quick ? (draft.type === "Towing" ? "Towing" : "Breakdown") : draft.category,
    partName: form.partName ? form.partName.value.trim() : "",
    description: form.description.value.trim(),
    location: form.location.value.trim(),
    media: draft.media.slice(),
    urgent: quick,
    status: "New Request",
    dispatches: [],
    partsRequests: [],
    options: [],
    selectedOptionId: null,
    assignedGarageId: null,
    recovery: quick ? { companyId: null, status: "Awaiting Assignment" } : null,
    inspection: null,
    invoice: null,
    review: null,
    chat: [],
    timeline: [],
    createdAt: nowIso()
  };
  state.jobs.unshift(job);
  addTimeline(job, quick ? "EMERGENCY request submitted" : "Request submitted", me.name);
  pushChat(job, "owner", quick
    ? "MTS received your emergency request. We are arranging recovery now - keep your phone close."
    : "Thanks! MTS received your request. We are reviewing it and will send you compared options shortly.");
  draft = null;
  state.selectedJobId = job.id;
  state.activeView = "jobdetail";
}

/* ---------- job detail (customer + admin) ---------- */

function renderJobDetail(mode) {
  const job = jobById(state.selectedJobId);
  if (!job) { state.activeView = "jobs"; return currentProfile().role === "MTS Admin" ? renderAdminJobs() : renderCustomerJobs(); }
  const v = jobVehicle(job);
  const cust = profileById(job.customerId);
  const me = currentProfile();

  const head = `
    <div class="section-head">
      <div>
        <h2>${esc(job.id)} - ${esc(vehicleLabel(v))}</h2>
        <div class="meta">
          <span class="pill ${statusPillClass(job.status)}">${esc(job.status)}</span>
          <span class="pill">${esc(job.type)}</span>
          ${job.category ? `<span class="pill">${esc(job.category)}</span>` : ""}
          ${job.urgent ? `<span class="pill danger">URGENT</span>` : ""}
          ${mode === "admin" ? `<span class="pill blue">${esc(cust ? cust.name : "")}</span>` : ""}
        </div>
      </div>
      <button data-action="back-to-jobs">← Back</button>
    </div>`;

  const facts = `
    <div class="panel">
      <h3>Request</h3>
      <p>${esc(job.description)}</p>
      <dl style="display:grid;grid-template-columns:110px 1fr;gap:6px;margin:0;font-size:14px">
        ${job.partName ? `<dt class="small">Part needed</dt><dd style="margin:0">${esc(job.partName)}</dd>` : ""}
        <dt class="small">Location</dt><dd style="margin:0">${esc(job.location)}</dd>
        <dt class="small">Vehicle</dt><dd style="margin:0">${esc(vehicleLabel(v))} - ${esc(v ? v.plate : "")} - ${esc(v ? v.mileage : "")}</dd>
        ${mode === "admin" && cust ? `<dt class="small">Customer</dt><dd style="margin:0">${esc(cust.name)} - ${esc(cust.phone)} <a href="${waLink(cust.phone, `Hi ${cust.name.split(" ")[0]}, MTS Auto Concierge here about job ${job.id}.`)}" target="_blank" rel="noopener">WhatsApp</a></dd>` : ""}
        <dt class="small">Created</dt><dd style="margin:0">${fmtTime(job.createdAt)}</dd>
      </dl>
      ${job.media.length ? `<div class="chip-list" style="margin-top:10px">${job.media.map((m) => `<span class="pill">📎 ${esc(m)}</span>`).join("")}</div>` : ""}
    </div>`;

  const timeline = `
    <div class="panel">
      <h3>Timeline</h3>
      <ul class="timeline">
        ${job.timeline.slice().reverse().map((t) => `<li>${esc(t.text)}<span class="small">${esc(t.by)} - ${fmtTime(t.at)}</span></li>`).join("")}
      </ul>
    </div>`;

  const chatPanel = `
    <div class="panel">
      <h3>Job Chat</h3>
      ${threadBox(job.chat, me.id)}
      <form class="chat-form" data-form="chat-send" data-job="${esc(job.id)}">
        <input name="text" required placeholder="Message about this job...">
        <button type="submit" class="primary">Send</button>
      </form>
    </div>`;

  const invoicePanel = job.invoice ? `
    <div class="panel">
      <div class="section-head" style="margin-bottom:8px">
        <h3 style="margin-bottom:0">Invoice ${esc(job.invoice.id)}</h3>
        <span class="pill ${job.invoice.status === "Paid" ? "ok" : "warn"}">${esc(job.invoice.status)}</span>
      </div>
      ${invoiceTable(job.invoice)}
      <div class="actions">
        <button data-action="print-invoice" data-job="${esc(job.id)}">🖨️ View / Print Invoice</button>
        ${mode === "admin" && job.invoice.status === "Unpaid" ? `<button class="primary" data-action="mark-paid" data-job="${esc(job.id)}">Mark Paid & Close Job</button>` : ""}
      </div>
    </div>` : "";

  if (mode === "customer") {
    return head + `
      <div class="job-layout">
        <div class="stack">
          ${optionsPanel(job, "customer")}
          ${job.inspection ? inspectionDisplay(job, "customer") : ""}
          ${facts}
          ${invoicePanel}
          ${reviewPanel(job)}
          ${chatPanel}
        </div>
        <div class="stack">
          ${job.recovery ? recoveryStatusPanel(job, "customer") : ""}
          ${timeline}
          <div class="panel">
            <h3>Need help fast?</h3>
            <div class="actions">
              <a href="${waLink(profileById("owner").phone, `Hi MTS, checking on my job ${job.id} (${vehicleLabel(v)}).`)}" target="_blank" rel="noopener"><button>WhatsApp MTS</button></a>
              ${customerCanCancel(job) ? `<button class="danger" data-action="cancel-job" data-job="${esc(job.id)}">Cancel Request</button>` : ""}
            </div>
          </div>
        </div>
      </div>`;
  }

  /* admin detail */
  return head + `
    <div class="job-layout">
      <div class="stack">
        ${facts}
        ${statusControlPanel(job)}
        ${job.recovery ? recoveryAdminPanel(job) : ""}
        ${isInspection(job) ? inspectionAdminPanel(job) : ""}
        ${!isInspection(job) ? dispatchPanel(job) : ""}
        ${!isInspection(job) ? partsPanel(job, "admin") : ""}
        ${!isInspection(job) ? optionsPanel(job, "admin") : ""}
        ${adminInvoicePanel(job)}
        ${invoicePanel}
        ${job.review ? reviewPanel(job) : ""}
      </div>
      <div class="stack">
        ${whatsappPanel(job)}
        ${timeline}
        ${chatPanel}
      </div>
    </div>`;
}

function optionsPanel(job, mode) {
  const selected = job.options.find((o) => o.id === job.selectedOptionId) || null;
  const showChoose = mode === "customer" && job.status === "Options Ready" && !selected;
  if (!job.options.length && mode === "customer") return "";

  const cards = `
    <div class="option-grid">
      ${job.options.map((o) => `
        <div class="option-card ${o.recommended ? "recommended" : ""} ${o.id === job.selectedOptionId ? "selected" : ""}">
          ${o.recommended ? `<span class="ribbon">⭐ Recommended</span>` : ""}
          <h4 style="margin:0">${esc(o.label)}</h4>
          <span class="price">${aed(o.cost)}</span>
          <dl>
            <dt>Time</dt><dd>${esc(o.timeText)}</dd>
            <dt>Warranty</dt><dd>${esc(o.warranty)}</dd>
            <dt>Garage</dt><dd>${esc(o.garageId ? profileName(o.garageId) : "MTS network")}</dd>
            ${o.note ? `<dt>Note</dt><dd>${esc(o.note)}</dd>` : ""}
          </dl>
          ${showChoose ? `<button class="accent" data-action="choose-option" data-job="${esc(job.id)}" data-option="${esc(o.id)}">Choose this option</button>` : ""}
          ${o.id === job.selectedOptionId ? `<span class="pill ok">✔ Approved by customer</span>` : ""}
          ${mode === "admin" && !job.selectedOptionId ? `<button class="danger" data-action="remove-option" data-job="${esc(job.id)}" data-option="${esc(o.id)}">Remove</button>` : ""}
        </div>`).join("")}
    </div>`;

  if (mode === "customer") {
    return `
      <div class="panel">
        <div class="section-head" style="margin-bottom:8px">
          <h3 style="margin-bottom:0">${showChoose ? "Your options - compare and approve" : "Approved solution"}</h3>
          <button data-action="print-quote" data-job="${esc(job.id)}">🖨️ Quotation</button>
        </div>
        <p class="small">Prices are final MTS-negotiated prices including parts, labour and coordination.</p>
        ${cards}
      </div>`;
  }

  const quotedGarages = job.dispatches.filter((d) => d.quote);
  return `
    <div class="panel">
      <div class="section-head" style="margin-bottom:8px">
        <h3 style="margin-bottom:0">Solution Options (sent to customer)</h3>
        ${job.options.length ? `<button data-action="print-quote" data-job="${esc(job.id)}">🖨️ Quotation</button>` : ""}
      </div>
      ${job.options.length ? cards : `<p class="small">No options built yet. Use garage quotes + part offers below to build 2-3 transparent options.</p>`}
      ${!job.selectedOptionId ? `
      <form data-form="add-option" data-job="${esc(job.id)}" autocomplete="off" style="margin-top:14px" class="compact-form">
        <h4>Build option</h4>
        <div class="form-grid-3">
          <label>Type<select name="label">${PART_TYPES.map((t) => `<option>${esc(t)}</option>`).join("")}</select></label>
          <label>Customer price (AED)<input name="cost" type="number" min="0" step="1" required placeholder="1300"></label>
          <label>Time<input name="timeText" required placeholder="Same day / 2 days"></label>
          <label>Warranty<input name="warranty" required placeholder="6 months"></label>
          <label>Garage
            <select name="garageId"><option value="">MTS network</option>${quotedGarages.map((d) => `<option value="${esc(d.garageId)}">${esc(profileName(d.garageId))}</option>`).join("")}</select>
          </label>
          <label>Note<input name="note" placeholder="Best value / Best for long-term"></label>
        </div>
        <div class="toggle-grid" style="grid-template-columns:1fr"><label><input type="checkbox" name="recommended"> Mark as ⭐ Recommended</label></div>
        <div class="actions">
          <button type="submit" class="primary">Add Option</button>
          ${job.options.length && job.status !== "Options Ready" ? `<button type="button" class="accent" data-action="send-options" data-job="${esc(job.id)}">Send ${job.options.length} option(s) to customer</button>` : ""}
        </div>
      </form>` : ""}
    </div>`;
}

function reviewPanel(job) {
  const me = currentProfile();
  if (job.review) {
    return `
      <div class="panel">
        <h3>Customer Rating</h3>
        <div class="review-card">
          ${starsHtml(job.review.rating)} <strong>${job.review.rating}/5</strong>
          <p style="margin:6px 0 4px">${esc(job.review.comment || "")}</p>
          <span class="small">${esc(job.review.by)} - ${fmtTime(job.review.at)} - ${esc(profileName(job.assignedGarageId))}</span>
        </div>
      </div>`;
  }
  if (me.role !== "Customer" || job.status !== "Closed" || !job.assignedGarageId) return "";
  return `
    <div class="panel">
      <h3>Rate this job</h3>
      <p class="small">How was ${esc(profileName(job.assignedGarageId))}? Your rating helps MTS keep quality high.</p>
      <div class="rate-row" data-rate="${esc(job.id)}">
        ${[1, 2, 3, 4, 5].map((n) => `<span class="rstar ${n <= ratingDraft ? "on" : ""}" data-action="set-rating" data-value="${n}">★</span>`).join("")}
      </div>
      <form data-form="submit-review" data-job="${esc(job.id)}" style="margin-top:10px">
        <label>Comment<input name="comment" placeholder="Tell MTS how it went"></label>
        <div class="actions"><button type="submit" class="primary">Submit Rating</button></div>
      </form>
    </div>`;
}

function inspectionAdminPanel(job) {
  if (job.inspection) return inspectionDisplay(job, "admin");
  const garages = profilesByRole("Garage");
  return `
    <div class="panel">
      <h3>Inspection Report</h3>
      <p class="small">Fill the ${INSPECTION_AREAS.length}-point report, then send it to the customer.</p>
      <form data-form="save-inspection" data-job="${esc(job.id)}" autocomplete="off">
        <label>Inspected by
          <select name="garageId"><option value="">MTS Inspector</option>${garages.map((g) => `<option value="${esc(g.id)}" ${g.id === job.assignedGarageId ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select>
        </label>
        <div class="inspect-grid" style="margin-top:12px">
          ${INSPECTION_AREAS.map((area, i) => `
            <div class="inspect-row">
              <strong>${esc(area)}</strong>
              <select name="result-${i}">${RESULT_OPTIONS.map((r) => `<option ${r === "Pass" ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
              <input name="note-${i}" placeholder="Notes (optional)">
            </div>`).join("")}
        </div>
        <label style="margin-top:12px">Overall summary<textarea name="summary" rows="2" required placeholder="Overall condition of the vehicle"></textarea></label>
        <label>Recommendation<textarea name="recommendation" rows="2" placeholder="What the customer should do next"></textarea></label>
        <div class="actions"><button type="submit" class="primary">Save & Send Report</button></div>
      </form>
    </div>`;
}

function inspectionDisplay(job, mode) {
  const insp = job.inspection;
  const counts = { Pass: 0, Attention: 0, Fail: 0 };
  insp.items.forEach((it) => { counts[it.result] = (counts[it.result] || 0) + 1; });
  return `
    <div class="panel">
      <div class="section-head" style="margin-bottom:8px">
        <h3 style="margin-bottom:0">Inspection Report</h3>
        <button data-action="print-inspection" data-job="${esc(job.id)}">🖨️ Report</button>
      </div>
      <div class="meta" style="margin-top:0">
        <span class="pill ok">${counts.Pass} Pass</span>
        <span class="pill warn">${counts.Attention} Attention</span>
        <span class="pill danger">${counts.Fail} Fail</span>
        <span class="pill">By ${esc(insp.by)}</span>
      </div>
      <div class="inspect-grid" style="margin-top:12px">
        ${insp.items.map((it) => `
          <div class="inspect-row">
            <strong>${esc(it.area)}</strong>
            <span class="result-${it.result.toLowerCase()}">${esc(it.result)}</span>
            <span class="small">${esc(it.note || "")}</span>
          </div>`).join("")}
      </div>
      <p style="margin-top:12px"><strong>Summary:</strong> ${esc(insp.summary)}</p>
      ${insp.recommendation ? `<p><strong>Recommendation:</strong> ${esc(insp.recommendation)}</p>` : ""}
    </div>`;
}

function statusControlPanel(job) {
  const next = NEXT_STEP[job.status];
  const isFinal = ["Closed", "Cancelled"].includes(job.status);
  const dispatchable = ["MTS Review", "New Request"].includes(job.status);
  return `
    <div class="panel">
      <h3>Job Control</h3>
      <div class="actions">
        ${next ? `<button class="primary" data-action="advance-status" data-job="${esc(job.id)}">${esc(next[0])}</button>` : ""}
        ${job.status === "Ready For Delivery" && !job.invoice ? `<span class="pill warn">Generate the invoice below to finish</span>` : ""}
        ${!isFinal && job.status !== "Invoiced" ? `<button class="danger" data-action="cancel-job" data-job="${esc(job.id)}">Cancel Job</button>` : ""}
      </div>
      ${dispatchable && !isInspection(job) ? `<p class="small" style="margin-top:10px">Next: review the request, then dispatch quote requests to garages and parts suppliers below.</p>` : ""}
      ${dispatchable && isInspection(job) ? `<p class="small" style="margin-top:10px">Inspection job: assign a garage/inspector and fill the report below, then invoice.</p>` : ""}
    </div>`;
}

function dispatchPanel(job) {
  const garages = profilesByRole("Garage");
  const notYet = garages.filter((g) => !job.dispatches.some((d) => d.garageId === g.id));
  const canDispatch = jobIsOpen(job) && !job.selectedOptionId;
  return `
    <div class="panel">
      <h3>Garage Quotes</h3>
      ${job.dispatches.length ? `<div class="sync-list" style="margin-bottom:12px">
        ${job.dispatches.map((d) => `
          <div class="sync-item">
            <div class="section-head" style="margin-bottom:6px">
              <strong>${esc(profileName(d.garageId))} ${(() => { const r = garageRating(d.garageId); return r.count ? starsHtml(r.avg) : ""; })()}</strong>
              <span class="pill ${d.status === "Quoted" ? "ok" : d.status === "Declined" ? "danger" : "warn"}">${esc(d.status)}</span>
            </div>
            ${d.quote ? `<p style="margin-bottom:4px"><strong>${aed(d.quote.price)}</strong> - ${esc(d.quote.days)} - warranty: ${esc(d.quote.warranty)}</p><p class="small">${esc(d.quote.note || "")}</p>` : `<p class="small">Waiting for quote since ${fmtTime(d.at)}</p>`}
          </div>`).join("")}
      </div>` : `<p class="small">No quote requests sent yet.</p>`}
      ${canDispatch && notYet.length ? `
      <form data-form="dispatch-garages" data-job="${esc(job.id)}">
        <div class="toggle-grid">
          ${notYet.map((g) => `<label><input type="checkbox" name="garage" value="${esc(g.id)}"> ${esc(g.name)} <span class="small">(${esc(g.specialties || "")})</span></label>`).join("")}
        </div>
        <label style="margin-top:10px">Note to garages<input name="note" placeholder="Anything the garage should know"></label>
        <div class="actions"><button type="submit" class="primary">Send Quote Requests</button></div>
      </form>` : ""}
    </div>`;
}

function partsPanel(job, mode) {
  const canAsk = jobIsOpen(job) && !job.selectedOptionId;
  return `
    <div class="panel">
      <h3>Parts Sourcing</h3>
      ${job.partsRequests.length ? job.partsRequests.map((pr) => `
        <div class="sync-item" style="margin-bottom:10px">
          <strong>${esc(pr.partName)}</strong>
          ${pr.note ? `<p class="small">${esc(pr.note)}</p>` : ""}
          ${pr.offers.length ? `
            <table class="invoice-table" style="margin-top:8px">
              <tr><th>Supplier</th><th>Type</th><th>Availability</th><th>Warranty</th><th>Price</th></tr>
              ${pr.offers.map((o) => `<tr><td>${esc(profileName(o.supplierId))}</td><td>${esc(o.partType)}</td><td>${esc(o.availability)}</td><td>${esc(o.warranty)}</td><td>${aed(o.price)}</td></tr>`).join("")}
            </table>` : `<p class="small">No offers yet - suppliers see this request in their portal.</p>`}
        </div>`).join("") : `<p class="small">No parts requested yet.</p>`}
      ${mode === "admin" && canAsk ? `
      <form data-form="add-part-request" data-job="${esc(job.id)}" autocomplete="off">
        <div class="form-grid">
          <label>Part needed<input name="partName" required placeholder="AC compressor - Nissan Patrol 2019"></label>
          <label>Note to suppliers<input name="note" placeholder="OEM number, condition requirements..."></label>
        </div>
        <div class="actions"><button type="submit" class="primary">Broadcast to Suppliers</button></div>
      </form>` : ""}
    </div>`;
}

function adminInvoicePanel(job) {
  if (job.invoice) return "";
  const selected = job.options.find((o) => o.id === job.selectedOptionId);
  const readyInspection = isInspection(job) && job.inspection && job.status !== "Closed";
  if (!selected && !readyInspection) return "";
  const baseLabel = selected ? `${selected.label} - ${job.category}` : `${job.category} - inspection report`;
  const baseCost = selected ? selected.cost : 250;
  const garageTxt = selected ? (selected.garageId ? profileName(selected.garageId) : "MTS network") : (job.assignedGarageId ? profileName(job.assignedGarageId) : "MTS Inspector");
  return `
    <div class="panel">
      <h3>Generate Invoice</h3>
      <p class="small">${esc(baseLabel)} - ${aed(baseCost)} (${esc(garageTxt)})</p>
      <form data-form="generate-invoice" data-job="${esc(job.id)}" autocomplete="off">
        <div class="form-grid-3">
          <label>Base amount (AED)<input name="base" type="number" min="0" step="1" value="${baseCost}"></label>
          <label>MTS Concierge fee (AED)<input name="fee" type="number" min="0" step="1" value="50"></label>
          <label>Extra amount (AED)<input name="extraAmount" type="number" min="0" step="1" placeholder="0"></label>
        </div>
        <label>Extra line label (optional)<input name="extraLabel" placeholder="Towing, consumables..."></label>
        <div class="actions"><button type="submit" class="primary">Create Invoice</button></div>
      </form>
    </div>`;
}

function whatsappPanel(job) {
  const cust = profileById(job.customerId);
  const v = jobVehicle(job);
  const last = job.timeline[job.timeline.length - 1];
  const msg = [
    "*MTS Auto Concierge update*",
    `Job ${job.id} - ${vehicleLabel(v)}`,
    `Status: ${job.status}`,
    last ? `Latest: ${last.text}` : "",
    "Questions? Just reply here - we handle everything."
  ].filter(Boolean).join("\n");
  return `
    <div class="panel">
      <h3>WhatsApp Update</h3>
      <p class="alert-message small">${esc(msg)}</p>
      <div class="actions">
        <a href="${waLink(cust ? cust.phone : "", msg)}" target="_blank" rel="noopener"><button class="primary">Send via WhatsApp</button></a>
      </div>
    </div>`;
}

function recoveryStatusPanel(job, mode) {
  const r = job.recovery;
  return `
    <div class="panel">
      <h3>🚨 Recovery</h3>
      <div class="meta" style="margin-top:0">
        <span class="pill ${r.status === "Delivered To Garage" ? "ok" : "warn"}">${esc(r.status)}</span>
        ${r.companyId ? `<span class="pill blue">${esc(profileName(r.companyId))}</span>` : ""}
      </div>
      ${r.companyId && mode === "customer" ? `<p class="small" style="margin-top:8px">Driver contact: ${esc((profileById(r.companyId) || {}).phone || "")}</p>` : ""}
    </div>`;
}

function recoveryAdminPanel(job) {
  const r = job.recovery;
  const companies = profilesByRole("Recovery");
  return `
    <div class="panel">
      <h3>Recovery Dispatch</h3>
      <div class="meta" style="margin-top:0;margin-bottom:10px">
        <span class="pill ${r.status === "Delivered To Garage" ? "ok" : "warn"}">${esc(r.status)}</span>
        ${r.companyId ? `<span class="pill blue">${esc(profileName(r.companyId))}</span>` : ""}
      </div>
      ${!r.companyId ? `
      <form data-form="assign-recovery" data-job="${esc(job.id)}">
        <div class="form-grid">
          <label>Recovery company<select name="companyId">${companies.map((c) => `<option value="${esc(c.id)}">${esc(c.name)} (${esc(c.area || "")})</option>`).join("")}</select></label>
          <label>Deliver vehicle to
            <select name="garageId"><option value="">Decide later</option>${profilesByRole("Garage").map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join("")}</select>
          </label>
        </div>
        <div class="actions"><button type="submit" class="primary">Dispatch Recovery</button></div>
      </form>` : ""}
    </div>`;
}

/* ---------- admin views ---------- */

function renderAdminDashboard() {
  const open = state.jobs.filter(jobIsOpen);
  const count = (fn) => state.jobs.filter(fn).length;
  const inbox = open.slice().sort((a, b) => {
    const rank = (j) => (j.urgent && j.status === "New Request") ? 0 : j.status === "New Request" ? 1 : j.status === "Sourcing Quotes" ? 2 : 3;
    return rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt);
  });
  const paidRevenue = state.jobs.filter((j) => j.invoice && j.invoice.status === "Paid").reduce((s, j) => s + j.invoice.total, 0);
  return `
    <div class="section-head">
      <div><h2>Concierge Dashboard</h2><p>Understand the problem. Find the best solution. Negotiate the best price. Coordinate everything.</p></div>
      <button class="danger" data-action="reset-demo">Reset demo data</button>
    </div>
    <div class="quick-stats">
      <div class="stat"><strong>${count((j) => j.status === "New Request")}</strong><span>New requests</span></div>
      <div class="stat"><strong>${count((j) => j.status === "Sourcing Quotes" || j.status === "MTS Review")}</strong><span>Sourcing / review</span></div>
      <div class="stat"><strong>${count((j) => j.status === "Options Ready")}</strong><span>Waiting customer</span></div>
      <div class="stat"><strong>${count((j) => WORKSHOP_STATUSES.includes(j.status))}</strong><span>In workshop</span></div>
      <div class="stat"><strong>${count((j) => j.status === "Ready For Delivery")}</strong><span>Ready for delivery</span></div>
      <div class="stat"><strong>${aed(paidRevenue)}</strong><span>Collected revenue</span></div>
    </div>
    <h3>Inbox - needs MTS action first</h3>
    <div class="job-list">
      ${inbox.length ? inbox.map((j) => jobCard(j, "admin")).join("") : emptyState("All clear", "No open jobs right now.")}
    </div>`;
}

function renderAdminJobs() {
  const filters = ["All", "New Request", "Sourcing Quotes", "Options Ready", "In Workshop", "Ready For Delivery", "Invoiced", "Closed", "Cancelled"];
  const f = state.adminFilter;
  const q = (state.adminSearch || "").toLowerCase();
  const match = (j) => {
    const statusOk = f === "All" ? true
      : f === "In Workshop" ? WORKSHOP_STATUSES.includes(j.status)
      : f === "Sourcing Quotes" ? (j.status === "Sourcing Quotes" || j.status === "MTS Review")
      : j.status === f;
    if (!statusOk) return false;
    if (!q) return true;
    const hay = `${j.id} ${vehicleLabel(jobVehicle(j))} ${profileName(j.customerId)} ${j.category} ${j.description}`.toLowerCase();
    return hay.includes(q);
  };
  const jobs = state.jobs.filter(match).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return `
    <div class="section-head">
      <div><h2>All Jobs</h2><p>Every customer, garage, supplier and recovery interaction in one pipeline.</p></div>
    </div>
    <div class="panel" style="padding:12px">
      <input data-input="admin-search" placeholder="Search job ID, customer, vehicle, problem..." value="${esc(state.adminSearch || "")}">
    </div>
    <div class="filters">
      ${filters.map((x) => `<button class="${x === f ? "active" : ""}" data-action="set-admin-filter" data-value="${esc(x)}">${esc(x)}</button>`).join("")}
    </div>
    <div class="job-list">
      ${jobs.length ? jobs.map((j) => jobCard(j, "admin")).join("") : emptyState("Nothing here", "No jobs match this filter or search.")}
    </div>`;
}

function renderAdminPartners() {
  const sections = [["Garages", "Garage"], ["Parts Suppliers", "Parts Supplier"], ["Recovery Companies", "Recovery"]];
  return `
    <div class="section-head">
      <div><h2>Partner Network</h2><p>The real value of MTS: trusted garages, parts suppliers, used parts dealers and recovery companies.</p></div>
    </div>
    <form class="panel" data-form="add-partner" autocomplete="off">
      <h3>Add Partner</h3>
      <div class="form-grid-3">
        <label>Name<input name="name" required placeholder="Garage / supplier name"></label>
        <label>Type<select name="role"><option>Garage</option><option>Parts Supplier</option><option>Recovery</option></select></label>
        <label>Phone<input name="phone" required placeholder="+9715xxxxxxxx"></label>
        <label>Area<input name="area" placeholder="Al Quoz, Deira..."></label>
        <label>Specialties<input name="specialties" placeholder="AC, engines, German cars, used OEM..."></label>
      </div>
      <div class="actions"><button type="submit" class="primary">Add to Network</button></div>
    </form>
    ${sections.map(([title, role]) => {
      const people = profilesByRole(role);
      return `
        <h3>${esc(title)} (${people.length})</h3>
        <div class="team-grid" style="margin-bottom:16px">
          ${people.length ? people.map((p) => {
            const st = partnerStats(p);
            const statLine = role === "Garage"
              ? `<dt>Rating</dt><dd>${st.rating.count ? `${starsHtml(st.rating.avg)} ${st.rating.avg.toFixed(1)} (${st.rating.count})` : "No ratings yet"}</dd><dt>Jobs done</dt><dd>${st.jobs}</dd><dt>Quotes</dt><dd>${st.quotes}</dd>`
              : role === "Parts Supplier" ? `<dt>Offers</dt><dd>${st.offers}</dd>`
              : `<dt>Tow jobs</dt><dd>${st.tows}</dd>`;
            return `
            <div class="person-card">
              <h3>${esc(p.name)}</h3>
              <dl>
                <dt>Phone</dt><dd>${esc(p.phone)}</dd>
                ${p.area ? `<dt>Area</dt><dd>${esc(p.area)}</dd>` : ""}
                ${p.specialties ? `<dt>Focus</dt><dd>${esc(p.specialties)}</dd>` : ""}
                ${statLine}
              </dl>
            </div>`;
          }).join("") : emptyState("None yet", "Add partners to grow the network.")}
        </div>`;
    }).join("")}`;
}

function renderAdminChats() {
  const customers = profilesByRole("Customer");
  const active = state.activeThreadId && customers.some((c) => c.id === state.activeThreadId) ? state.activeThreadId : (customers[0] ? customers[0].id : null);
  state.activeThreadId = active;
  const msgs = active ? (state.threads[active] || []) : [];
  return `
    <div class="section-head">
      <div><h2>Customer Chats</h2><p>"I don't need to search for a garage. I call MTS."</p></div>
    </div>
    <div class="job-layout">
      <div class="stack">
        ${customers.map((c) => {
          const th = state.threads[c.id] || [];
          const lastMsg = th[th.length - 1];
          return `
            <div class="thread-item ${c.id === active ? "active" : ""}" data-action="open-thread" data-customer="${esc(c.id)}">
              <strong>${esc(c.name)}</strong>
              <p class="small" style="margin:4px 0 0">${lastMsg ? esc(lastMsg.text).slice(0, 70) : "No messages yet"}</p>
            </div>`;
        }).join("")}
      </div>
      <div class="stack">
        <div class="panel">
          <h3>${esc(active ? profileName(active) : "No customer")}</h3>
          ${threadBox(msgs, "owner")}
          ${active ? `
          <form class="chat-form" data-form="thread-send" data-customer="${esc(active)}">
            <input name="text" required placeholder="Reply as MTS Concierge...">
            <button type="submit" class="primary">Send</button>
          </form>` : ""}
        </div>
      </div>
    </div>`;
}

function renderAdminActivity() {
  return `
    <div class="section-head">
      <div><h2>Activity Feed</h2><p>Everything that moves in the marketplace, newest first.</p></div>
    </div>
    <div class="sync-list">
      ${state.activity.length ? state.activity.map((a) => `
        <div class="sync-item"><p style="margin-bottom:4px">${esc(a.text)}</p><span class="small">${fmtTime(a.at)}</span></div>`).join("") : emptyState("No activity", "Actions appear here as they happen.")}
    </div>`;
}

/* ---------- garage views ---------- */

function renderGarageRequests() {
  const me = currentProfile();
  const pending = [];
  state.jobs.forEach((job) => {
    job.dispatches.forEach((d, idx) => {
      if (d.garageId === me.id && d.status === "Awaiting Quote" && jobIsOpen(job)) pending.push({ job, d, idx });
    });
  });
  return `
    <div class="section-head">
      <div><h2>Quote Requests from MTS</h2><p>Reply fast with your best price - MTS sends you steady work, no marketing needed.</p></div>
    </div>
    <div class="job-list">
      ${pending.length ? pending.map(({ job, d, idx }) => {
        const v = jobVehicle(job);
        return `
        <div class="panel" style="margin-bottom:0">
          <div class="section-head" style="margin-bottom:8px">
            <div>
              <h3 style="margin-bottom:4px">${esc(job.id)} - ${esc(vehicleLabel(v))}</h3>
              <div class="meta" style="margin-top:0">
                <span class="pill">${esc(job.category)}</span>
                ${job.urgent ? `<span class="pill danger">URGENT</span>` : ""}
                <span class="pill blue">${esc(job.location)}</span>
              </div>
            </div>
            <span class="small">${fmtTime(d.at)}</span>
          </div>
          <p>${esc(job.description)}</p>
          ${d.note ? `<p class="small">MTS note: ${esc(d.note)}</p>` : ""}
          ${job.media.length ? `<div class="chip-list">${job.media.map((m) => `<span class="pill">📎 ${esc(m)}</span>`).join("")}</div>` : ""}
          <form data-form="garage-quote" data-job="${esc(job.id)}" data-dispatch="${idx}" autocomplete="off" style="margin-top:12px">
            <div class="form-grid-3">
              <label>Price (AED)<input name="price" type="number" min="0" step="1" required placeholder="850"></label>
              <label>Time needed<input name="days" required placeholder="Same day / 2 days"></label>
              <label>Warranty<input name="warranty" required placeholder="3 months on labour"></label>
            </div>
            <label>Notes<input name="note" placeholder="What is included, parts assumptions..."></label>
            <div class="actions">
              <button type="submit" class="primary">Send Quote to MTS</button>
              <button type="button" class="danger" data-action="decline-dispatch" data-job="${esc(job.id)}" data-dispatch="${idx}">Decline</button>
            </div>
          </form>
        </div>`;
      }).join("") : emptyState("No open quote requests", "MTS dispatches jobs matching your specialties. Check back soon.")}
    </div>`;
}

function renderGarageActive() {
  const me = currentProfile();
  const mine = state.jobs.filter((j) => j.assignedGarageId === me.id && ["Approved", "Vehicle In Garage", "In Repair", "Quality Check", "Ready For Delivery"].includes(j.status));
  return `
    <div class="section-head">
      <div><h2>My Active Jobs</h2><p>Vehicles approved by customers and assigned to your workshop by MTS.</p></div>
    </div>
    <div class="job-list">
      ${mine.length ? mine.map((job) => {
        const v = jobVehicle(job);
        const opt = job.options.find((o) => o.id === job.selectedOptionId);
        const next = NEXT_STEP[job.status];
        return `
        <div class="panel" style="margin-bottom:0">
          <div class="section-head" style="margin-bottom:8px">
            <div>
              <h3 style="margin-bottom:4px">${esc(job.id)} - ${esc(vehicleLabel(v))}</h3>
              <div class="meta" style="margin-top:0">
                <span class="pill ${statusPillClass(job.status)}">${esc(job.status)}</span>
                <span class="pill">${esc(job.category)}</span>
                ${opt ? `<span class="pill accent">${esc(opt.label)} - ${aed(opt.cost)}</span>` : ""}
              </div>
            </div>
          </div>
          <p>${esc(job.description)}</p>
          <div class="actions">
            ${next && job.status !== "New Request" ? `<button class="primary" data-action="advance-status" data-job="${esc(job.id)}">${esc(next[0])}</button>` : ""}
            ${job.status === "Ready For Delivery" ? `<span class="pill ok">Waiting for MTS delivery + invoice</span>` : ""}
          </div>
        </div>`;
      }).join("") : emptyState("No active jobs", "Approved jobs assigned to your garage appear here.")}
    </div>`;
}

/* ---------- supplier view ---------- */

function renderSupplierRequests() {
  const me = currentProfile();
  const open = [];
  state.jobs.forEach((job) => {
    if (!jobIsOpen(job) || job.selectedOptionId) return;
    job.partsRequests.forEach((pr) => open.push({ job, pr }));
  });
  return `
    <div class="section-head">
      <div><h2>Parts Requests from MTS</h2><p>Quote genuine new, aftermarket or used OEM - MTS buys from whoever gives the customer the best deal.</p></div>
    </div>
    <div class="job-list">
      ${open.length ? open.map(({ job, pr }) => {
        const v = jobVehicle(job);
        const myOffers = pr.offers.filter((o) => o.supplierId === me.id);
        return `
        <div class="panel" style="margin-bottom:0">
          <div class="section-head" style="margin-bottom:8px">
            <div>
              <h3 style="margin-bottom:4px">${esc(pr.partName)}</h3>
              <div class="meta" style="margin-top:0">
                <span class="pill blue">${esc(job.id)}</span>
                <span class="pill">${esc(vehicleLabel(v))}</span>
                ${job.urgent ? `<span class="pill danger">URGENT</span>` : ""}
              </div>
            </div>
          </div>
          ${pr.note ? `<p class="small">MTS note: ${esc(pr.note)}</p>` : ""}
          ${myOffers.length ? `<p class="small">Your offers: ${myOffers.map((o) => `${esc(o.partType)} ${aed(o.price)}`).join(" | ")}</p>` : ""}
          <form data-form="supplier-offer" data-job="${esc(job.id)}" data-part="${esc(pr.id)}" autocomplete="off" style="margin-top:10px">
            <div class="form-grid-3">
              <label>Part type<select name="partType">${OFFER_TYPES.map((t) => `<option>${esc(t)}</option>`).join("")}</select></label>
              <label>Price (AED)<input name="price" type="number" min="0" step="1" required placeholder="650"></label>
              <label>Availability<input name="availability" required placeholder="In stock - same day"></label>
            </div>
            <div class="form-grid">
              <label>Warranty<input name="warranty" required placeholder="30 days / 6 months / 12 months"></label>
              <label>Note<input name="note" placeholder="Brand, condition, source vehicle..."></label>
            </div>
            <div class="actions"><button type="submit" class="primary">Send Offer to MTS</button></div>
          </form>
        </div>`;
      }).join("") : emptyState("No open parts requests", "MTS broadcasts part requests here when customers need repairs or used parts.")}
    </div>`;
}

/* ---------- recovery view ---------- */

function renderRecoveryJobs() {
  const me = currentProfile();
  const mine = state.jobs.filter((j) => j.recovery && j.recovery.companyId === me.id && jobIsOpen(j));
  return `
    <div class="section-head">
      <div><h2>Tow Jobs from MTS</h2><p>Emergency breakdowns and towing dispatched by the MTS concierge desk.</p></div>
    </div>
    <div class="job-list">
      ${mine.length ? mine.map((job) => {
        const v = jobVehicle(job);
        const cust = profileById(job.customerId);
        const r = job.recovery;
        const idx = RECOVERY_FLOW.indexOf(r.status);
        const nextStatus = idx >= 0 && idx < RECOVERY_FLOW.length - 1 ? RECOVERY_FLOW[idx + 1] : null;
        return `
        <div class="panel" style="margin-bottom:0">
          <div class="section-head" style="margin-bottom:8px">
            <div>
              <h3 style="margin-bottom:4px">${esc(job.id)} - ${esc(vehicleLabel(v))}</h3>
              <div class="meta" style="margin-top:0">
                <span class="pill ${r.status === "Delivered To Garage" ? "ok" : "warn"}">${esc(r.status)}</span>
                ${job.urgent ? `<span class="pill danger">URGENT</span>` : ""}
              </div>
            </div>
          </div>
          <p>${esc(job.description)}</p>
          <p><strong>Pickup:</strong> ${esc(job.location)}</p>
          ${r.dropGarageId ? `<p><strong>Deliver to:</strong> ${esc(profileName(r.dropGarageId))}</p>` : ""}
          <p class="small">Customer: ${esc(cust ? cust.name : "")} - ${esc(cust ? cust.phone : "")}</p>
          <div class="actions">
            ${nextStatus ? `<button class="primary" data-action="advance-recovery" data-job="${esc(job.id)}">Mark: ${esc(nextStatus)}</button>` : `<span class="pill ok">Done - MTS takes over</span>`}
            ${cust ? `<a href="${waLink(cust.phone, `Falcon Recovery here for your ${vehicleLabel(v)} - job ${job.id}. On the way.`)}" target="_blank" rel="noopener"><button>WhatsApp Customer</button></a>` : ""}
          </div>
        </div>`;
      }).join("") : emptyState("No tow jobs assigned", "MTS assigns emergency and towing jobs to you here.")}
    </div>`;
}

/* ---------- printable documents ---------- */

function docHeader(kind) {
  return `
    <div class="doc-header">
      <div class="brand-block">
        <strong>MTS Auto Concierge</strong>
        <span>Mendonca Technical Services</span>
        <span>Dubai, UAE - +971 50 111 2223</span>
      </div>
      <div class="doc-title"><h2>${esc(kind)}</h2></div>
    </div>`;
}

function docMeta(job) {
  const v = jobVehicle(job);
  const cust = profileById(job.customerId);
  return `
    <div class="doc-meta">
      <div><span>Job Ref</span><strong>${esc(job.id)}</strong></div>
      <div><span>Date</span><strong>${fmtDate(nowIso())}</strong></div>
      <div><span>Customer</span><strong>${esc(cust ? cust.name : "")}</strong></div>
      <div><span>Phone</span><strong>${esc(cust ? cust.phone : "")}</strong></div>
      <div><span>Vehicle</span><strong>${esc(vehicleLabel(v))}</strong></div>
      <div><span>Plate</span><strong>${esc(v ? v.plate : "")}</strong></div>
    </div>`;
}

function buildQuotationDoc(job) {
  const rows = job.options.map((o) => `
    <tr>
      <td>${esc(o.label)}${o.recommended ? ` <span class="recommend-tag">⭐ Recommended</span>` : ""}${o.note ? `<br><span style="color:#5e6d76;font-size:12px">${esc(o.note)}</span>` : ""}</td>
      <td>${esc(o.timeText)}</td>
      <td>${esc(o.warranty)}</td>
      <td>${aed(o.cost)}</td>
    </tr>`).join("");
  return docHeader("QUOTATION") + docMeta(job) + `
    <h4 class="doc-section">Reported problem</h4>
    <p>${esc(job.description)}</p>
    <h4 class="doc-section">Options prepared for you</h4>
    <table class="invoice-table">
      <tr><th>Option</th><th>Time</th><th>Warranty</th><th>Price</th></tr>
      ${rows}
    </table>
    <div class="doc-note">All prices are final MTS-negotiated prices including parts, labour and full coordination. MTS manages the garage, the parts and the whole job for you - one point of contact.</div>
    <div class="doc-footer">Thank you for choosing MTS Auto Concierge. This quotation is valid for 7 days.</div>`;
}

function buildInvoiceDoc(job) {
  const inv = job.invoice;
  return docHeader("INVOICE") + docMeta(job) + `
    <h4 class="doc-section">Invoice ${esc(inv.id)} - ${esc(inv.status)}</h4>
    <table class="invoice-table">
      <tr><th>Description</th><th>Amount</th></tr>
      ${inv.lines.map((l) => `<tr><td>${esc(l.label)}</td><td>${aed(l.amount)}</td></tr>`).join("")}
      <tr class="total"><td>Total</td><td>${aed(inv.total)}</td></tr>
    </table>
    <div class="doc-note">Payment: cash / card / bank transfer to Mendonca Technical Services. Issued ${fmtDate(inv.at)}.</div>
    <div class="doc-footer">Thank you for your business. MTS Auto Concierge - your car problem solved.</div>`;
}

function buildInspectionDoc(job) {
  const insp = job.inspection;
  const rows = insp.items.map((it) => `
    <tr>
      <td>${esc(it.area)}</td>
      <td class="result-${it.result.toLowerCase()}">${esc(it.result)}</td>
      <td>${esc(it.note || "-")}</td>
    </tr>`).join("");
  return docHeader("INSPECTION REPORT") + docMeta(job) + `
    <h4 class="doc-section">${esc(job.category)} - inspected by ${esc(insp.by)}</h4>
    <table class="invoice-table">
      <tr><th>Area</th><th>Result</th><th>Notes</th></tr>
      ${rows}
    </table>
    <h4 class="doc-section">Summary</h4>
    <p>${esc(insp.summary)}</p>
    ${insp.recommendation ? `<h4 class="doc-section">Recommendation</h4><p>${esc(insp.recommendation)}</p>` : ""}
    <div class="doc-footer">MTS Auto Concierge inspection - completed ${fmtDate(insp.at)}.</div>`;
}

function openDoc(title, html) {
  lastDoc = { title, html };
  modalTitle.textContent = title;
  printDoc.innerHTML = html;
  modalRoot.classList.remove("hidden");
}

function closeModal() {
  modalRoot.classList.add("hidden");
  printDoc.innerHTML = "";
}

/* ---------- actions ---------- */

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  const me = currentProfile();

  if (["open-job", "print-quote", "print-invoice", "print-inspection"].includes(action)) e.preventDefault();

  if (action === "pick-portal") {
    const group = el.dataset.group;
    let target = null;
    if (group === "Customer") target = profilesByRole("Customer")[0];
    else if (group === "MTS Admin") target = profilesByRole("MTS Admin")[0];
    else if (group === "Vendor") target = profilesByRole("Garage")[0];
    if (!target) return;
    state.activeProfileId = target.id;
    state.showWelcome = false;
    state.activeView = ROLE_TABS[target.role][0][0];
    draft = null;
    render();
  } else if (action === "show-welcome") {
    state.showWelcome = true;
    draft = null;
    render();
  } else if (action === "switch-view") {
    draft = null;
    state.activeView = el.dataset.view;
    render();
  } else if (action === "start-request") {
    const type = el.dataset.type;
    draft = { step: type ? 1 : 0, type: type || "", vehicleId: null, category: "", partName: "", description: "", location: "", media: [] };
    state.activeView = "jobs";
    render();
  } else if (action === "compare-quotes") {
    state.customerFilter = "Waiting My Approval";
    state.activeView = "jobs";
    render();
  } else if (action === "wizard-pick-type") {
    draft.type = el.dataset.value; draft.step = 1; render();
  } else if (action === "wizard-pick-vehicle") {
    draft.vehicleId = el.dataset.id;
    draft.step = (draft.type === "Emergency Breakdown" || draft.type === "Towing") ? 3 : 2;
    render();
  } else if (action === "wizard-pick-category") {
    draft.category = el.dataset.value; draft.step = 3; render();
  } else if (action === "wizard-back") {
    const quick = draft.type === "Emergency Breakdown" || draft.type === "Towing";
    if (draft.step === 3 && quick) draft.step = 1;
    else draft.step = Math.max(0, draft.step - 1);
    render();
  } else if (action === "wizard-cancel") {
    draft = null; state.activeView = "home"; render();
  } else if (action === "wizard-gps") {
    const input = document.querySelector('form[data-form="wizard-details"] input[name="location"]');
    if (!navigator.geolocation || !input) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { input.value = `GPS ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`; },
      () => { input.placeholder = "GPS unavailable - type the location"; }
    );
  } else if (action === "open-job") {
    state.selectedJobId = el.dataset.id;
    ratingDraft = 0;
    state.activeView = "jobdetail";
    if (state.showWelcome) state.showWelcome = false;
    render();
  } else if (action === "back-to-jobs") {
    state.activeView = "jobs"; render();
  } else if (action === "set-admin-filter") {
    state.adminFilter = el.dataset.value; render();
  } else if (action === "set-customer-filter") {
    state.customerFilter = el.dataset.value; render();
  } else if (action === "choose-option") {
    const job = jobById(el.dataset.job);
    const opt = job && job.options.find((o) => o.id === el.dataset.option);
    if (!job || !opt) return;
    job.selectedOptionId = opt.id;
    job.status = "Approved";
    if (opt.garageId) job.assignedGarageId = opt.garageId;
    addTimeline(job, `Customer approved ${opt.label} - ${aed(opt.cost)}`, me.name);
    pushChat(job, "owner", `Great choice! ${opt.label} at ${aed(opt.cost)} is confirmed. ${opt.garageId ? profileName(opt.garageId) : "Our garage"} will take it from here - we coordinate everything.`);
    render();
  } else if (action === "remove-option") {
    const job = jobById(el.dataset.job);
    if (!job) return;
    job.options = job.options.filter((o) => o.id !== el.dataset.option);
    render();
  } else if (action === "send-options") {
    const job = jobById(el.dataset.job);
    if (!job || !job.options.length) return;
    job.status = "Options Ready";
    addTimeline(job, `${job.options.length} option(s) sent to customer for approval`, me.name);
    pushChat(job, "owner", `Your options are ready - compare cost, time and warranty in My Jobs and choose what suits you best.`);
    render();
  } else if (action === "cancel-job") {
    const job = jobById(el.dataset.job);
    if (!job || !confirm(`Cancel job ${job.id}?`)) return;
    job.status = "Cancelled";
    addTimeline(job, "Job cancelled", me.name);
    render();
  } else if (action === "advance-status") {
    const job = jobById(el.dataset.job);
    const next = job && NEXT_STEP[job.status];
    if (!job || !next) return;
    job.status = next[1];
    addTimeline(job, next[1] === "MTS Review" ? "MTS review started" :
      next[1] === "Vehicle In Garage" ? `Vehicle received at ${job.assignedGarageId ? profileName(job.assignedGarageId) : "garage"}` :
      next[1] === "In Repair" ? "Repair started" :
      next[1] === "Quality Check" ? "Repair complete - quality check in progress" :
      "Vehicle ready for delivery", me.name);
    render();
  } else if (action === "advance-recovery") {
    const job = jobById(el.dataset.job);
    if (!job || !job.recovery) return;
    const idx = RECOVERY_FLOW.indexOf(job.recovery.status);
    if (idx < 0 || idx >= RECOVERY_FLOW.length - 1) return;
    job.recovery.status = RECOVERY_FLOW[idx + 1];
    addTimeline(job, `Recovery: ${job.recovery.status}`, me.name);
    render();
  } else if (action === "decline-dispatch") {
    const job = jobById(el.dataset.job);
    const d = job && job.dispatches[Number(el.dataset.dispatch)];
    if (!job || !d) return;
    d.status = "Declined";
    addTimeline(job, `${profileName(d.garageId)} declined the quote request`, profileName(d.garageId));
    render();
  } else if (action === "open-thread") {
    state.activeThreadId = el.dataset.customer; render();
  } else if (action === "mark-paid") {
    const job = jobById(el.dataset.job);
    if (!job || !job.invoice) return;
    job.invoice.status = "Paid";
    job.status = "Closed";
    addTimeline(job, "Invoice paid. Job closed.", me.name);
    render();
  } else if (action === "set-rating") {
    ratingDraft = Number(el.dataset.value);
    const row = el.closest(".rate-row");
    if (row) row.querySelectorAll(".rstar").forEach((s, i) => s.classList.toggle("on", i < ratingDraft));
  } else if (action === "print-quote") {
    const job = jobById(el.dataset.job);
    if (job) openDoc(`Quotation - ${job.id}`, buildQuotationDoc(job));
  } else if (action === "print-invoice") {
    const job = jobById(el.dataset.job);
    if (job && job.invoice) openDoc(`Invoice ${job.invoice.id}`, buildInvoiceDoc(job));
  } else if (action === "print-inspection") {
    const job = jobById(el.dataset.job);
    if (job && job.inspection) openDoc(`Inspection Report - ${job.id}`, buildInspectionDoc(job));
  } else if (action === "print-doc") {
    window.print();
  } else if (action === "close-modal") {
    closeModal();
  } else if (action === "modal-backdrop") {
    if (e.target === modalRoot) closeModal();
  } else if (action === "reset-demo") {
    if (!confirm("Reset all demo data back to the seed state?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = JSON.parse(JSON.stringify(seedState));
    draft = null;
    render();
  }
});

document.addEventListener("submit", (e) => {
  const form = e.target.closest("form[data-form]");
  if (!form) return;
  e.preventDefault();
  const kind = form.dataset.form;
  const me = currentProfile();

  if (kind === "add-vehicle") {
    state.vehicles.push({
      id: `veh-${Date.now().toString(36)}`, customerId: me.id,
      make: form.make.value.trim(), model: form.model.value.trim(), year: form.year.value.trim(),
      engine: form.engine.value.trim(), vin: form.vin.value.trim(), plate: form.plate.value.trim(), mileage: form.mileage.value.trim()
    });
    addActivity(`${me.name} registered vehicle ${form.make.value.trim()} ${form.model.value.trim()}`);
    render();
  } else if (kind === "wizard-details") {
    createJobFromDraft(form); render();
  } else if (kind === "garage-quote") {
    const job = jobById(form.dataset.job);
    const d = job && job.dispatches[Number(form.dataset.dispatch)];
    if (!job || !d) return;
    d.quote = { price: Number(form.price.value), days: form.days.value.trim(), warranty: form.warranty.value.trim(), note: form.note.value.trim(), at: nowIso() };
    d.status = "Quoted";
    addTimeline(job, `${profileName(d.garageId)} quoted ${aed(d.quote.price)} (${d.quote.days}, ${d.quote.warranty})`, profileName(d.garageId));
    render();
  } else if (kind === "supplier-offer") {
    const job = jobById(form.dataset.job);
    const pr = job && job.partsRequests.find((p) => p.id === form.dataset.part);
    if (!job || !pr) return;
    pr.offers.push({
      supplierId: me.id, partType: form.partType.value, price: Number(form.price.value),
      availability: form.availability.value.trim(), warranty: form.warranty.value.trim(), note: form.note.value.trim(), at: nowIso()
    });
    addTimeline(job, `${me.name} offered ${form.partType.value} at ${aed(form.price.value)} for "${pr.partName}"`, me.name);
    render();
  } else if (kind === "dispatch-garages") {
    const job = jobById(form.dataset.job);
    if (!job) return;
    const picked = Array.from(form.querySelectorAll('input[name="garage"]:checked')).map((i) => i.value);
    if (!picked.length) return;
    const note = form.note.value.trim();
    picked.forEach((gid) => job.dispatches.push({ garageId: gid, status: "Awaiting Quote", note, at: nowIso(), quote: null }));
    if (["New Request", "MTS Review"].includes(job.status)) job.status = "Sourcing Quotes";
    addTimeline(job, `Quote requests sent to ${picked.map(profileName).join(", ")}`, me.name);
    render();
  } else if (kind === "add-part-request") {
    const job = jobById(form.dataset.job);
    if (!job) return;
    job.partsRequests.push({ id: `PRT-${Date.now().toString(36)}`, partName: form.partName.value.trim(), note: form.note.value.trim(), offers: [] });
    if (["New Request", "MTS Review"].includes(job.status)) job.status = "Sourcing Quotes";
    addTimeline(job, `Part request broadcast to suppliers: ${form.partName.value.trim()}`, me.name);
    render();
  } else if (kind === "add-option") {
    const job = jobById(form.dataset.job);
    if (!job) return;
    job.options.push({
      id: `OPT-${Date.now().toString(36)}`, label: form.label.value, cost: Number(form.cost.value),
      timeText: form.timeText.value.trim(), warranty: form.warranty.value.trim(), note: form.note.value.trim(),
      recommended: form.recommended.checked, garageId: form.garageId.value || null
    });
    addActivity(`${job.id}: option built - ${form.label.value} at ${aed(form.cost.value)}`);
    render();
  } else if (kind === "save-inspection") {
    const job = jobById(form.dataset.job);
    if (!job) return;
    const gid = form.garageId.value;
    if (gid) job.assignedGarageId = gid;
    const items = INSPECTION_AREAS.map((area, i) => ({ area, result: form[`result-${i}`].value, note: form[`note-${i}`].value.trim() }));
    job.inspection = { by: gid ? profileName(gid) : "MTS Inspector", items, summary: form.summary.value.trim(), recommendation: form.recommendation.value.trim(), at: nowIso() };
    if (jobIsOpen(job) && ["New Request", "MTS Review", "Sourcing Quotes"].includes(job.status)) job.status = "Ready For Delivery";
    addTimeline(job, `${INSPECTION_AREAS.length}-point inspection report completed`, me.name);
    pushChat(job, "owner", `Your inspection report is ready - open the job to view it and download the PDF.`);
    render();
  } else if (kind === "generate-invoice") {
    const job = jobById(form.dataset.job);
    if (!job || job.invoice) return;
    const opt = job.options.find((o) => o.id === job.selectedOptionId);
    const base = Number(form.base.value || 0);
    const baseLabel = opt ? `${opt.label} - ${job.category} (${opt.garageId ? profileName(opt.garageId) : "MTS network"})`
      : `${job.category} - inspection report (${job.assignedGarageId ? profileName(job.assignedGarageId) : "MTS Inspector"})`;
    const lines = [{ label: baseLabel, amount: base }];
    const fee = Number(form.fee.value || 0);
    if (fee > 0) lines.push({ label: "MTS Concierge fee", amount: fee });
    const extraLabel = form.extraLabel.value.trim();
    const extraAmount = Number(form.extraAmount.value || 0);
    if (extraLabel && extraAmount > 0) lines.push({ label: extraLabel, amount: extraAmount });
    const total = lines.reduce((s, l) => s + l.amount, 0);
    const invId = `INV-${String(state.counters.invoice).padStart(4, "0")}`;
    state.counters.invoice += 1;
    job.invoice = { id: invId, lines, total, status: "Unpaid", at: nowIso() };
    job.status = "Invoiced";
    addTimeline(job, `Invoice ${invId} issued - ${aed(total)}`, me.name);
    pushChat(job, "owner", `Your invoice ${invId} for ${aed(total)} is ready. Your car is ready for delivery.`);
    render();
  } else if (kind === "submit-review") {
    const job = jobById(form.dataset.job);
    if (!job || !ratingDraft) { alert("Please tap the stars to choose a rating first."); return; }
    job.review = { rating: ratingDraft, comment: form.comment.value.trim(), by: me.name, at: nowIso() };
    addTimeline(job, `Customer rated the job ${ratingDraft} stars`, me.name);
    ratingDraft = 0;
    render();
  } else if (kind === "assign-recovery") {
    const job = jobById(form.dataset.job);
    if (!job || !job.recovery) return;
    job.recovery.companyId = form.companyId.value;
    job.recovery.status = "Assigned";
    if (form.garageId.value) job.recovery.dropGarageId = form.garageId.value;
    if (job.status === "New Request") job.status = "MTS Review";
    addTimeline(job, `${profileName(form.companyId.value)} dispatched for recovery${form.garageId.value ? ` - deliver to ${profileName(form.garageId.value)}` : ""}`, me.name);
    pushChat(job, "owner", `${profileName(form.companyId.value)} is on the way to you. Driver contact: ${(profileById(form.companyId.value) || {}).phone || ""}.`);
    render();
  } else if (kind === "chat-send") {
    const job = jobById(form.dataset.job);
    if (!job) return;
    pushChat(job, me.id, form.text.value.trim());
    render();
  } else if (kind === "thread-send") {
    const custId = form.dataset.customer;
    if (!state.threads[custId]) state.threads[custId] = [];
    state.threads[custId].push({ by: me.id, name: me.name, text: form.text.value.trim(), at: nowIso() });
    render();
  } else if (kind === "add-partner") {
    state.profiles.push({
      id: `ptn-${Date.now().toString(36)}`, name: form.name.value.trim(), role: form.role.value,
      phone: form.phone.value.trim(), area: form.area.value.trim(), specialties: form.specialties.value.trim()
    });
    addActivity(`New partner added: ${form.name.value.trim()} (${form.role.value})`);
    render();
  }
});

document.addEventListener("change", (e) => {
  if (e.target.matches("input[data-media]") && draft) {
    draft.media = Array.from(e.target.files || []).map((f) => f.name);
    render();
  }
});

document.addEventListener("input", (e) => {
  if (e.target.matches("input[data-input='admin-search']")) {
    state.adminSearch = e.target.value;
    // update list without full re-render to keep focus
    const jobsWrap = document.querySelector(".job-list");
    if (jobsWrap) {
      const html = renderAdminJobs();
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      const fresh = tmp.querySelector(".job-list");
      if (fresh) jobsWrap.innerHTML = fresh.innerHTML;
    }
    saveState();
  }
});

profileSelect.addEventListener("change", () => {
  state.activeProfileId = profileSelect.value;
  const role = currentProfile().role;
  state.activeView = (ROLE_TABS[role] && ROLE_TABS[role][0][0]) || "home";
  draft = null;
  render();
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => { /* offline install optional */ });
}

render();

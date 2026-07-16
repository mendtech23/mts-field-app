const STORAGE_KEY = "mts-field-ops-v3";

const seedState = {
  activeView: "board",
  activeFilter: "All",
  selectedJobId: "JOB-1001",
  activeProfileId: "owner",
  profiles: [
    { id: "owner", name: "Owner", role: "Owner", phone: "+971500000001", canManage: true, accessStatus: "Active", workerType: "Management" },
    { id: "admin-1", name: "Admin 1", role: "Admin", phone: "+971500000010", canManage: true, accessStatus: "Active", workerType: "Management" },
    { id: "hr-1", name: "HR 1", role: "HR", phone: "+971500000015", canManage: true, accessStatus: "Active", workerType: "Management" },
    { id: "sup-1", name: "Supervisor 1", role: "Supervisor", phone: "+971500000011", canManage: true, accessStatus: "Active", workerType: "Management" },
    { id: "sup-2", name: "Supervisor 2", role: "Supervisor", phone: "+971500000012", canManage: true, accessStatus: "Active", workerType: "Management" },
    { id: "wrk-1", name: "Worker 1", role: "Worker", phone: "+971500000101", skill: "Painting", accessStatus: "Active", workerType: "Employee" },
    { id: "wrk-2", name: "Worker 2", role: "Worker", phone: "+971500000102", skill: "Electrical", accessStatus: "Active", workerType: "Employee" },
    { id: "wrk-3", name: "Worker 3", role: "Worker", phone: "+971500000103", skill: "AC", accessStatus: "Active", workerType: "Employee" },
    { id: "wrk-4", name: "Worker 4", role: "Worker", phone: "+971500000104", skill: "Handyman", accessStatus: "Active", workerType: "Employee" },
    { id: "drv-1", name: "Driver 1", role: "Driver", phone: "+971500000201", vehicle: "Van 1", accessStatus: "Active", workerType: "Employee" }
  ],
  jobs: [
    {
      id: "JOB-1001",
      customer: "Palm Villa",
      service: "Painting and AC service",
      location: "Palm Jumeirah Villa 22",
      priority: "Urgent",
      status: "In Progress",
      supervisorId: "sup-1",
      driverId: "drv-1",
      workerIds: ["wrk-1", "wrk-3"],
      brief: "Repaint master bedroom, inspect AC cooling, protect furniture, send before and after photos.",
      createdAt: "2026-07-09T08:00:00+04:00",
      updates: [
        {
          by: "Supervisor 1",
          type: "progress",
          text: "Team reached site. Customer approved bedroom color.",
          at: "2026-07-09T08:45:00+04:00"
        }
      ],
      subJobs: [
        {
          id: "SUB-1001-A",
          title: "Bedroom repaint",
          trade: "Painting",
          status: "In Progress",
          supervisorId: "sup-1",
          workerIds: ["wrk-1"],
          acceptances: {
            "wrk-1": { status: "Accepted", at: "2026-07-09T08:20:00+04:00" }
          },
          due: "Today",
          notes: "Cover furniture, send before and after photos.",
          createdAt: "2026-07-09T08:05:00+04:00"
        },
        {
          id: "SUB-1001-B",
          title: "AC cooling inspection",
          trade: "AC",
          status: "Assigned",
          supervisorId: "sup-1",
          workerIds: ["wrk-3"],
          acceptances: {
            "wrk-3": { status: "Pending", at: "2026-07-09T08:10:00+04:00" }
          },
          due: "Today",
          notes: "Check cooling, gas level, and filter condition.",
          createdAt: "2026-07-09T08:10:00+04:00"
        }
      ],
      issues: [
        {
          id: "ISS-1001",
          by: "Worker 1",
          profileId: "wrk-1",
          type: "Material",
          message: "Need one more drop cloth before second coat.",
          status: "Open",
          at: "2026-07-09T09:05:00+04:00"
        }
      ],
      timeLogs: [],
      materials: [
        { name: "Masking tape", qty: "4 rolls", urgency: "Normal", by: "Worker 1", at: "2026-07-09T08:55:00+04:00" }
      ],
      transport: [
        {
          driverId: "drv-1",
          pickup: "Al Quoz accommodation",
          drop: "Palm Jumeirah Villa 22",
          time: "07:30",
          seats: "2",
          note: "Carry ladder and paint tools",
          at: "2026-07-09T07:10:00+04:00"
        }
      ],
      photos: [],
      locations: []
    },
    {
      id: "JOB-1002",
      customer: "Marina Office",
      service: "Electrical and handyman",
      location: "Dubai Marina, Tower B",
      priority: "Normal",
      status: "Scheduled",
      supervisorId: "sup-2",
      driverId: "drv-1",
      workerIds: ["wrk-2", "wrk-4"],
      brief: "Replace two lights, repair cabinet hinge, check socket near reception.",
      createdAt: "2026-07-09T09:00:00+04:00",
      updates: [],
      subJobs: [
        {
          id: "SUB-1002-A",
          title: "Replace reception lights",
          trade: "Electrical",
          status: "Assigned",
          supervisorId: "sup-2",
          workerIds: ["wrk-2"],
          acceptances: { "wrk-2": { status: "Pending", at: "2026-07-09T09:05:00+04:00" } },
          due: "Today",
          notes: "Confirm power isolation before work.",
          createdAt: "2026-07-09T09:05:00+04:00"
        },
        {
          id: "SUB-1002-B",
          title: "Repair cabinet hinge",
          trade: "Handyman",
          status: "Assigned",
          supervisorId: "sup-2",
          workerIds: ["wrk-4"],
          acceptances: { "wrk-4": { status: "Pending", at: "2026-07-09T09:05:00+04:00" } },
          due: "Today",
          notes: "Take before and after photo for office manager.",
          createdAt: "2026-07-09T09:05:00+04:00"
        }
      ],
      issues: [],
      timeLogs: [],
      materials: [],
      transport: [],
      photos: [],
      locations: []
    }
  ],
  syncQueue: [],
  zoho: {
    relayUrl: ""
  },
  slack: {
    channel: "#mts-field-updates",
    channelId: "C0BFZLRJ8AX",
    relayUrl: "",
    notify: {
      assignments: true,
      issues: true,
      materials: true,
      photos: true
    },
    alerts: [
      {
        id: "SLACK-SEED-1",
        type: "Worker Issue Raised",
        channel: "#mts-field-updates",
        status: "Ready",
        text: "*MTS Field Alert*\nPalm Villa - Worker 1 raised Material issue: Need one more drop cloth before second coat.",
        payload: {
          text: "*MTS Field Alert*\nPalm Villa - Worker 1 raised Material issue: Need one more drop cloth before second coat."
        },
        at: "2026-07-09T09:05:00+04:00"
      }
    ]
  },
  security: {
    masterCodeHash: null,
    lockEnabled: true
  },
  inspections: []
};

let state = loadState();
let unlocked = false;

function hashCode(str) {
  let h = 5381;
  for (let i = 0; i < String(str).length; i += 1) {
    h = ((h << 5) + h + String(str).charCodeAt(i)) >>> 0;
  }
  return "h" + h.toString(16);
}

function canEditInspections() {
  return unlocked && currentProfile().role === "Owner";
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return normalizeState(structuredClone(seedState));
  try {
    const parsed = JSON.parse(saved);
    return normalizeState(parsed);
  } catch {
    return normalizeState(structuredClone(seedState));
  }
}

function normalizeState(nextState) {
  nextState.profiles = (nextState.profiles || []).map((profile) => ({
    accessStatus: "Active",
    approvalStatus: "Approved",
    workerType: profile.role === "Owner" || profile.role === "Supervisor" ? "Management" : "Employee",
    ...profile
  }));
  nextState.jobs = (nextState.jobs || []).map((job) => ({
    workerIds: [],
    updates: [],
    subJobs: [],
    issues: [],
    timeLogs: [],
    materials: [],
    transport: [],
    photos: [],
    locations: [],
    ...job
  }));
  expireOutsourceAccess(nextState);
  nextState.syncQueue = nextState.syncQueue || [];
  nextState.zoho = {
    relayUrl: "",
    ...(nextState.zoho || {})
  };
  nextState.slack = {
    channel: "#mts-field-updates",
    channelId: "C0BFZLRJ8AX",
    relayUrl: "",
    notify: {
      assignments: true,
      issues: true,
      materials: true,
      photos: true
    },
    alerts: [],
    ...(nextState.slack || {})
  };
  nextState.slack.notify = {
    assignments: true,
    issues: true,
    materials: true,
    photos: true,
    ...(nextState.slack.notify || {})
  };
  nextState.slack.alerts = nextState.slack.alerts || [];
  nextState.security = {
    masterCodeHash: null,
    lockEnabled: true,
    ...(nextState.security || {})
  };
  nextState.inspections = nextState.inspections || [];
  return nextState;
}

function expireOutsourceAccess(targetState) {
  const now = new Date();
  targetState.profiles.forEach((profile) => {
    if (
      profile.workerType === "Outsource" &&
      profile.accessStatus === "Active" &&
      profile.expiresAt &&
      new Date(`${profile.expiresAt}T23:59:59`) < now
    ) {
      profile.accessStatus = "Revoked";
      profile.accessChangedAt = now.toISOString();
      profile.accessChangedBy = "Auto expiry";
    }
  });
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return;
  } catch {
    // Storage is full: shed history first, then oldest photos, so the app keeps working.
  }
  state.syncQueue = state.syncQueue.slice(0, 40);
  state.slack.alerts = state.slack.alerts.slice(0, 40);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return;
  } catch {
    state.jobs.forEach((job) => {
      job.photos = job.photos.slice(0, 2);
    });
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    alert("Phone storage was full. Older history and photos were trimmed so the app keeps working. Export JSON from the Zoho tab regularly.");
  } catch {
    alert("Storage is full and could not be trimmed automatically. Export JSON from the Zoho tab, then clear browser data for this app.");
  }
}

function queueSync(type, jobId, payload) {
  state.syncQueue.unshift({
    id: `SYNC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type,
    jobId,
    payload: syncSafePayload(payload),
    status: "Pending",
    at: new Date().toISOString()
  });
  queueSlackAlert(type, jobId, payload);
}

function syncSafePayload(payload) {
  const clone = structuredClone(payload);
  if (Array.isArray(clone.photos)) {
    // Keep photo metadata only; image files belong in WorkDrive/attachments, not the event queue.
    clone.photos = clone.photos.map(({ dataUrl, ...meta }) => meta);
  }
  return clone;
}

function queueSlackAlert(type, jobId, payload) {
  if (!shouldNotifySlack(type)) return;
  const alert = buildSlackAlert(type, jobId, payload);
  state.slack.alerts.unshift(alert);
}

function shouldNotifySlack(type) {
  const notify = state.slack?.notify || {};
  if (type.includes("Assignment") || type.includes("Sub-Job") || type.includes("Accepted") || type.includes("Rejected")) {
    return notify.assignments;
  }
  if (type.includes("Issue") || type.includes("Blocked")) return notify.issues;
  if (type.includes("Material") || type.includes("Transport")) return notify.materials;
  if (type.includes("Photo") || type.includes("GPS")) return notify.photos;
  if (type.includes("Team Member") || type.includes("Profile") || type.includes("Access") || type.includes("Temporary Worker")) {
    return true;
  }
  return ["Job Created", "Job Status Update"].includes(type);
}

function buildSlackAlert(type, jobId, payload) {
  const job = jobId === "WORKFORCE" ? null : state.jobs.find((item) => item.id === jobId);
  const title = job ? `${job.customer} - ${job.service}` : "MTS Workforce";
  const location = job ? job.location : "Office";
  const latestUpdate = job?.updates?.[0]?.text;
  const message = [
    "*MTS Field Alert*",
    `Type: ${type}`,
    `Ref: ${jobId}`,
    `Site: ${title}`,
    `Location: ${location}`,
    `By: ${currentProfile().name}`,
    latestUpdate ? `Latest: ${latestUpdate}` : "",
    slackPayloadSummary(type, payload)
  ].filter(Boolean).join("\n");
  return {
    id: `SLACK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type,
    channel: state.slack.channel || "#mts-field-updates",
    status: state.slack.relayUrl ? "Ready" : "Needs Relay",
    text: message,
    payload: {
      channel: state.slack.channel || "#mts-field-updates",
      channel_id: state.slack.channelId || "C0BFZLRJ8AX",
      text: message,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: message } }
      ]
    },
    at: new Date().toISOString()
  };
}

function slackPayloadSummary(type, payload) {
  if (!payload) return "";
  if (type.includes("Team Member") || type.includes("Profile")) {
    return `Member: ${payload.name || "Team member"} (${payload.role || "Role"}) | Approval: ${payload.approvalStatus || "Approved"}`;
  }
  if (type.includes("Temporary Worker")) return `Worker: ${payload.name || "Temp worker"} (${payload.skill || "General"})`;
  if (type.includes("Access")) return `Access: ${payload.name || "Worker"} is ${payload.accessStatus}`;
  if (payload.customer) return `Status: ${payload.status} | Priority: ${payload.priority}`;
  return "";
}

function byId(id) {
  return document.getElementById(id);
}

function currentProfile() {
  return state.profiles.find((profile) => profile.id === state.activeProfileId) || state.profiles[0];
}

function selectedJob() {
  return state.jobs.find((job) => job.id === state.selectedJobId) || state.jobs[0];
}

function isApproved(profile) {
  return (profile.approvalStatus || "Approved") === "Approved";
}

function ownerProfile() {
  return state.profiles.find((profile) => profile.role === "Owner");
}

function activeProfiles() {
  return state.profiles.filter((profile) => profile.accessStatus !== "Revoked" && isApproved(profile));
}

function switchableProfiles() {
  return activeProfiles();
}

function pendingApprovalProfiles() {
  return state.profiles.filter((profile) => profile.approvalStatus === "Pending");
}

function activeWorkers() {
  return activeProfiles().filter((profile) => profile.role === "Worker");
}

function formatDate(value) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-AE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function personName(id) {
  return (state.profiles.find((profile) => profile.id === id) || {}).name || "Unassigned";
}

function supervisorPhone(job) {
  const supervisor = state.profiles.find((profile) => profile.id === job.supervisorId);
  return supervisor?.phone || "";
}

function phoneForWhatsApp(phone) {
  return String(phone || "").replace(/[^\d]/g, "");
}

function statusClass(status) {
  if (["Completed", "Accepted", "Active"].includes(status)) return "ok";
  if (["Blocked", "Urgent", "Rejected", "Revoked", "Expired"].includes(status)) return "danger";
  if (["In Progress", "On Route", "Assigned", "Pending", "Approval Needed", "Outsource"].includes(status)) return "warn";
  return "";
}

function allSubJobs() {
  return state.jobs.flatMap((job) => job.subJobs.map((subJob) => ({ job, subJob })));
}

function pendingAcceptancesFor(profileId) {
  return allSubJobs().filter(({ subJob }) => subJob.acceptances?.[profileId]?.status === "Pending");
}

function pendingAcceptanceCount() {
  return allSubJobs().reduce((count, { subJob }) => {
    return count + Object.values(subJob.acceptances || {}).filter((item) => item.status === "Pending").length;
  }, 0);
}

function openIssueCount() {
  return state.jobs.reduce((count, job) => count + job.issues.filter((issue) => issue.status === "Open").length, 0);
}

function visibleJobs() {
  const profile = currentProfile();
  let jobs = state.jobs;
  if (profile.role === "Worker") {
    jobs = jobs.filter((job) => job.workerIds.includes(profile.id) || job.subJobs.some((subJob) => subJob.workerIds.includes(profile.id)));
  }
  if (profile.role === "Driver") {
    jobs = jobs.filter((job) => job.driverId === profile.id);
  }
  if (profile.role === "Supervisor") {
    jobs = jobs.filter((job) => job.supervisorId === profile.id || job.subJobs.some((subJob) => subJob.supervisorId === profile.id));
  }
  if (state.activeFilter !== "All") {
    jobs = jobs.filter((job) => job.status === state.activeFilter);
  }
  return jobs;
}

function render() {
  renderProfiles();
  renderTabs();
  renderBoard();
  renderJobDetail();
  renderTeam();
  renderSlack();
  renderSync();
  renderInspections();
  hydrateNewJobOptions();
  saveState();
}

function renderProfiles() {
  const select = byId("profileSelect");
  const loginable = switchableProfiles();
  if (!loginable.some((profile) => profile.id === state.activeProfileId)) {
    state.activeProfileId = (loginable[0] || state.profiles[0]).id;
  }
  select.innerHTML = loginable
    .map((profile) => `<option value="${profile.id}">${profile.name} - ${profile.role}</option>`)
    .join("");
  select.value = state.activeProfileId;
}

function renderTabs() {
  const managementOnly = ["slack", "sync"];
  const canManage = Boolean(currentProfile().canManage);
  if (!canManage && managementOnly.includes(state.activeView)) {
    state.activeView = "board";
  }
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("hidden", managementOnly.includes(tab.dataset.view) && !canManage);
    tab.classList.toggle("active", tab.dataset.view === state.activeView);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `${state.activeView}View`);
  });
}

function renderBoard() {
  const profile = currentProfile();
  const canManage = profile.canManage;
  const myPending = pendingAcceptancesFor(profile.id);
  byId("newJobButton").classList.toggle("hidden", !canManage);

  const activeJobs = state.jobs.filter((job) => job.status !== "Completed").length;
  const tempWorkers = state.profiles.filter((item) => item.workerType === "Outsource" && item.accessStatus === "Active").length;
  const pendingSync = state.syncQueue.filter((item) => item.status === "Pending").length;
  const workforce = state.profiles.filter((item) => ["Worker", "Driver"].includes(item.role) && item.accessStatus === "Active").length;

  byId("quickStats").innerHTML = [
    ["Active Jobs", activeJobs],
    ["Pending Accept", pendingAcceptanceCount()],
    ["Open Issues", openIssueCount()],
    ["Workforce", workforce],
    ["Outsource Active", tempWorkers],
    ["Pending Approval", pendingApprovalProfiles().length],
    ["Pending Zoho", pendingSync]
  ].map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");

  const statuses = ["All", "Scheduled", "On Route", "In Progress", "Blocked", "Completed"];
  byId("statusFilters").innerHTML = statuses
    .map((status) => `<button class="${state.activeFilter === status ? "active" : ""}" data-filter="${status}">${status}</button>`)
    .join("");

  const alertHtml = myPending.length ? `
    <div class="notice">
      <strong>Assignment confirmation needed</strong>
      <p>You have ${myPending.length} sub-job waiting for acceptance.</p>
      <div class="actions">
        ${myPending.map(({ job, subJob }) => `<button class="primary" data-open-job="${job.id}">${subJob.title}</button>`).join("")}
      </div>
    </div>
  ` : "";

  const pendingProfiles = pendingApprovalProfiles();
  const approvalHtml = profile.role === "Owner" && pendingProfiles.length ? `
    <div class="notice">
      <strong>Owner approval needed</strong>
      <p>${pendingProfiles.length} team member(s) waiting for your approval: ${pendingProfiles.map((item) => `${item.name} (${item.role})`).join(", ")}.</p>
      <div class="actions">
        <button class="primary" data-goto-team="1">Review In Team Tab</button>
      </div>
    </div>
  ` : "";

  byId("jobList").innerHTML = approvalHtml + alertHtml + (visibleJobs().length
    ? visibleJobs().map(jobCardHtml).join("")
    : byId("emptyStateTemplate").innerHTML);
}

function jobCardHtml(job) {
  const workers = job.workerIds.map(personName).join(", ");
  const pending = job.subJobs.reduce((count, subJob) => {
    return count + Object.values(subJob.acceptances || {}).filter((item) => item.status === "Pending").length;
  }, 0);
  const openIssues = job.issues.filter((issue) => issue.status === "Open").length;
  return `
    <article class="job-card">
      <div>
        <h3>${job.customer}</h3>
        <p>${job.service}</p>
        <div class="meta">
          <span class="pill ${statusClass(job.status)}">${job.status}</span>
          <span class="pill ${statusClass(job.priority)}">${job.priority}</span>
          <span class="pill">${job.location}</span>
          <span class="pill ${pending ? "warn" : "ok"}">${pending} pending accept</span>
          <span class="pill ${openIssues ? "danger" : "ok"}">${openIssues} open issues</span>
        </div>
        <p class="small">Supervisor: ${personName(job.supervisorId)} | Driver: ${personName(job.driverId)} | Workers: ${workers || "None"} | Sub-jobs: ${job.subJobs.length}</p>
      </div>
      <div class="actions">
        <button class="primary" data-open-job="${job.id}">Open</button>
        <a class="button-link" href="${whatsappUrl(job)}" target="_blank" rel="noreferrer">
          <button type="button">WhatsApp</button>
        </a>
      </div>
    </article>
  `;
}

function renderJobDetail() {
  const job = selectedJob();
  if (!job) {
    byId("jobDetail").innerHTML = byId("emptyStateTemplate").innerHTML;
    return;
  }

  const profile = currentProfile();
  const canManage = profile.canManage;
  const workers = activeWorkers();
  const drivers = activeProfiles().filter((profileItem) => profileItem.role === "Driver");
  const supervisors = activeProfiles().filter((profileItem) => profileItem.role === "Supervisor");
  const latestLocation = job.locations[0];
  const whatsappSupervisor = `https://wa.me/${phoneForWhatsApp(supervisorPhone(job))}?text=${encodeURIComponent(`MTS help needed on ${job.id} - ${job.customer}`)}`;

  byId("jobDetail").innerHTML = `
    <div class="section-head">
      <div>
        <h2 id="jobTitle">${job.customer}</h2>
        <p>${job.service} | ${job.location}</p>
      </div>
      <div class="actions">
        <a href="${whatsappUrl(job)}" target="_blank" rel="noreferrer"><button>WhatsApp Update</button></a>
        <a href="${whatsappSupervisor}" target="_blank" rel="noreferrer"><button>Speak To Supervisor</button></a>
        <button class="primary" data-gps="${job.id}">GPS Check-In</button>
      </div>
    </div>

    <div class="job-layout">
      <div class="stack">
        <section class="panel">
          <h3>Job Control</h3>
          <div class="field-row">
            <label>Status
              <select id="jobStatus">
                ${["Scheduled", "On Route", "In Progress", "Blocked", "Completed"].map((status) => `<option ${job.status === status ? "selected" : ""}>${status}</option>`).join("")}
              </select>
            </label>
            <label>Priority
              <select id="jobPriority">
                ${["Normal", "Urgent", "Inspection"].map((priority) => `<option ${job.priority === priority ? "selected" : ""}>${priority}</option>`).join("")}
              </select>
            </label>
          </div>
          <div class="field-row">
            <label>Supervisor
              <select id="jobSupervisor" ${canManage ? "" : "disabled"}>
                ${supervisors.map((item) => `<option value="${item.id}" ${job.supervisorId === item.id ? "selected" : ""}>${item.name}</option>`).join("")}
              </select>
            </label>
            <label>Driver
              <select id="jobDriver" ${canManage ? "" : "disabled"}>
                ${drivers.map((item) => `<option value="${item.id}" ${job.driverId === item.id ? "selected" : ""}>${item.name} - ${item.vehicle || "Vehicle"}</option>`).join("")}
              </select>
            </label>
          </div>
          <label>Work Brief
            <textarea id="jobBrief" rows="4">${job.brief || ""}</textarea>
          </label>
          <label>Assigned Workers
            <select id="workerPicker" ${canManage ? "" : "disabled"}>
              <option value="">Add worker to main job</option>
              ${workers.map((item) => `<option value="${item.id}">${item.name} - ${item.skill || "General"}${item.workerType === "Outsource" ? " (temp)" : ""}</option>`).join("")}
            </select>
          </label>
          <div class="meta">${job.workerIds.map((id) => `<span class="pill">${personName(id)}</span>`).join("") || "<span class=\"pill\">No workers assigned</span>"}</div>
        </section>

        <section class="panel">
          <h3>Sub-Jobs And Acceptance</h3>
          ${canManage ? subJobFormHtml(workers, supervisors) : ""}
          <div class="subjob-list">
            ${job.subJobs.length ? job.subJobs.map((subJob) => subJobHtml(job, subJob, profile, canManage, workers)).join("") : "<p class=\"small\">No sub-jobs yet. Split big work into smaller assigned tasks here.</p>"}
          </div>
        </section>

        <section class="panel">
          <h3>Worker To Supervisor</h3>
          <form id="issueForm">
            <div class="field-row">
              <label>Issue Type
                <select name="type">
                  <option>Need Help</option>
                  <option>Material</option>
                  <option>Customer</option>
                  <option>Safety</option>
                  <option>Transport</option>
                </select>
              </label>
              <label>Message
                <input name="message" required placeholder="Explain the issue clearly">
              </label>
            </div>
            <button class="primary" type="submit">Send To Supervisor</button>
          </form>
          <ul class="timeline">
            ${job.issues.length ? job.issues.map(issueHtml).join("") : "<li>No worker issues raised.</li>"}
          </ul>
        </section>

        <section class="panel">
          <h3>Update Log</h3>
          <form id="updateForm">
            <div class="field-row">
              <label>Type
                <select name="type">
                  <option value="progress">Progress</option>
                  <option value="blocker">Blocker</option>
                  <option value="customer">Customer Note</option>
                  <option value="quality">Quality Check</option>
                </select>
              </label>
              <label>Message
                <input name="text" required placeholder="What changed on site?">
              </label>
            </div>
            <button class="primary" type="submit">Add Update</button>
          </form>
          <ul class="timeline">
            ${job.updates.length ? job.updates.map((update) => `<li><strong>${update.by}</strong> <span class="small">${formatDate(update.at)} | ${update.type}</span><br>${update.text}</li>`).join("") : "<li>No updates yet.</li>"}
          </ul>
        </section>

        <section class="panel">
          <h3>Photos</h3>
          <form id="photoForm">
            <div class="field-row">
              <label>Photo Type
                <select name="type">
                  <option>Before</option>
                  <option>Progress</option>
                  <option>After</option>
                  <option>Material</option>
                </select>
              </label>
              <label>Upload
                <input name="photo" type="file" accept="image/*" capture="environment">
              </label>
            </div>
            <label>Caption
              <input name="caption" placeholder="Short description">
            </label>
            <button class="primary" type="submit">Save Photo</button>
          </form>
          <div class="photo-grid">
            ${job.photos.length ? job.photos.map((photo) => `<figure><img src="${photo.dataUrl}" alt="${photo.type} photo"><figcaption>${photo.type}: ${photo.caption || "No caption"}</figcaption></figure>`).join("") : "<p class=\"small\">Before, progress, and after photos will show here.</p>"}
          </div>
        </section>
      </div>

      <aside class="stack">
        <section class="panel">
          <h3>Time Log</h3>
          <div class="actions">
            <button class="primary" data-start-time="${job.id}">Start</button>
            <button data-stop-time="${job.id}">Stop</button>
          </div>
          <ul class="timeline">
            ${job.timeLogs.length ? job.timeLogs.map((log) => `<li><strong>${log.by}</strong><br><span class="small">${formatDate(log.start)} to ${log.end ? formatDate(log.end) : "Running"}</span></li>`).join("") : "<li>No hours logged.</li>"}
          </ul>
        </section>

        <section class="panel">
          <h3>WhatsApp Team</h3>
          <p class="small">Fast worker, supervisor, and driver contact for this job.</p>
          <div class="actions">
            ${personWhatsappLink(job.supervisorId, `MTS ${job.id}: I need support at ${job.customer}.`, "Supervisor")}
            ${personWhatsappLink(job.driverId, `MTS ${job.id}: Transport update for ${job.customer}, ${job.location}.`, "Driver")}
            ${job.workerIds.map((workerId) => personWhatsappLink(workerId, `MTS ${job.id}: Please check the job update for ${job.customer}.`, personName(workerId))).join("")}
          </div>
        </section>

        <section class="panel">
          <h3>Live Location Ready</h3>
          <p>Browser GPS check-ins are saved now. Continuous live tracking can be added with a mobile wrapper or timed check-in permission.</p>
          <p class="small">${latestLocation ? `Latest: ${latestLocation.by} at ${formatDate(latestLocation.at)} (${latestLocation.lat.toFixed(5)}, ${latestLocation.lng.toFixed(5)})` : "No GPS check-in yet."}</p>
          ${latestLocation ? `<a href="https://www.google.com/maps?q=${latestLocation.lat},${latestLocation.lng}" target="_blank" rel="noreferrer"><button>Open Map</button></a>` : ""}
        </section>

        <section class="panel">
          <h3>Materials</h3>
          <form id="materialForm">
            <label>Item
              <input name="name" required placeholder="Paint, wire, gas, screw...">
            </label>
            <div class="field-row">
              <label>Qty
                <input name="qty" required placeholder="2 pcs">
              </label>
              <label>Urgency
                <select name="urgency">
                  <option>Normal</option>
                  <option>Urgent</option>
                  <option>Approval Needed</option>
                </select>
              </label>
            </div>
            <button class="primary" type="submit">Request Material</button>
          </form>
          <ul class="timeline">
            ${job.materials.length ? job.materials.map((item) => `<li><strong>${item.name}</strong> - ${item.qty}<br><span class="small">${item.urgency} | ${item.by}</span></li>`).join("") : "<li>No material requests.</li>"}
          </ul>
        </section>

        <section class="panel">
          <h3>Transport</h3>
          <form id="transportForm">
            <label>Pickup
              <input name="pickup" required placeholder="Start point">
            </label>
            <label>Drop
              <input name="drop" required placeholder="Site or next job">
            </label>
            <div class="field-row">
              <label>Time
                <input name="time" type="time" required>
              </label>
              <label>Seats
                <input name="seats" inputmode="numeric" placeholder="3">
              </label>
            </div>
            <label>Note
              <input name="note" placeholder="Tools, materials, route note">
            </label>
            <button class="primary" type="submit">Add Trip</button>
          </form>
          <ul class="timeline">
            ${job.transport.length ? job.transport.map((trip) => `<li><strong>${personName(trip.driverId)}</strong><br>${trip.pickup} to ${trip.drop}<br><span class="small">${trip.time} | ${trip.seats || 0} seats | ${trip.note || "No note"}</span></li>`).join("") : "<li>No transport trips.</li>"}
          </ul>
        </section>
      </aside>
    </div>
  `;
}

function subJobFormHtml(workers, supervisors) {
  return `
    <form id="subJobForm" class="compact-form">
      <div class="form-grid">
        <label>Sub-Job
          <input name="title" required placeholder="Example: Bedroom painting">
        </label>
        <label>Trade
          <select name="trade">
            <option>Painting</option>
            <option>AC</option>
            <option>Electrical</option>
            <option>Handyman</option>
            <option>Plumbing</option>
            <option>Renovation</option>
          </select>
        </label>
        <label>Supervisor
          <select name="supervisorId">
            ${supervisors.map((item) => `<option value="${item.id}">${item.name}</option>`).join("")}
          </select>
        </label>
        <label>Assign Worker
          <select name="workerId" required>
            ${workers.map((item) => `<option value="${item.id}">${item.name} - ${item.skill || "General"}${item.workerType === "Outsource" ? " (temp)" : ""}</option>`).join("")}
          </select>
        </label>
      </div>
      <label>Notes
        <input name="notes" placeholder="Instructions, safety note, photo requirement">
      </label>
      <button class="primary" type="submit">Create And Alert Worker</button>
    </form>
  `;
}

function subJobHtml(job, subJob, profile, canManage, workers) {
  const isAssignedWorker = subJob.workerIds.includes(profile.id);
  const myAcceptance = subJob.acceptances?.[profile.id];
  const acceptancePills = subJob.workerIds.map((workerId) => {
    const acceptance = subJob.acceptances?.[workerId]?.status || "Pending";
    return `<span class="pill ${statusClass(acceptance)}">${personName(workerId)}: ${acceptance}</span>`;
  }).join("");
  return `
    <article class="subjob-card">
      <div>
        <h4>${subJob.title}</h4>
        <p class="small">${subJob.trade} | ${subJob.status} | Supervisor: ${personName(subJob.supervisorId)} | Due: ${subJob.due || "Not set"}</p>
        <p>${subJob.notes || "No notes"}</p>
        <div class="meta">${acceptancePills}</div>
      </div>
      <div class="actions">
        ${isAssignedWorker && myAcceptance?.status === "Pending" ? `<button class="primary" data-accept-subjob="${subJob.id}">Accept</button><button class="danger" data-reject-subjob="${subJob.id}">Reject</button>` : ""}
        ${canManage ? subJob.workerIds.map((workerId) => personWhatsappLink(workerId, assignmentMessage(job, subJob, workerId), `WhatsApp ${personName(workerId)}`)).join("") : ""}
        ${canManage ? `<select data-add-subjob-worker="${subJob.id}"><option value="">Add worker</option>${workers.map((item) => `<option value="${item.id}">${item.name}</option>`).join("")}</select>` : ""}
        ${canManage && subJob.status !== "Completed" ? `<button data-complete-subjob="${subJob.id}">Complete</button>` : ""}
      </div>
    </article>
  `;
}

function issueHtml(issue) {
  return `
    <li>
      <strong>${issue.by}</strong> <span class="pill ${issue.status === "Open" ? "danger" : "ok"}">${issue.status}</span>
      <span class="small">${formatDate(issue.at)} | ${issue.type}</span><br>
      ${issue.message}
      ${issue.status === "Open" && currentProfile().canManage ? `<div class="actions"><button data-close-issue="${issue.id}">Mark Resolved</button></div>` : ""}
    </li>
  `;
}

function renderTeam() {
  const profile = currentProfile();
  const canSeeAll = profile.canManage || profile.role === "Driver";
  const people = canSeeAll ? state.profiles : [profile];
  const canManage = profile.canManage;
  byId("teamGrid").innerHTML = `
    ${canManage ? teamMemberFormHtml() : ""}
    ${people.map(personCardHtml).join("")}
  `;
}

function renderSlack() {
  const channel = byId("slackChannel");
  const channelId = byId("slackChannelId");
  const relayUrl = byId("slackRelayUrl");
  if (channel) channel.value = state.slack.channel || "#mts-field-updates";
  if (channelId) channelId.value = state.slack.channelId || "C0BFZLRJ8AX";
  if (relayUrl) relayUrl.value = state.slack.relayUrl || "";
  const form = byId("slackSettingsForm");
  if (form) {
    ["assignments", "issues", "materials", "photos"].forEach((name) => {
      const input = form.elements[name];
      if (input) input.checked = Boolean(state.slack.notify[name]);
    });
  }

  const alerts = byId("slackAlerts");
  if (!alerts) return;
  alerts.innerHTML = state.slack.alerts.length
    ? state.slack.alerts.map((alert) => `
      <article class="sync-item">
        <strong>${alert.type}</strong> <span class="pill ${alert.status === "Sent" ? "ok" : alert.status === "Ready" ? "warn" : "danger"}">${alert.status}</span>
        <p class="small">${alert.channel} | ${formatDate(alert.at)}</p>
        <p class="alert-message">${alert.text}</p>
        <details>
          <summary>Slack payload</summary>
          <pre>${JSON.stringify(alert.payload, null, 2)}</pre>
        </details>
        <div class="actions">
          ${alert.status !== "Sent" ? `<button class="primary" data-send-slack="${alert.id}">Send To Relay</button>` : ""}
          ${alert.status !== "Sent" ? `<button data-mark-slack-sent="${alert.id}">Mark Sent</button>` : ""}
          <button data-copy-slack="${alert.id}">Copy Message</button>
        </div>
      </article>
    `).join("")
    : byId("emptyStateTemplate").innerHTML;
}

function teamMemberFormHtml() {
  const isOwner = currentProfile().role === "Owner";
  return `
    <article class="person-card team-form-card">
      <h3>Add Team Member</h3>
      <p class="small">${isOwner ? "Members you add are approved immediately." : "New members stay locked until the Owner approves them."}</p>
      <form id="teamMemberForm">
        <label>Name
          <input name="name" required placeholder="Full name">
        </label>
        <label>Phone
          <input name="phone" required placeholder="+971...">
        </label>
        <div class="field-row">
          <label>Role
            <select name="role">
              <option>Worker</option>
              <option>Driver</option>
              <option>Supervisor</option>
              <option>Admin</option>
              <option>HR</option>
            </select>
          </label>
          <label>Employment
            <select name="workerType">
              <option value="Employee">Employee (permanent)</option>
              <option value="Outsource">Outsource (temporary)</option>
            </select>
          </label>
        </div>
        <label>Skill / Vehicle
          <input name="skill" required placeholder="Painting, AC, Van 2, office...">
        </label>
        <label>Access Until (required for temporary)
          <input name="expiresAt" type="date">
        </label>
        <button class="primary" type="submit">${isOwner ? "Add Team Member" : "Submit For Owner Approval"}</button>
      </form>
    </article>
  `;
}

function personCardHtml(person) {
  const assignedJobs = state.jobs.filter((job) => job.workerIds.includes(person.id) || job.driverId === person.id || job.supervisorId === person.id || job.subJobs.some((subJob) => subJob.workerIds.includes(person.id)));
  const latestLocation = state.jobs.flatMap((job) => job.locations).filter((location) => location.profileId === person.id)[0];
  const pending = pendingAcceptancesFor(person.id).length;
  const viewer = currentProfile();
  const approved = isApproved(person);
  const isOwnerViewer = viewer.role === "Owner";
  const canToggle = viewer.canManage && approved && !["Owner", "Supervisor"].includes(person.role);
  const owner = ownerProfile();
  const cardClass = person.accessStatus === "Revoked" || person.approvalStatus === "Rejected"
    ? "revoked"
    : person.approvalStatus === "Pending" ? "pending" : "";
  const approvalPill = approved
    ? ""
    : `<span class="pill ${statusClass(person.approvalStatus)}">${person.approvalStatus === "Pending" ? "Awaiting Owner Approval" : "Approval Rejected"}</span>`;
  const approvalInfo = approved
    ? `Approved${person.approvedBy ? ` by ${person.approvedBy}` : ""}`
    : person.approvalStatus === "Pending"
      ? `Waiting for Owner${person.createdBy ? ` | Added by ${person.createdBy}` : ""}`
      : `Rejected${person.rejectedBy ? ` by ${person.rejectedBy}` : ""}`;
  const approvalActions = [
    !approved && isOwnerViewer ? `<button class="primary" data-approve-profile="${person.id}">Approve</button>` : "",
    person.approvalStatus === "Pending" && isOwnerViewer ? `<button class="danger" data-reject-profile="${person.id}">Reject</button>` : "",
    person.approvalStatus === "Pending" && !isOwnerViewer && viewer.canManage && owner
      ? personWhatsappLink(owner.id, `MTS approval needed: ${person.name} (${person.role}) is waiting for your approval in the MTS app.`, "WhatsApp Owner")
      : "",
    canToggle ? `<button class="${person.accessStatus === "Revoked" ? "primary" : "danger"}" data-toggle-access="${person.id}">${person.accessStatus === "Revoked" ? "Restore Access" : "Revoke Access"}</button>` : ""
  ].filter(Boolean).join("");
  return `
    <article class="person-card ${cardClass}">
      <div class="person-head">
        <h3>${person.name}</h3>
        <span class="pill ${statusClass(person.accessStatus)}">${person.accessStatus}</span>
        ${approvalPill}
      </div>
      <dl>
        <dt>Role</dt><dd>${person.role}</dd>
        <dt>Type</dt><dd>${person.workerType || "Employee"}</dd>
        <dt>Phone</dt><dd>${person.phone}</dd>
        <dt>Skill</dt><dd>${person.skill || person.vehicle || "Management"}</dd>
        <dt>Approval</dt><dd>${approvalInfo}</dd>
        <dt>Expiry</dt><dd>${person.expiresAt || "Permanent"}</dd>
        <dt>Pending</dt><dd>${pending} confirmations</dd>
        <dt>Jobs</dt><dd>${assignedJobs.map((job) => job.id).join(", ") || "None"}</dd>
        <dt>Location</dt><dd>${latestLocation ? `${formatDate(latestLocation.at)} (${latestLocation.lat.toFixed(4)}, ${latestLocation.lng.toFixed(4)})` : "No check-in"}</dd>
      </dl>
      ${approvalActions ? `<div class="actions">${approvalActions}</div>` : ""}
    </article>
  `;
}

function renderSync() {
  const zohoUrl = byId("zohoRelayUrl");
  if (zohoUrl) zohoUrl.value = state.zoho.relayUrl || "";
  byId("syncQueue").innerHTML = state.syncQueue.length
    ? state.syncQueue.map((item) => `
      <article class="sync-item">
        <strong>${item.type}</strong> <span class="pill ${item.status === "Synced" ? "ok" : "warn"}">${item.status}</span>
        <p class="small">${item.jobId} | ${formatDate(item.at)}${item.syncedAt ? ` | Synced ${formatDate(item.syncedAt)}` : ""}</p>
        ${item.error ? `<p class="small error-text">${item.error}</p>` : ""}
        <pre>${JSON.stringify(item.payload, null, 2)}</pre>
        ${item.status !== "Synced" ? `
          <div class="actions">
            <button class="primary" data-send-sync="${item.id}">Send To Backend</button>
            <button data-mark-synced="${item.id}">Mark Synced</button>
          </div>
        ` : ""}
      </article>
    `).join("")
    : byId("emptyStateTemplate").innerHTML;
}

function whatsappUrl(job) {
  const latestUpdate = job.updates[0];
  const text = [
    `MTS Job Update: ${job.id}`,
    `Customer: ${job.customer}`,
    `Service: ${job.service}`,
    `Status: ${job.status}`,
    `Location: ${job.location}`,
    `Supervisor: ${personName(job.supervisorId)}`,
    `Driver: ${personName(job.driverId)}`,
    `Workers: ${job.workerIds.map(personName).join(", ") || "None"}`,
    `Sub-jobs: ${job.subJobs.map((subJob) => `${subJob.title} (${subJob.status})`).join(", ") || "None"}`,
    latestUpdate ? `Latest: ${latestUpdate.text}` : "Latest: No update yet"
  ].join("\n");
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function whatsappPersonUrl(phone, message) {
  const number = phoneForWhatsApp(phone);
  const base = number ? `https://wa.me/${number}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(message)}`;
}

function personWhatsappLink(profileId, message, label) {
  const person = state.profiles.find((item) => item.id === profileId);
  if (!person?.phone) return "";
  return `<a href="${whatsappPersonUrl(person.phone, message)}" target="_blank" rel="noreferrer"><button type="button">${label || person.name}</button></a>`;
}

function assignmentMessage(job, subJob, workerId) {
  return [
    `MTS Work Assignment`,
    `Job: ${job.id} - ${job.customer}`,
    `Sub-job: ${subJob.title}`,
    `Trade: ${subJob.trade}`,
    `Location: ${job.location}`,
    `Supervisor: ${personName(subJob.supervisorId)}`,
    `Worker: ${personName(workerId)}`,
    `Instructions: ${subJob.notes || "Please check app for details."}`,
    `Please accept or reject this assignment in the MTS app.`
  ].join("\n");
}

function updateSelectedJob(mutator, syncType) {
  const job = selectedJob();
  if (!job) return;
  mutator(job);
  if (syncType) queueSync(syncType, job.id, job);
  render();
}

function findSubJob(job, subJobId) {
  return job.subJobs.find((subJob) => subJob.id === subJobId);
}

document.addEventListener("change", (event) => {
  if (event.target.id === "profileSelect") {
    state.activeProfileId = event.target.value;
    render();
  }
  if (event.target.id === "jobStatus") {
    updateSelectedJob((job) => {
      job.status = event.target.value;
      job.updates.unshift({ by: currentProfile().name, type: "status", text: `Status changed to ${job.status}`, at: new Date().toISOString() });
    }, "Job Status Update");
  }
  if (event.target.id === "jobPriority") {
    updateSelectedJob((job) => { job.priority = event.target.value; }, "Job Priority Update");
  }
  if (event.target.id === "jobSupervisor") {
    updateSelectedJob((job) => { job.supervisorId = event.target.value; }, "Supervisor Assignment");
  }
  if (event.target.id === "jobDriver") {
    updateSelectedJob((job) => { job.driverId = event.target.value; }, "Driver Assignment");
  }
  if (event.target.id === "workerPicker" && event.target.value) {
    updateSelectedJob((job) => {
      if (!job.workerIds.includes(event.target.value)) job.workerIds.push(event.target.value);
    }, "Worker Assignment");
  }
  if (event.target.dataset.addSubjobWorker && event.target.value) {
    const workerId = event.target.value;
    updateSelectedJob((job) => {
      const subJob = findSubJob(job, event.target.dataset.addSubjobWorker);
      if (!subJob) return;
      if (!subJob.workerIds.includes(workerId)) subJob.workerIds.push(workerId);
      subJob.acceptances[workerId] = { status: "Pending", at: new Date().toISOString() };
      if (!job.workerIds.includes(workerId)) job.workerIds.push(workerId);
      job.updates.unshift({ by: currentProfile().name, type: "assignment", text: `${personName(workerId)} assigned to ${subJob.title}; waiting for acceptance.`, at: new Date().toISOString() });
    }, "Sub-Job Worker Alert");
  }
});

document.addEventListener("click", (event) => {
  if (event.target.id === "lockButton") { lockApp(); return; }
  if (event.target.id === "newInspectionButton") { toggleNewInspection(true); return; }
  if (event.target.id === "cancelInspection") { toggleNewInspection(false); return; }
  if (event.target.dataset.deleteInspection) { deleteInspection(event.target.dataset.deleteInspection); return; }
  const tab = event.target.closest(".tab");
  if (tab) {
    state.activeView = tab.dataset.view;
    render();
  }

  const filter = event.target.dataset.filter;
  if (filter) {
    state.activeFilter = filter;
    render();
  }

  const openJobId = event.target.dataset.openJob;
  if (openJobId) {
    state.selectedJobId = openJobId;
    state.activeView = "job";
    render();
  }

  if (event.target.id === "newJobButton") byId("newJobForm").classList.remove("hidden");
  if (event.target.id === "cancelNewJob") byId("newJobForm").classList.add("hidden");

  if (event.target.dataset.startTime) {
    updateSelectedJob((job) => {
      job.timeLogs.unshift({ by: currentProfile().name, profileId: currentProfile().id, start: new Date().toISOString(), end: null });
    }, "Time Start");
  }

  if (event.target.dataset.stopTime) {
    updateSelectedJob((job) => {
      const running = job.timeLogs.find((log) => log.profileId === currentProfile().id && !log.end);
      if (running) running.end = new Date().toISOString();
    }, "Time Stop");
  }

  if (event.target.dataset.acceptSubjob) {
    setSubJobAcceptance(event.target.dataset.acceptSubjob, "Accepted");
  }

  if (event.target.dataset.rejectSubjob) {
    setSubJobAcceptance(event.target.dataset.rejectSubjob, "Rejected");
  }

  if (event.target.dataset.completeSubjob) {
    updateSelectedJob((job) => {
      const subJob = findSubJob(job, event.target.dataset.completeSubjob);
      if (!subJob) return;
      subJob.status = "Completed";
      job.updates.unshift({ by: currentProfile().name, type: "sub-job", text: `${subJob.title} marked completed.`, at: new Date().toISOString() });
    }, "Sub-Job Completed");
  }

  if (event.target.dataset.closeIssue) {
    updateSelectedJob((job) => {
      const issue = job.issues.find((item) => item.id === event.target.dataset.closeIssue);
      if (!issue) return;
      issue.status = "Resolved";
      issue.resolvedBy = currentProfile().name;
      issue.resolvedAt = new Date().toISOString();
      job.updates.unshift({ by: currentProfile().name, type: "issue", text: `Resolved issue: ${issue.message}`, at: new Date().toISOString() });
    }, "Issue Resolved");
  }

  if (event.target.dataset.toggleAccess) {
    toggleAccess(event.target.dataset.toggleAccess);
  }

  if (event.target.dataset.approveProfile) {
    approveProfile(event.target.dataset.approveProfile);
  }

  if (event.target.dataset.rejectProfile) {
    rejectProfile(event.target.dataset.rejectProfile);
  }

  if (event.target.dataset.gotoTeam) {
    state.activeView = "team";
    render();
  }

  if (event.target.dataset.gps) captureLocation();

  const syncId = event.target.dataset.markSynced;
  if (syncId) {
    const item = state.syncQueue.find((entry) => entry.id === syncId);
    if (item) item.status = "Synced";
    render();
  }

  if (event.target.dataset.sendSync) {
    sendSyncItem(event.target.dataset.sendSync);
  }

  if (event.target.id === "syncAllPendingButton") {
    syncAllPending();
  }

  if (event.target.id === "exportButton") exportJson();

  if (event.target.id === "testSlackButton") {
    const alert = buildSlackAlert("Test Alert", "MTS", {
      customer: "MTS Test",
      service: "Slack alert check",
      status: "Ready",
      priority: "Normal"
    });
    state.slack.alerts.unshift(alert);
    render();
  }

  if (event.target.id === "sendPendingSlackButton") {
    sendPendingSlackAlerts();
  }

  if (event.target.dataset.sendSlack) {
    sendSlackAlert(event.target.dataset.sendSlack);
  }

  if (event.target.dataset.markSlackSent) {
    const alert = state.slack.alerts.find((item) => item.id === event.target.dataset.markSlackSent);
    if (alert) alert.status = "Sent";
    render();
  }

  if (event.target.dataset.copySlack) {
    const alert = state.slack.alerts.find((item) => item.id === event.target.dataset.copySlack);
    if (alert && navigator.clipboard) {
      navigator.clipboard.writeText(alert.text);
    }
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id === "jobBrief") {
    const job = selectedJob();
    job.brief = event.target.value;
    saveState();
  }
});

document.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.target.id === "newJobForm") createJob(event.target);
  if (event.target.id === "subJobForm") addSubJob(event.target);
  if (event.target.id === "issueForm") addIssue(event.target);
  if (event.target.id === "updateForm") addUpdate(event.target);
  if (event.target.id === "materialForm") addMaterial(event.target);
  if (event.target.id === "transportForm") addTransport(event.target);
  if (event.target.id === "photoForm") addPhoto(event.target);
  if (event.target.id === "teamMemberForm") addTeamMember(event.target);
  if (event.target.id === "slackSettingsForm") saveSlackSettings(event.target);
  if (event.target.id === "zohoSettingsForm") saveZohoSettings(event.target);
  if (event.target.id === "inspectionForm") createInspection(event.target);
  if (event.target.id === "lockSetupForm") setupMasterCode(event.target);
  if (event.target.id === "lockEnterForm") submitMasterCode(event.target);
});

function hydrateNewJobOptions() {
  byId("newJobSupervisor").innerHTML = activeProfiles()
    .filter((profile) => profile.role === "Supervisor")
    .map((profile) => `<option value="${profile.id}">${profile.name}</option>`)
    .join("");
  byId("newJobDriver").innerHTML = activeProfiles()
    .filter((profile) => profile.role === "Driver")
    .map((profile) => `<option value="${profile.id}">${profile.name} - ${profile.vehicle || "Vehicle"}</option>`)
    .join("");
}

function createJob(form) {
  const data = new FormData(form);
  const id = `JOB-${Math.floor(1000 + Math.random() * 9000)}`;
  const job = {
    id,
    customer: data.get("customer"),
    service: data.get("service"),
    location: data.get("location"),
    priority: data.get("priority"),
    status: "Scheduled",
    supervisorId: data.get("supervisor"),
    driverId: data.get("driver"),
    workerIds: [],
    brief: data.get("brief"),
    createdAt: new Date().toISOString(),
    updates: [],
    subJobs: [],
    issues: [],
    timeLogs: [],
    materials: [],
    transport: [],
    photos: [],
    locations: []
  };
  state.jobs.unshift(job);
  state.selectedJobId = id;
  state.activeView = "job";
  queueSync("Job Created", id, job);
  form.reset();
  form.classList.add("hidden");
  render();
}

function addSubJob(form) {
  const data = new FormData(form);
  const workerId = data.get("workerId");
  updateSelectedJob((job) => {
    const subJob = {
      id: `SUB-${Date.now()}`,
      title: data.get("title"),
      trade: data.get("trade"),
      status: "Assigned",
      supervisorId: data.get("supervisorId"),
      workerIds: [workerId],
      acceptances: {
        [workerId]: { status: "Pending", at: new Date().toISOString() }
      },
      due: "Today",
      notes: data.get("notes"),
      createdAt: new Date().toISOString()
    };
    job.subJobs.unshift(subJob);
    if (!job.workerIds.includes(workerId)) job.workerIds.push(workerId);
    job.updates.unshift({ by: currentProfile().name, type: "assignment", text: `${personName(workerId)} alerted for sub-job: ${subJob.title}`, at: new Date().toISOString() });
  }, "Sub-Job Created And Worker Alerted");
  form.reset();
}

function setSubJobAcceptance(subJobId, status) {
  updateSelectedJob((job) => {
    const subJob = findSubJob(job, subJobId);
    if (!subJob) return;
    subJob.acceptances[currentProfile().id] = { status, at: new Date().toISOString() };
    if (status === "Accepted" && subJob.status === "Assigned") subJob.status = "In Progress";
    if (status === "Rejected") subJob.status = "Blocked";
    job.updates.unshift({
      by: currentProfile().name,
      type: "acceptance",
      text: `${status} sub-job: ${subJob.title}`,
      at: new Date().toISOString()
    });
  }, `Sub-Job ${status}`);
}

function addIssue(form) {
  const data = new FormData(form);
  updateSelectedJob((job) => {
    job.issues.unshift({
      id: `ISS-${Date.now()}`,
      by: currentProfile().name,
      profileId: currentProfile().id,
      type: data.get("type"),
      message: data.get("message"),
      status: "Open",
      at: new Date().toISOString()
    });
    job.updates.unshift({ by: currentProfile().name, type: "issue", text: `Issue raised: ${data.get("message")}`, at: new Date().toISOString() });
  }, "Worker Issue Raised");
  form.reset();
}

function addUpdate(form) {
  const data = new FormData(form);
  updateSelectedJob((job) => {
    job.updates.unshift({
      by: currentProfile().name,
      type: data.get("type"),
      text: data.get("text"),
      at: new Date().toISOString()
    });
  }, "Progress Update");
  form.reset();
}

function addMaterial(form) {
  const data = new FormData(form);
  updateSelectedJob((job) => {
    job.materials.unshift({
      name: data.get("name"),
      qty: data.get("qty"),
      urgency: data.get("urgency"),
      by: currentProfile().name,
      at: new Date().toISOString()
    });
  }, "Material Request");
  form.reset();
}

function addTransport(form) {
  const data = new FormData(form);
  updateSelectedJob((job) => {
    job.transport.unshift({
      driverId: job.driverId,
      pickup: data.get("pickup"),
      drop: data.get("drop"),
      time: data.get("time"),
      seats: data.get("seats"),
      note: data.get("note"),
      at: new Date().toISOString()
    });
  }, "Transport Request");
  form.reset();
}

function addPhoto(form) {
  const data = new FormData(form);
  const file = data.get("photo");
  if (!file || !file.size) return;
  compressImage(file)
    .then((dataUrl) => {
      updateSelectedJob((job) => {
        job.photos.unshift({
          type: data.get("type"),
          caption: data.get("caption"),
          dataUrl,
          by: currentProfile().name,
          at: new Date().toISOString()
        });
      }, "Photo Added");
      form.reset();
    })
    .catch(() => alert("Could not read that photo. Please try another image."));
}

function compressImage(file, maxSize = 1280, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Photo read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Photo decode failed"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function addTeamMember(form) {
  const data = new FormData(form);
  const creator = currentProfile();
  const role = data.get("role");
  const managementRole = ["Supervisor", "Admin", "HR"].includes(role);
  const workerType = managementRole ? "Management" : data.get("workerType");
  const expiresAt = data.get("expiresAt");
  if (workerType === "Outsource" && !expiresAt) {
    alert("Temporary outsource members need an access expiry date.");
    return;
  }
  const approved = creator.role === "Owner";
  const prefix = { Worker: "wrk", Driver: "drv", Supervisor: "sup", Admin: "adm", HR: "hr" }[role] || "usr";
  const profile = {
    id: `${prefix}-${Date.now()}`,
    name: data.get("name"),
    role,
    phone: data.get("phone"),
    skill: data.get("skill"),
    accessStatus: "Active",
    approvalStatus: approved ? "Approved" : "Pending",
    workerType,
    createdBy: creator.name,
    createdAt: new Date().toISOString()
  };
  if (role === "Driver") profile.vehicle = data.get("skill");
  if (managementRole) profile.canManage = true;
  if (expiresAt) profile.expiresAt = expiresAt;
  if (approved) {
    profile.approvedBy = creator.name;
    profile.approvedAt = new Date().toISOString();
  }
  state.profiles.push(profile);
  queueSync(approved ? "Team Member Added" : "Team Member Awaiting Owner Approval", "WORKFORCE", profile);
  form.reset();
  render();
}

function approveProfile(profileId) {
  if (currentProfile().role !== "Owner") return;
  const profile = state.profiles.find((item) => item.id === profileId);
  if (!profile || isApproved(profile)) return;
  profile.approvalStatus = "Approved";
  profile.approvedBy = currentProfile().name;
  profile.approvedAt = new Date().toISOString();
  queueSync("Profile Approved", "WORKFORCE", profile);
  render();
}

function rejectProfile(profileId) {
  if (currentProfile().role !== "Owner") return;
  const profile = state.profiles.find((item) => item.id === profileId);
  if (!profile || profile.approvalStatus !== "Pending") return;
  profile.approvalStatus = "Rejected";
  profile.rejectedBy = currentProfile().name;
  profile.rejectedAt = new Date().toISOString();
  queueSync("Profile Rejected", "WORKFORCE", profile);
  render();
}

function saveSlackSettings(form) {
  const data = new FormData(form);
  state.slack.channel = data.get("channel") || "#mts-field-updates";
  state.slack.channelId = data.get("channelId") || "C0BFZLRJ8AX";
  state.slack.relayUrl = data.get("relayUrl") || "";
  state.slack.notify = {
    assignments: data.get("assignments") === "on",
    issues: data.get("issues") === "on",
    materials: data.get("materials") === "on",
    photos: data.get("photos") === "on"
  };
  state.slack.alerts.unshift(buildSlackAlert("Slack Settings Updated", "MTS", {
    customer: "MTS Operations",
    service: "Slack notification setup",
    status: state.slack.relayUrl ? "Ready" : "Needs Relay",
    priority: "Normal"
  }));
  saveState();
  render();
}

async function sendSlackAlert(alertId) {
  const alert = state.slack.alerts.find((item) => item.id === alertId);
  if (!alert) return;
  if (!state.slack.relayUrl) {
    alert.status = "Needs Relay";
    alert.error = "Add a backend relay URL first.";
    render();
    return;
  }
  alert.status = "Sending";
  render();
  try {
    const response = await fetch(state.slack.relayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "mts-field-ops",
        alert,
        sentBy: currentProfile().name,
        sentAt: new Date().toISOString()
      })
    });
    if (!response.ok) throw new Error(`Relay returned ${response.status}`);
    alert.status = "Sent";
    alert.sentAt = new Date().toISOString();
    alert.error = "";
  } catch (error) {
    alert.status = "Failed";
    alert.error = error.message;
  }
  render();
}

function sendPendingSlackAlerts() {
  state.slack.alerts
    .filter((alert) => !["Sent", "Sending"].includes(alert.status))
    .slice()
    .reverse()
    .forEach((alert) => sendSlackAlert(alert.id));
}

function saveZohoSettings(form) {
  const data = new FormData(form);
  state.zoho.relayUrl = data.get("zohoRelayUrl") || "";
  saveState();
  render();
}

async function sendSyncItem(itemId) {
  const item = state.syncQueue.find((entry) => entry.id === itemId);
  if (!item || item.status === "Synced" || item.status === "Sending") return;
  if (!state.zoho.relayUrl) {
    item.error = "Add a backend sync URL first, for example http://localhost:8787/api/zoho/sync";
    render();
    return;
  }
  item.status = "Sending";
  item.error = "";
  render();
  try {
    const response = await fetch(state.zoho.relayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "mts-field-ops",
        event: item,
        sentBy: currentProfile().name,
        sentAt: new Date().toISOString()
      })
    });
    if (!response.ok) throw new Error(`Backend returned ${response.status}`);
    item.status = "Synced";
    item.syncedAt = new Date().toISOString();
  } catch (error) {
    item.status = "Pending";
    item.error = error.message;
  }
  render();
}

function syncAllPending() {
  state.syncQueue
    .filter((item) => item.status === "Pending")
    .slice()
    .reverse()
    .forEach((item) => sendSyncItem(item.id));
}

function toggleAccess(profileId) {
  const profile = state.profiles.find((item) => item.id === profileId);
  if (!profile) return;
  profile.accessStatus = profile.accessStatus === "Revoked" ? "Active" : "Revoked";
  profile.accessChangedAt = new Date().toISOString();
  profile.accessChangedBy = currentProfile().name;
  queueSync(`Worker Access ${profile.accessStatus}`, "WORKFORCE", profile);
  render();
}

function captureLocation() {
  if (!navigator.geolocation) {
    alert("GPS is not available in this browser.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      updateSelectedJob((job) => {
        job.locations.unshift({
          profileId: currentProfile().id,
          by: currentProfile().name,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          at: new Date().toISOString()
        });
      }, "GPS Check-In");
    },
    () => alert("Location permission was not allowed.")
  );
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mts-field-ops-export-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/* ────────────────────────────────────────────
   MASTER CODE LOCK (device gate for the owner)
   Note: this is a device-level access gate for a
   static app, not bank-grade encryption. It keeps
   the app closed until the master code is entered.
   ──────────────────────────────────────────── */
function renderLock() {
  const overlay = byId("lockOverlay");
  const shell = document.querySelector(".app-shell");
  if (!overlay) return;
  const needsSetup = !state.security.masterCodeHash;
  const locked = state.security.lockEnabled && !unlocked;

  overlay.classList.toggle("hidden", !locked);
  if (shell) shell.classList.toggle("blurred", locked);

  byId("lockSetup").classList.toggle("hidden", !needsSetup);
  byId("lockEnter").classList.toggle("hidden", needsSetup);
  const err = byId("lockError");
  if (err) err.textContent = "";

  const lockBtn = byId("lockButton");
  if (lockBtn) lockBtn.classList.toggle("hidden", !state.security.masterCodeHash || !unlocked);
}

function setupMasterCode(form) {
  const data = new FormData(form);
  const code = String(data.get("code") || "").trim();
  const confirm = String(data.get("confirm") || "").trim();
  const err = byId("lockError");
  if (code.length < 4) { if (err) err.textContent = "Use at least 4 characters."; return; }
  if (code !== confirm) { if (err) err.textContent = "The two codes do not match."; return; }
  state.security.masterCodeHash = hashCode(code);
  unlocked = true;
  saveState();
  renderLock();
  render();
}

function submitMasterCode(form) {
  const data = new FormData(form);
  const code = String(data.get("code") || "").trim();
  const err = byId("lockError");
  if (hashCode(code) === state.security.masterCodeHash) {
    unlocked = true;
    renderLock();
    render();
  } else if (err) {
    err.textContent = "Wrong master code.";
    form.reset();
  }
}

function lockApp() {
  unlocked = false;
  renderLock();
}

/* ────────────────────────────────────────────
   INSPECTION REPORTS (owner-only edit, all view)
   ──────────────────────────────────────────── */
const INSPECTION_CHECKLIST = [
  "AC cooling & gas",
  "Electrical points & DB",
  "Plumbing & leaks",
  "Paint & wall condition",
  "Safety & fire points",
  "General handyman items"
];

function renderInspections() {
  const view = byId("inspectView");
  if (!view) return;
  const owner = canEditInspections();
  const newBtn = byId("newInspectionButton");
  if (newBtn) newBtn.classList.toggle("hidden", !owner);
  const gate = byId("inspectGateNote");
  if (gate) gate.classList.toggle("hidden", owner);

  hydrateInspectionJobOptions();

  const list = byId("inspectionList");
  if (!list) return;
  if (!state.inspections.length) {
    list.innerHTML = `<div class="empty-state"><h3>No inspection reports yet</h3><p>${owner ? "Tap New Inspection to run one on site." : "Reports added by the owner will appear here."}</p></div>`;
    return;
  }
  list.innerHTML = state.inspections
    .map((rep) => {
      const rows = (rep.items || [])
        .map((it) => `<li><span class="ins-item">${escapeHtml(it.item)}</span> <span class="ins-res ins-${(it.result || "").toLowerCase()}">${escapeHtml(it.result || "-")}</span>${it.note ? `<span class="ins-note">${escapeHtml(it.note)}</span>` : ""}</li>`)
        .join("");
      return `<article class="panel inspection-card">
        <div class="inspection-head">
          <div>
            <h3>${escapeHtml(rep.site)}</h3>
            <p class="small">${escapeHtml(rep.location || "")} · ${new Date(rep.at).toLocaleString()}</p>
          </div>
          <span class="status-pill ins-overall-${(rep.overall || "").toLowerCase().replace(/\s+/g, "-")}">${escapeHtml(rep.overall || "")}</span>
        </div>
        <p class="small">Inspector: ${escapeHtml(rep.inspector || "")}</p>
        <ul class="inspection-items">${rows}</ul>
        ${rep.summary ? `<p><strong>Summary:</strong> ${escapeHtml(rep.summary)}</p>` : ""}
        ${rep.recommendation ? `<p><strong>Recommendation:</strong> ${escapeHtml(rep.recommendation)}</p>` : ""}
        ${owner ? `<div class="actions"><button data-delete-inspection="${rep.id}">Delete</button></div>` : ""}
      </article>`;
    })
    .join("");
}

function hydrateInspectionJobOptions() {
  const sel = byId("inspectionJob");
  if (!sel) return;
  const opts = state.jobs
    .map((job) => `<option value="${job.id}">${escapeHtml(job.customer)} — ${escapeHtml(job.location)}</option>`)
    .join("");
  sel.innerHTML = `<option value="">— Site not in job list —</option>${opts}`;
}

function toggleNewInspection(show) {
  const form = byId("inspectionForm");
  if (!form) return;
  if (!byId("inspectionChecklist").children.length) {
    byId("inspectionChecklist").innerHTML = INSPECTION_CHECKLIST.map((item, i) => `
      <div class="checklist-row">
        <span class="checklist-label">${escapeHtml(item)}</span>
        <select name="result-${i}">
          <option>Pass</option>
          <option>Fail</option>
          <option>Follow-up</option>
          <option>N/A</option>
        </select>
        <input name="note-${i}" placeholder="Note (optional)">
        <input type="hidden" name="item-${i}" value="${escapeHtml(item)}">
      </div>`).join("");
  }
  form.classList.toggle("hidden", !show);
}

function createInspection(form) {
  if (!canEditInspections()) return;
  const data = new FormData(form);
  const jobId = data.get("jobId") || "";
  const job = state.jobs.find((j) => j.id === jobId);
  const items = INSPECTION_CHECKLIST.map((_, i) => ({
    item: data.get(`item-${i}`),
    result: data.get(`result-${i}`),
    note: (data.get(`note-${i}`) || "").trim()
  }));
  const anyFail = items.some((it) => it.result === "Fail");
  const anyFollow = items.some((it) => it.result === "Follow-up");
  const overall = anyFail ? "Fail" : anyFollow ? "Follow-up" : "Pass";
  const inspection = {
    id: `INS-${Date.now()}`,
    jobId,
    site: (data.get("site") || job?.customer || "Site").trim(),
    location: (data.get("location") || job?.location || "").trim(),
    inspector: currentProfile().name,
    items,
    overall,
    summary: (data.get("summary") || "").trim(),
    recommendation: (data.get("recommendation") || "").trim(),
    at: new Date().toISOString()
  };
  state.inspections.unshift(inspection);
  queueSync("Inspection Report", jobId || "INSPECTION", inspection);
  form.reset();
  byId("inspectionChecklist").innerHTML = "";
  toggleNewInspection(false);
  render();
}

function deleteInspection(id) {
  if (!canEditInspections()) return;
  state.inspections = state.inspections.filter((rep) => rep.id !== id);
  render();
}

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloadedForUpdate) return;
    reloadedForUpdate = true;
    location.reload();
  });
}

render();
renderLock();

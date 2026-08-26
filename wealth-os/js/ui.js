/* ============================================================
   Wealth OS — UI plumbing
   Router, modals, toasts and the small render helpers every view shares.
   ============================================================ */
"use strict";

/* ------------------------------------------------------------ router --- */
/* Seven tabs plus a set of sub-pages reached from cards. A sub-page keeps its
   parent tab highlighted so you always know where you are in the app. */
const TABS = ["home", "money", "budget", "invest", "plan", "advisor", "more"];
const SUBPAGES = {
  flow:      { title: "Cashflow forecast",   parent: "home" },
  calendar:  { title: "Spending calendar",   parent: "money" },
  recurring: { title: "Recurring & subscriptions", parent: "money" },
  import:    { title: "Import",              parent: "money" },
  income:    { title: "Income",              parent: "money" },
  rules:     { title: "Categorisation rules", parent: "money" },
  reports:   { title: "Reports",             parent: "advisor" },
  sips:      { title: "SIP schedule",        parent: "invest" },
  history:   { title: "Net worth history",   parent: "plan" },
  debt:      { title: "Debt plan",           parent: "more" },
  accounts:  { title: "Accounts & pots",     parent: "more" },
  settings:  { title: "Assumptions & data",  parent: "more" },
  search:    { title: "Search",              parent: "more" },
  help:      { title: "How this works",      parent: "more" },
};

let route = { view: "home", param: null };

function parseHash() {
  const raw = (location.hash || "#/home").replace(/^#\/?/, "");
  const [view, param] = raw.split("/");
  if (TABS.includes(view) || SUBPAGES[view]) return { view, param: param || null };
  return { view: "home", param: null };
}

function go(view, param) {
  location.hash = "#/" + view + (param ? "/" + param : "");
}

function applyRoute() {
  route = parseHash();
  const parent = SUBPAGES[route.view] ? SUBPAGES[route.view].parent : route.view;
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === parent));
  window.scrollTo({ top: 0, behavior: "instant" });
  render();
}

/* ------------------------------------------------------------- toast --- */
function toast(msg, action) {
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span>${esc(msg)}</span>`;
  if (action) {
    const b = document.createElement("button");
    b.className = "toast-action";
    b.textContent = action.label;
    b.onclick = () => { el.remove(); action.run(); };
    el.appendChild(b);
    el.style.pointerEvents = "auto";
  }
  $("#toastRoot").appendChild(el);
  setTimeout(() => el.remove(), action ? 6000 : 2600);
}

/* ------------------------------------------------------------- modal --- */
function closeModal() { $("#modalRoot").innerHTML = ""; }

function openModal(title, bodyHTML, onSubmit, opts = {}) {
  $("#modalRoot").innerHTML = `
    <div class="modal-back">
      <form class="modal" id="modalForm" ${opts.wide ? 'style="max-width:720px"' : ""}>
        <div class="modal-head">
          <h3>${esc(title)}</h3>
          <button type="button" class="icon-btn" id="mClose" aria-label="Close">✕</button>
        </div>
        ${bodyHTML}
        <div class="modal-actions">
          ${opts.danger ? `<button type="button" class="btn btn-danger" id="mDelete">${esc(opts.dangerLabel || "Delete")}</button>` : ""}
          <button type="button" class="btn btn-ghost" id="mCancel">${esc(opts.cancel || "Cancel")}</button>
          ${opts.noSubmit ? "" : `<button type="submit" class="btn btn-accent">${esc(opts.submit || "Save")}</button>`}
        </div>
      </form>
    </div>`;
  $("#mCancel").onclick = closeModal;
  $("#mClose").onclick = closeModal;
  $(".modal-back").onclick = (e) => { if (e.target.classList.contains("modal-back")) closeModal(); };
  if (opts.danger) $("#mDelete").onclick = () => { opts.danger(); closeModal(); render(); };
  $("#modalForm").onsubmit = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    if (onSubmit(data) === false) return;   // a validator may keep the sheet open
    closeModal();
    render();
  };
  if (opts.onMount) opts.onMount();
  const first = $("#modalForm input:not([type=hidden]), #modalForm select, #modalForm textarea");
  if (first && !opts.noFocus) setTimeout(() => first.focus(), 60);
}

function confirmModal(title, message, onYes, yesLabel = "Confirm") {
  openModal(title, `<p class="modal-copy">${esc(message)}</p>`, () => { onYes(); }, { submit: yesLabel });
}

/* -------------------------------------------------------- form fields -- */
function field(name, label, value, type = "text", extra = "") {
  return `<label class="field"><span>${esc(label)}</span>
    <input name="${name}" type="${type}" value="${esc(value ?? "")}" ${extra} /></label>`;
}
function textArea(name, label, value, extra = "") {
  return `<label class="field"><span>${esc(label)}</span>
    <textarea name="${name}" ${extra}>${esc(value ?? "")}</textarea></label>`;
}
function selectField(name, label, value, options) {
  return `<label class="field"><span>${esc(label)}</span><select name="${name}">
    ${options.map((o) => {
      const v = typeof o === "string" ? o : o.value;
      const l = typeof o === "string" ? o : o.label;
      return `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(l)}</option>`;
    }).join("")}
  </select></label>`;
}
function accountSelect(name, label, value, s = state) {
  return selectField(name, label, value,
    [{ value: "", label: "Not linked to an account" }]
      .concat(s.accounts.map((a) => ({ value: a.id, label: `${a.name} — ${money(a.balance)}` }))));
}

/* --------------------------------------------------- layout helpers ---- */
function statBlock(items) {
  return `<div class="stats">${items.map((i) => `
    <div class="stat ${i.tone || ""}" ${i.goto ? `data-goto="${esc(i.goto)}" role="button" tabindex="0"` : ""}>
      <div class="k">${esc(i.k)}</div>
      <div class="v">${i.v}</div>
      ${i.n ? `<div class="n">${esc(i.n)}</div>` : ""}
    </div>`).join("")}</div>`;
}

function card(title, sub, body, action) {
  return `<div class="card">
    ${title ? `<div class="card-head">
      <div><h2>${esc(title)}</h2>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>
      ${action || ""}
    </div>` : ""}
    ${body}
  </div>`;
}

function linkBtn(label, view) {
  return `<button class="btn btn-sm btn-ghost" data-goto="${esc(view)}">${esc(label)} →</button>`;
}

function kv(k, v, cls = "", sub = "") {
  return `<div class="kv"><span class="k">${esc(k)}${sub ? `<br><span class="muted" style="font-size:11.5px">${esc(sub)}</span>` : ""}</span>
    <span class="v ${cls}">${v}</span></div>`;
}

function pill(text, tone) { return `<span class="pill ${tone || ""}">${esc(text)}</span>`; }

function emptyState(msg, actionLabel, actionAttr) {
  return `<div class="empty">${esc(msg)}
    ${actionLabel ? `<div style="margin-top:12px"><button class="btn btn-sm" ${actionAttr}>${esc(actionLabel)}</button></div>` : ""}
  </div>`;
}

/* Page header used by every sub-page, with a back arrow to its parent tab. */
function subHeader(key) {
  const meta = SUBPAGES[key];
  return `<div class="subhead">
    <button class="icon-btn" data-goto="${esc(meta.parent)}" aria-label="Back">←</button>
    <h1>${esc(meta.title)}</h1>
  </div>`;
}

function tone(value, good, warnAt) {
  if (value <= good) return "good";
  if (value <= warnAt) return "warn";
  return "bad";
}

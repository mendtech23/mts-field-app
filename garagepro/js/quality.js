/* mendtech. — quality (v3.8)
   · Comebacks: mark a job as a comeback of an earlier job on the same car (reason + note). The KPI page counts them per
     technician (the technician of the first job).
   · Private feedback: after delivery, send the customer a 10-second link (feedback.html#token) to rate the job 1–5.
     3 or less → an alert in Staff & security so you can call them; 4–5 → the page offers your Google review link. */
'use strict';

const COMEBACK_REASONS = ['Same fault not fixed', 'Part failed', 'Workmanship', 'Wrong diagnosis', 'Other'];
const previousJobs = j => S.jobs.filter(p => p.id !== j.id && p.vehicleId === j.vehicleId && p.status !== 'Cancelled' && (p.date || '') <= (j.date || today()) && daysBetween(p.date || today(), j.date || today()) <= 180)
  .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
function qualityCardHTML(j) {
  if (isMobile(j) && !j.comebackOf && !j.feedback && !feedbackOn()) return '';
  let cb = '';
  if (j.comebackOf) {
    const o = get('jobs', j.comebackOf);
    cb = `<div class="card-pad small" style="background:var(--redSoft)">↩ <b>Comeback</b> of <a onclick="go('#/job/${j.comebackOf}')">${esc(o ? o.number : 'an earlier job')}</a>${o ? ` (${fmtDate(o.date)}${o.technicianId ? ', ' + esc(techName(o.technicianId)) : ''})` : ''}
      · ${esc(j.comebackReason || '')}${j.comebackNote ? `<div class="muted">${esc(j.comebackNote)}</div>` : ''} <a onclick="unmarkComeback()">remove</a></div>`;
  } else {
    const recent = previousJobs(j).find(p => DONE_JOB.includes(p.status) && daysBetween((p.completed || p.date).slice(0, 10), j.date || today()) <= 30);
    cb = `<div class="card-pad small">${recent ? `This car was here ${daysBetween((recent.completed || recent.date).slice(0, 10), j.date || today())} day(s) before (<a onclick="go('#/job/${recent.id}')">${esc(recent.number)}</a>). Same problem? ` : ''}
      <button class="btn sm" onclick="markComeback()">↩ Mark as comeback</button></div>`;
  }
  const fb = j.feedback;
  const fbHTML = fb ? `<div class="card-pad small">Customer rating <b class="${num(fb.rating) <= 3 ? 'red' : 'green'}">${'★'.repeat(num(fb.rating))}${'☆'.repeat(5 - num(fb.rating))}</b> ${fmtDate((fb.at || '').slice(0, 10))}${fb.comment ? `<div class="muted">“${esc(fb.comment)}”</div>` : ''}</div>`
    : feedbackLinksOn() && DONE_JOB.includes(j.status) ? `<div class="card-pad small"><button class="btn sm" onclick="askFeedback('${j.id}')">⭐ Ask for private feedback</button> <span class="muted">${j.feedbackAsked ? 'asked ' + fmtDate(j.feedbackAsked.slice(0, 10)) : 'a 10-second rating link by WhatsApp'}</span></div>` : '';
  return `<div class="card mb"><div class="card-head"><h3>✔ Quality</h3></div>${cb}${fbHTML}</div>`;
}
function markComeback() {
  const j = ED.doc, prev = previousJobs(j);
  if (!prev.length) return toast('No earlier job on this car in the last 6 months', 'err');
  openForm({
    title: 'Comeback — which job came back?', saveLabel: 'Mark as comeback',
    fields: [{ k: 'comebackOf', label: 'Earlier job', type: 'select', req: true, blank: false, options: prev.map(p => [p.id, `${p.number} · ${fmtDate(p.date)} · ${techName(p.technicianId) || 'no technician'} · ${(p.complaint || p.diagnosis || '').slice(0, 40)}`]) },
      { k: 'comebackReason', label: 'Why', type: 'select', req: true, blank: false, options: COMEBACK_REASONS }, { k: 'comebackNote', label: 'Note (optional)', type: 'textarea', span: 'all' }],
    onSave: async v => { Object.assign(j, v); await save('jobs', j); toast('Marked as comeback — it counts on the KPI page', 'ok'); render(); },
  });
}
async function unmarkComeback() { const j = ED.doc; if (!(await confirmBox('Remove the comeback mark from this job?', 'Remove'))) return; delete j.comebackOf; delete j.comebackReason; delete j.comebackNote; await save('jobs', j); render(); }

/* ---- private feedback ---- */
const feedbackOn = () => !!(S.settings.offers || {}).feedbackOn;
const feedbackLinksOn = () => typeof quoteLinksOn === 'function' && quoteLinksOn();   // the link needs the cloud (same as quotation links)
function feedbackLink(j) {
  if (!j.feedbackToken) { const b = crypto.getRandomValues(new Uint8Array(24)); j.feedbackToken = btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  return location.origin + location.pathname.replace(/[^/]*$/, '') + 'feedback.html#' + j.feedbackToken;
}
async function askFeedback(jobId) {
  const j = get('jobs', jobId); if (!j) return;
  if (!feedbackLinksOn()) return toast('Feedback links need the cloud (personal logins)', 'err');
  const link = feedbackLink(j); j.feedbackAsked = new Date().toISOString(); await save('jobs', j);
  const v = vehicleOf(j), c = customerOf(j);
  const text = fillTemplate(S.settings.templates.feedback || DEFAULT_SETTINGS.templates.feedback, { ...baseCtx(v, c), number: j.number, feedbackLink: link });
  openMessageDialog({ customer: c, vehicle: v, type: 'feedback', text });
  if (ED.doc && ED.doc.id === j.id) render();
}
/* when a car is delivered: offer to send the feedback link (only if switched on in Settings) */
async function offerFeedbackOnDelivery(j) {
  if (!feedbackOn() || !feedbackLinksOn() || j.feedback || j.feedbackAsked) return;
  if (await confirmBox(`Send ${(customerOf(j) || {}).name || 'the customer'} a 10-second private feedback link?`, 'Send link', false, 'Not now')) askFeedback(j.id);
}

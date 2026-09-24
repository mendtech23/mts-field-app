/* GaragePro — repair photos (before / during / after) as documented proof */
'use strict';

const PHOTO_STAGES = ['Before', 'During', 'After'];
const STAGE_COLOR = { Before: 'red', During: 'amber', After: 'green' };

function compressImage(file, maxSide = 1600, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve({ data: c.toDataURL('image/jpeg', quality), w: c.width, h: c.height });
    };
    img.onerror = () => reject(new Error('Could not read image ' + file.name));
    img.src = URL.createObjectURL(file);
  });
}
async function photosForJob(jobId) { return (await DB.byIndex('photos', 'jobId', jobId)).sort((a, b) => PHOTO_STAGES.indexOf(a.stage) - PHOTO_STAGES.indexOf(b.stage) || a.date.localeCompare(b.date)); }
async function photosForVehicle(vid) { return (await DB.byIndex('photos', 'vehicleId', vid)).sort((a, b) => a.date.localeCompare(b.date)); }

async function addPhotos(files, stage, jobId) {
  const job = get('jobs', jobId); if (!job || !files || !files.length) return;
  toast(`Saving ${files.length} photo(s)…`);
  for (const f of files) {
    try {
      const im = await compressImage(f);
      const now = new Date().toISOString();
      await DB.put('photos', { id: uid(), jobId, vehicleId: job.vehicleId, stage, caption: '', date: now, updatedAt: now, by: currentUserName(), ...im });
      syncDirty();
    } catch (e) { toast(e.message, 'err'); }
  }
  toast('Photos saved', 'ok');
  drawJobPhotos(jobId);
}
async function updatePhoto(id, patch) {
  const all = await DB.byIndex('photos', 'jobId', patch.jobId);
  const p = all.find(x => x.id === id); if (!p) return;
  Object.assign(p, patch, { updatedAt: new Date().toISOString() }); await DB.put('photos', p); syncDirty();
}
async function deletePhoto(id, jobId) {
  if (!(await confirmBox('Delete this photo?', 'Delete', true))) return;
  await DB.del('photos', id); await addTombstone('photos', id); drawJobPhotos(jobId);
}
function viewPhoto(p) {
  openModal({
    title: `${esc(p.stage)} photo ${p.caption ? '— ' + esc(p.caption) : ''}`, size: 'xwide',
    body: `<img src="${p.data}" style="width:100%;border-radius:8px;display:block"><div class="small muted mt-s">${new Date(p.date).toLocaleString('en-GB')}</div>`,
  });
}
const PHOTO_CACHE = {};
async function openPhoto(id) { const p = PHOTO_CACHE[id]; if (p) viewPhoto(p); }

function jobPhotosCardHTML(j) {
  return `<div class="card mb"><div class="card-head"><h3>📷 Photos — documented proof</h3><div class="actions">
    ${PHOTO_STAGES.map(s => `<label class="btn sm">＋ ${s}<input type="file" accept="image/*" multiple hidden onchange="addPhotos(this.files,'${s}','${j.id}');this.value=''"></label>`).join('')}
    <button class="btn sm dark" onclick="photoReport('${j.id}')">📄 Photo report</button></div></div>
    <div class="card-pad" id="photoBox"><span class="faint">Loading photos…</span></div></div>`;
}
async function drawJobPhotos(jobId) {
  const box = $('#photoBox'); if (!box) return;
  const ps = await photosForJob(jobId);
  ps.forEach(p => PHOTO_CACHE[p.id] = p);
  if (!ps.length) { box.innerHTML = `<div class="muted">No photos yet. Take pictures of the damage / worn parts <b>before</b> you start, and of the finished work <b>after</b> — proof for the customer and for warranty or insurance claims. On a phone or tablet the buttons open the camera.</div>`; return; }
  box.innerHTML = PHOTO_STAGES.filter(s => ps.some(p => p.stage === s)).map(s => `<div class="insp-cat" style="margin-top:4px">${s} (${ps.filter(p => p.stage === s).length})</div>
    <div class="photos-grid">${ps.filter(p => p.stage === s).map(p => `<div class="ph"><img src="${p.data}" onclick="openPhoto('${p.id}')" alt="">
      <button class="icon-btn del" title="Delete" onclick="deletePhoto('${p.id}','${jobId}')">✕</button>
      <select class="inp sm" onchange="updatePhoto('${p.id}',{jobId:'${jobId}',stage:this.value}).then(()=>drawJobPhotos('${jobId}'))">${PHOTO_STAGES.map(x => `<option ${x === p.stage ? 'selected' : ''}>${x}</option>`).join('')}</select>
      <input class="inp sm" placeholder="Caption e.g. worn brake pad" value="${esc(p.caption || '')}" onchange="updatePhoto('${p.id}',{jobId:'${jobId}',caption:this.value})"></div>`).join('')}</div>`).join('');
}
/* thumbnails inside the vehicle history */
async function hydrateVisitPhotos(vid) {
  const els = document.querySelectorAll('.vph[data-job]'); if (!els.length) return;
  const ps = await photosForVehicle(vid);
  ps.forEach(p => PHOTO_CACHE[p.id] = p);
  els.forEach(el => {
    const mine = ps.filter(p => p.jobId === el.dataset.job);
    el.innerHTML = mine.length ? `<div class="row mt-s" style="gap:6px">${mine.map(p => `<div style="position:relative"><img src="${p.data}" class="thumb" onclick="event.stopPropagation();openPhoto('${p.id}')" title="${esc(p.stage)} ${esc(p.caption || '')}"><span class="pill ${STAGE_COLOR[p.stage]}" style="position:absolute;left:2px;bottom:2px;font-size:9.5px;padding:0 5px">${esc(p.stage)}</span></div>`).join('')}</div>` : '';
  });
}

/* ---------- photo report (print / PDF / share) ---------- */
function photoReportHTML(j, ps) {
  const v = vehicleOf(j) || {}, c = customerOf(j) || {};
  return `<div class="docv">${printHeader('PHOTO REPORT', [['Job No.', j.number], ['Date', fmtDate(j.date)], ['Photos', ps.length]])}
    <div class="boxes"><div class="box"><div class="bt">Customer</div><b>${esc(c.name || '')}</b><br>${esc(c.phone || '')}</div>
    <div class="box"><div class="bt">Vehicle</div><b>${esc(v.plate || '')}</b> ${esc(vehicleLabel(v))}<br>VIN: ${esc(v.vin || '—')}<br>Odometer: ${fmtNum(j.odometer)} km</div></div>
    ${j.complaint ? `<div class="box" style="margin-bottom:10px"><div class="bt">Customer request</div>${esc(j.complaint)}</div>` : ''}
    ${j.diagnosis ? `<div class="box" style="margin-bottom:10px"><div class="bt">Work carried out</div>${esc(j.diagnosis)}</div>` : ''}
    ${PHOTO_STAGES.filter(s => ps.some(p => p.stage === s)).map(s => `<h3 style="margin:14px 0 8px;color:#c2410c">${s} repair</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${ps.filter(p => p.stage === s).map(p => `<div style="break-inside:avoid;border:1px solid #ddd;border-radius:6px;padding:6px"><img src="${p.data}" style="width:100%;max-height:260px;object-fit:contain;display:block"><div style="font-size:11px;margin-top:4px"><b>${esc(p.caption || s)}</b> <span style="color:#777">${new Date(p.date).toLocaleString('en-GB')}</span></div></div>`).join('')}</div>`).join('')}
  </div>`;
}
async function photoReportPDF(j, ps) {
  await ensurePdfLibs();
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const st = S.settings, v = vehicleOf(j) || {}, c = customerOf(j) || {}, M = 14, W = 210;
  const safe = s => String(s ?? '').replace(/[‒-―−]/g, '-').replace(/[^\x00-\xFF]/g, '');
  let y = 16;
  if (st.logo) { try { const pr = pdf.getImageProperties(st.logo); const h = 16, w = Math.min(40, pr.width * h / pr.height); pdf.addImage(st.logo, M, y - 4, w, w * pr.height / pr.width); } catch (e) { } }
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.setTextColor(234, 88, 12); pdf.text('PHOTO REPORT', W - M, y, { align: 'right' });
  pdf.setFontSize(9); pdf.setTextColor(30); pdf.setFont('helvetica', 'normal');
  pdf.text(safe(`${st.garageName} · ${contactLine()}`), W - M, y + 5, { align: 'right' });
  pdf.text(safe(`Job ${j.number} · ${fmtDate(j.date)}`), W - M, y + 10, { align: 'right' });
  y += 18; pdf.setDrawColor(234, 88, 12); pdf.setLineWidth(0.7); pdf.line(M, y, W - M, y); y += 7;
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.text(safe(`${v.plate || ''}  ${vehicleLabel(v)}`), M, y);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
  pdf.text(safe(`Customer: ${c.name || ''} ${c.phone || ''}   ·   VIN: ${v.vin || '-'}   ·   Odometer: ${fmtNum(j.odometer)} km`), M, y + 5);
  y += 10;
  if (j.diagnosis) { const l = pdf.splitTextToSize(safe('Work carried out: ' + j.diagnosis), W - 2 * M); pdf.text(l, M, y); y += l.length * 4 + 3; }
  const colW = (W - 2 * M - 6) / 2, imgH = 68;
  for (const s of PHOTO_STAGES) {
    const list = ps.filter(p => p.stage === s); if (!list.length) continue;
    if (y + 10 > 280) { pdf.addPage(); y = 16; }
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(194, 65, 12); pdf.text(`${s.toUpperCase()} REPAIR`, M, y + 4); pdf.setTextColor(30); y += 8;
    for (let i = 0; i < list.length; i += 2) {
      if (y + imgH + 10 > 287) { pdf.addPage(); y = 16; }
      for (let k = 0; k < 2 && i + k < list.length; k++) {
        const p = list[i + k], x = M + k * (colW + 6);
        const r = Math.min(colW / p.w, imgH / p.h), w = p.w * r, h = p.h * r;
        pdf.setDrawColor(220); pdf.rect(x, y, colW, imgH + 8);
        pdf.addImage(p.data, 'JPEG', x + (colW - w) / 2, y + (imgH - h) / 2, w, h);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
        pdf.text(safe(`${p.caption || s} - ${new Date(p.date).toLocaleString('en-GB')}`).slice(0, 70), x + 2, y + imgH + 5);
      }
      y += imgH + 12;
    }
  }
  return new File([pdf.output('blob')], `PHOTO_REPORT_${j.number}_${norm(v.plate)}.pdf`, { type: 'application/pdf' });
}
async function photoReport(jobId) {
  if (typeof edFlush === 'function') await edFlush();
  const j = get('jobs', jobId), ps = await photosForJob(jobId);
  if (!ps.length) return toast('Add some photos first', 'err');
  const m = openModal({
    title: `Photo report — ${esc(j.number)}`, size: 'xwide', body: `<div style="background:#e5e7eb;padding:16px;border-radius:8px">${photoReportHTML(j, ps)}</div>`,
    foot: `<button class="btn" data-print>🖨 Print</button><button class="btn" data-pdf>⬇ Download PDF</button>${canShareFiles() ? '<button class="btn dark" data-share>📤 Share PDF…</button>' : ''}<button class="btn wa" data-wa>WhatsApp customer</button>`
  });
  m.el.querySelector('[data-print]').onclick = () => printHTML(photoReportHTML(j, ps));
  m.el.querySelector('[data-pdf]').onclick = async () => { try { const f = await photoReportPDF(j, ps); downloadBlob(f, f.name); } catch (e) { toast(e.message, 'err'); } };
  if (canShareFiles()) m.el.querySelector('[data-share]').onclick = async () => { try { const f = await photoReportPDF(j, ps); await navigator.share({ files: [f], title: f.name }); } catch (e) { if (e.name !== 'AbortError') toast(e.message, 'err'); } };
  m.el.querySelector('[data-wa]').onclick = async () => {
    try { const f = await photoReportPDF(j, ps); downloadBlob(f, f.name); } catch (e) { }
    const v = vehicleOf(j), c = customerOf(j);
    openMessageDialog({ vehicle: v, customer: c, type: 'photos', text: `Dear ${c ? c.name : 'Customer'},\n\nPlease find attached the before & after photos of the work carried out on your ${vehicleLabel(v)} (${v ? v.plate : ''}), job ${j.number}.\n\n${S.settings.garageName}\n${S.settings.phone}` });
  };
}

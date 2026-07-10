/* ═══════════════════════════════════════════════════════════
   MENDONCA TECHNICAL SERVICES — main.js
   Three.js wireframe villa · ember shaders · cinematic scroll
   ═══════════════════════════════════════════════════════════ */

import * as THREE from "three";

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const TOUCH = window.matchMedia("(hover: none), (pointer: coarse)").matches;
const HAS_GSAP = typeof window.gsap !== "undefined";
const HAS_ST = HAS_GSAP && typeof window.ScrollTrigger !== "undefined";
const HAS_LENIS = typeof window.Lenis !== "undefined";

if (HAS_ST) gsap.registerPlugin(ScrollTrigger);
if (!HAS_GSAP || REDUCED) document.body.classList.add("no-anim");

const GOLD = new THREE.Color("#e8b368");
const GOLD_HI = new THREE.Color("#f5d08a");
const EMBER = new THREE.Color("#ff9d45");
const WATER = new THREE.Color("#4aa8ff");

/* ────────────────────────────────────────────
   SMOOTH SCROLL (Lenis)
   ──────────────────────────────────────────── */
let lenis = null;
if (HAS_LENIS && !REDUCED) {
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1.0 });
  if (HAS_ST) lenis.on("scroll", ScrollTrigger.update);
  window.__lenis = lenis;
}

/* ────────────────────────────────────────────
   3D SCENE
   ──────────────────────────────────────────── */
let renderer = null, scene, camera;
let villa, embers, dust, gridHelper;
let camPathPos, camPathTgt;
const smooth = { progress: 0, mx: 0, my: 0 };
const pointer = { x: 0, y: 0 };

function glowTexture(inner, outer) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, outer);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function lineMat(color, opacity) {
  return new THREE.LineBasicMaterial({
    color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
}

function boxEdges(w, h, d, x, y, z, mat) {
  const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
  const seg = new THREE.LineSegments(geo, mat);
  seg.position.set(x, y, z);
  return seg;
}

function rect(w, h, x, y, z, mat, rotY = 0) {
  const pts = [
    new THREE.Vector3(-w / 2, -h / 2, 0),
    new THREE.Vector3(w / 2, -h / 2, 0),
    new THREE.Vector3(w / 2, h / 2, 0),
    new THREE.Vector3(-w / 2, h / 2, 0),
  ];
  const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mat);
  loop.position.set(x, y, z);
  loop.rotation.y = rotY;
  return loop;
}

function buildVilla() {
  const g = new THREE.Group();
  const gold = lineMat(GOLD, 0.85);
  const goldSoft = lineMat(GOLD, 0.4);
  const water = lineMat(WATER, 0.5);

  // platform + volumes
  g.add(boxEdges(12.5, 0.16, 9.2, 0, 0.08, 0, goldSoft));
  g.add(boxEdges(8, 2.7, 5.2, 0, 1.51, 0, gold));                 // ground floor
  g.add(boxEdges(6.2, 2.5, 4.6, -0.9, 4.11, 0, gold));            // upper floor
  g.add(boxEdges(6.8, 0.16, 5.0, -0.9, 5.45, 0, gold));           // roof slab
  g.add(boxEdges(3.2, 0.14, 2.3, 2.3, 2.94, 3.4, gold));          // entrance canopy
  g.add(boxEdges(0.1, 2.7, 0.1, 3.75, 1.51, 4.35, goldSoft));     // canopy columns
  g.add(boxEdges(0.1, 2.7, 0.1, 0.95, 1.51, 4.35, goldSoft));
  g.add(boxEdges(4.5, 0.14, 2.2, -2.6, 0.24, 4.6, water));        // pool

  // ground floor windows (front face z = 2.6)
  [-2.4, -0.4, 1.6].forEach((x) => g.add(rect(1.35, 1.5, x, 1.55, 2.62, goldSoft)));
  // door
  g.add(rect(1.0, 2.1, 3.1, 1.2, 2.62, gold));
  // upper floor window band (front face z = 2.3)
  g.add(rect(5.4, 1.5, -0.9, 4.11, 2.32, gold));
  [-2.7, -1.5, -0.3, 0.9].forEach((x) => {
    const pts = [new THREE.Vector3(x, 3.36, 2.32), new THREE.Vector3(x, 4.86, 2.32)];
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), goldSoft));
  });
  // side windows (right face x = 4)
  [1.0, -1.2].forEach((z) => g.add(rect(1.3, 1.4, 4.02, 1.6, z, goldSoft, Math.PI / 2)));

  return g;
}

function buildEmbers(count) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const off = new Float32Array(count);
  const spd = new Float32Array(count);
  const siz = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = 2 + Math.random() * 7;
    const a = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = 0;
    pos[i * 3 + 2] = Math.sin(a) * r;
    off[i] = Math.random();
    spd[i] = 0.028 + Math.random() * 0.05;
    siz[i] = 7 + Math.random() * 14;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aOffset", new THREE.BufferAttribute(off, 1));
  geo.setAttribute("aSpeed", new THREE.BufferAttribute(spd, 1));
  geo.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uColorA: { value: GOLD_HI },
      uColorB: { value: EMBER },
    },
    vertexShader: `
      attribute float aOffset, aSpeed, aSize;
      uniform float uTime, uPixelRatio;
      varying float vAlpha, vMix;
      void main() {
        float t = fract(aOffset + uTime * aSpeed);
        vec3 p = position;
        p.y = t * 11.0;
        p.x += sin(uTime * 0.6 + aOffset * 43.0) * (0.25 + t * 0.9);
        p.z += cos(uTime * 0.45 + aOffset * 37.0) * (0.25 + t * 0.9);
        vAlpha = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.5, 1.0, t));
        vAlpha *= 0.7 + 0.3 * sin(uTime * 7.0 + aOffset * 90.0);
        vMix = fract(aOffset * 7.31);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * uPixelRatio * (10.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColorA, uColorB;
      varying float vAlpha, vMix;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.02, d) * vAlpha;
        if (a < 0.003) discard;
        vec3 col = mix(uColorA, uColorB, vMix);
        gl_FragColor = vec4(col, a * 0.6);
      }`,
  });
  return new THREE.Points(geo, mat);
}

function buildDust(count) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 70;
    pos[i * 3 + 1] = Math.random() * 26;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 70;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.065,
    map: glowTexture("rgba(190,210,240,1)", "rgba(120,150,200,0.4)"),
    transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
    sizeAttenuation: true,
  });
  return new THREE.Points(geo, mat);
}

function initScene() {
  const canvas = document.getElementById("scene");
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch (e) {
    document.documentElement.classList.add("no-webgl");
    return;
  }
  renderer.setClearColor(0x050810, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050810, 0.02);

  camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 220);
  camera.position.set(9.5, 4.0, 12.5);

  // floor grid
  gridHelper = new THREE.GridHelper(150, 75, 0x2a3d5c, 0x131f36);
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.5;
  scene.add(gridHelper);

  // villa
  villa = buildVilla();
  scene.add(villa);

  // fake bloom halos
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture("rgba(232,179,104,0.75)", "rgba(201,138,46,0.18)"),
    transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  halo.scale.set(18, 18, 1);
  halo.position.set(0, 2.8, 0);
  scene.add(halo);

  const haloCore = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture("rgba(245,208,138,0.9)", "rgba(232,179,104,0.2)"),
    transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  haloCore.scale.set(7, 7, 1);
  haloCore.position.set(0, 2.4, 0);
  scene.add(haloCore);

  // particles
  embers = buildEmbers(TOUCH ? 200 : 360);
  scene.add(embers);
  dust = buildDust(TOUCH ? 260 : 500);
  scene.add(dust);

  // scroll camera path
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  camPathPos = new THREE.CatmullRomCurve3(
    [v(11.5, 4.8, 16), v(-13, 6, 12), v(-2, 13, 15.5), v(-15, 3.4, -7), v(10.5, 2.6, -13), v(0.5, 6, 22)],
    false, "catmullrom", 0.5
  );
  camPathTgt = new THREE.CatmullRomCurve3(
    [v(-1.6, 2.6, 0), v(2.5, 2.0, 0), v(0, 1.2, 0), v(0, 2.6, 0), v(0, 3.2, 0), v(0, 2.8, 0)],
    false, "catmullrom", 0.5
  );

  // villa build-in
  if (HAS_GSAP && !REDUCED) {
    villa.scale.set(1, 0.001, 1);
    gsap.to(villa.scale, { y: 1, duration: 2.2, ease: "expo.out", delay: 2.3 });
  }

  window.addEventListener("resize", onResize);
  if (!TOUCH) {
    window.addEventListener("pointermove", (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    });
  }
}

function onResize() {
  if (!renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function scrollProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(window.scrollY / max, 1) : 0;
}

const _pos = new THREE.Vector3();
const _tgt = new THREE.Vector3();

function render(t) {
  if (!renderer || document.hidden) return;
  const time = t / 1000;

  smooth.progress += (scrollProgress() - smooth.progress) * 0.055;
  smooth.mx += (pointer.x - smooth.mx) * 0.05;
  smooth.my += (pointer.y - smooth.my) * 0.05;

  const p = REDUCED ? 0 : smooth.progress;
  camPathPos.getPoint(p, _pos);
  camPathTgt.getPoint(p, _tgt);

  _pos.x += smooth.mx * 1.1;
  _pos.y += -smooth.my * 0.65 + Math.sin(time * 0.5) * 0.12;
  camera.position.copy(_pos);
  camera.lookAt(_tgt);

  villa.rotation.y = time * 0.05;
  embers.material.uniforms.uTime.value = time;
  dust.rotation.y = time * 0.008;

  renderer.render(scene, camera);
}

/* ────────────────────────────────────────────
   MASTER RAF
   ──────────────────────────────────────────── */
function raf(t) {
  if (lenis) lenis.raf(t);
  render(t);
  requestAnimationFrame(raf);
}

/* ────────────────────────────────────────────
   LOADER + HERO INTRO
   ──────────────────────────────────────────── */
function initLoader() {
  const loader = document.getElementById("loader");
  const bar = document.getElementById("loaderBar");
  const pct = document.getElementById("loaderPct");
  const log = document.getElementById("bootLog");

  const BOOT = [
    [4, "SYS", "BOOT SEQUENCE INITIATED"],
    [22, "GRID", "ENVIRONMENT ONLINE"],
    [42, "3D", "VILLA WIREFRAME COMPILED"],
    [64, "HVAC", "CLIMATE SYSTEMS CALIBRATED"],
    [82, "MEP", "POWER + WATER ROUTED"],
    [96, "MTS", "ALL TRADES READY"],
  ];
  let bootIdx = 0;
  const pushLog = () => {
    const [, tag, msg] = BOOT[bootIdx++];
    const line = document.createElement("div");
    line.innerHTML = `<b>[ ${tag} ]</b>&nbsp; ${msg}`;
    log.appendChild(line);
  };

  const finish = () => {
    loader.classList.add("done");
    heroIntro();
  };

  if (!HAS_GSAP || REDUCED) {
    bar.style.width = "100%";
    while (bootIdx < BOOT.length) pushLog();
    setTimeout(finish, 500);
    return;
  }
  const state = { v: 0 };
  gsap.to(state, {
    v: 100, duration: 2.4, ease: "power2.inOut",
    onUpdate: () => {
      bar.style.width = state.v + "%";
      pct.textContent = String(Math.round(state.v)).padStart(2, "0");
      while (bootIdx < BOOT.length && state.v >= BOOT[bootIdx][0]) pushLog();
    },
    onComplete: finish,
  });
  // safety: never trap the user behind the loader
  setTimeout(() => { if (!loader.classList.contains("done")) finish(); }, 5000);
}

function heroIntro() {
  if (!HAS_GSAP || REDUCED) return;
  gsap.set("[data-hero]", { opacity: 0, y: 24 });
  gsap.set("[data-hero-line]", { yPercent: 115 });
  const tl = gsap.timeline({ delay: 0.15 });
  tl.to("[data-hero-line]", { yPercent: 0, duration: 1.3, ease: "expo.out", stagger: 0.12 })
    .to("[data-hero]", { opacity: 1, y: 0, duration: 1, ease: "power3.out", stagger: 0.1 }, "-=0.9");
}

/* ────────────────────────────────────────────
   SCROLL ANIMATIONS
   ──────────────────────────────────────────── */
function initScrollAnims() {
  if (!HAS_ST || REDUCED) return;

  ScrollTrigger.batch("[data-reveal]", {
    start: "top 88%",
    once: true,
    onEnter: (els) =>
      gsap.to(els, { opacity: 1, y: 0, duration: 1.1, ease: "power3.out", stagger: 0.09 }),
  });

  // counters
  document.querySelectorAll("[data-count]").forEach((el) => {
    const target = parseInt(el.dataset.count, 10);
    const state = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: "top 90%", once: true,
      onEnter: () =>
        gsap.to(state, {
          v: target, duration: 1.8, ease: "power2.out",
          onUpdate: () => (el.textContent = Math.round(state.v)),
        }),
    });
  });

  // process progress line
  const prog = document.getElementById("stepsProgress");
  if (prog) {
    gsap.to(prog, {
      width: "100%", ease: "none",
      scrollTrigger: { trigger: ".steps", start: "top 75%", end: "bottom 45%", scrub: 0.6 },
    });
  }
}

/* ────────────────────────────────────────────
   NAV
   ──────────────────────────────────────────── */
function initNav() {
  const nav = document.getElementById("nav");
  const burger = document.getElementById("navBurger");
  const links = document.getElementById("navLinks");
  let lastY = 0;

  const onScroll = (y) => {
    nav.classList.toggle("scrolled", y > 40);
    if (y > 500 && y > lastY + 4) nav.classList.add("hidden");
    else if (y < lastY - 4 || y < 500) nav.classList.remove("hidden");
    lastY = y;
  };

  if (lenis) lenis.on("scroll", ({ scroll }) => onScroll(scroll));
  else window.addEventListener("scroll", () => onScroll(window.scrollY), { passive: true });

  burger.addEventListener("click", () => {
    burger.classList.toggle("open");
    links.classList.toggle("open");
  });

  // smooth anchors
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      burger.classList.remove("open");
      links.classList.remove("open");
      if (lenis) lenis.scrollTo(el, { offset: -70, duration: 1.6 });
      else el.scrollIntoView({ behavior: "smooth" });
    });
  });
}

/* ────────────────────────────────────────────
   CARD SPOTLIGHT + TILT
   ──────────────────────────────────────────── */
function initCards() {
  if (TOUCH || REDUCED) return;
  document.querySelectorAll(".svc-card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      card.style.setProperty("--mx", (x / r.width) * 100 + "%");
      card.style.setProperty("--my", (y / r.height) * 100 + "%");
      const rx = ((y / r.height) - 0.5) * -6;
      const ry = ((x / r.width) - 0.5) * 6;
      card.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
    card.addEventListener("pointerleave", () => {
      card.style.transform = "perspective(700px) rotateX(0deg) rotateY(0deg)";
    });
  });
}

/* ────────────────────────────────────────────
   CONTACT FORM → ZOHO CRM LEAD (WhatsApp fallback)
   Tokens come from Zoho CRM > Setup > Developer Space
   > Webforms > (form) > embed code. Until both tokens
   are pasted in, the form falls back to WhatsApp.
   ──────────────────────────────────────────── */
const ZOHO_WEBFORM = {
  action: "https://crm.zoho.com/crm/WebToLeadForm",
  xnQsjsdp: "PASTE_XNQSJSDP_TOKEN",
  xmIwtLD: "PASTE_XMIWTLD_TOKEN",
  actionType: "TGVhZHM=",
  returnURL: "https://www.mendtechservices.com/",
};
window.ZOHO_WEBFORM = ZOHO_WEBFORM;

function zohoReady() {
  return !ZOHO_WEBFORM.xnQsjsdp.startsWith("PASTE_") && !ZOHO_WEBFORM.xmIwtLD.startsWith("PASTE_");
}

function postLeadToZoho(fields) {
  let frame = document.getElementById("zohoLeadFrame");
  if (!frame) {
    frame = document.createElement("iframe");
    frame.id = "zohoLeadFrame";
    frame.name = "zohoLeadFrame";
    frame.style.display = "none";
    document.body.appendChild(frame);
  }
  const f = document.createElement("form");
  f.action = ZOHO_WEBFORM.action;
  f.method = "POST";
  f.target = "zohoLeadFrame";
  f.style.display = "none";
  const data = {
    xnQsjsdp: ZOHO_WEBFORM.xnQsjsdp,
    xmIwtLD: ZOHO_WEBFORM.xmIwtLD,
    actionType: ZOHO_WEBFORM.actionType,
    returnURL: ZOHO_WEBFORM.returnURL,
    ...fields,
  };
  for (const [k, v] of Object.entries(data)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = k;
    input.value = v;
    f.appendChild(input);
  }
  document.body.appendChild(f);
  f.submit();
  setTimeout(() => f.remove(), 3000);
}

function initForm() {
  const form = document.getElementById("contactForm");
  const label = document.getElementById("fSubmitLabel");
  const note = document.getElementById("fNote");
  if (zohoReady()) {
    label.textContent = "Send Request";
    note.textContent = "GOES STRAIGHT TO OUR TEAM — WE CALL YOU BACK";
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    const email = form.email.value.trim();
    const service = form.service.value;
    const message = form.message.value.trim();
    if (zohoReady()) {
      postLeadToZoho({
        "Last Name": name || "Website visitor",
        "Phone": phone,
        "Email": email,
        "Description": `Service: ${service}` + (message ? `\n\n${message}` : ""),
      });
      form.reset();
      label.textContent = "Received ✓";
      note.textContent = "THANKS — WE'LL CALL YOU BACK SHORTLY. URGENT? WHATSAPP +971 52 233 8499";
      setTimeout(() => { label.textContent = "Send Request"; }, 4000);
    } else {
      let text = `Hello Mendonca Technical Services!\n\nName: ${name}\nService: ${service}`;
      if (phone) text += `\nPhone: ${phone}`;
      if (email) text += `\nEmail: ${email}`;
      if (message) text += `\n\n${message}`;
      window.open("https://wa.me/971522338499?text=" + encodeURIComponent(text), "_blank", "noopener");
    }
  });
}

/* ────────────────────────────────────────────
   BOOT
   ──────────────────────────────────────────── */
initScene();
initLoader();
initScrollAnims();
initNav();
initCards();
initForm();
requestAnimationFrame(raf);

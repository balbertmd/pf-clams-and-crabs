// Dynamic header sky (time of day + season + live weather + moon phase) + weather/time chip.
// Reads coords/timezone from the .site-header dataset. Respects reduced-motion; pauses when hidden.
function initSky() {
  const host = document.querySelector<HTMLElement>(".site-header");
  if (!host) return;
  const lat = parseFloat(host.dataset.lat || "");
  const lng = parseFloat(host.dataset.lng || "");
  const tz = host.dataset.tz || "America/New_York";
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- weather + local time chip ---- */
  const headerInner = host.querySelector(".header-inner");
  if (headerInner) {
    const wx = document.createElement("div");
    wx.className = "wx";
    const anchor = headerInner.querySelector(".header-actions") || headerInner.querySelector("[data-theme-toggle]");
    headerInner.insertBefore(wx, anchor || null);
    let temp: number | null = null, label = "";
    const wmap = (c: number): string => {
      if (c === 0) return "Clear";
      if (c === 1 || c === 2) return "Partly cloudy";
      if (c === 3) return "Cloudy";
      if (c === 45 || c === 48) return "Fog";
      if (c >= 51 && c <= 57) return "Drizzle";
      if (c >= 61 && c <= 67) return "Rain";
      if (c >= 71 && c <= 77) return "Snow";
      if (c >= 80 && c <= 82) return "Showers";
      if (c >= 85 && c <= 86) return "Snow";
      if (c >= 95) return "Thunderstorms";
      return "";
    };
    const renderChip = () => {
      const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date());
      wx.innerHTML = (temp != null ? `<span class="wx-temp">${temp}°</span><span class="wx-sep">·</span>` : "") + `<span class="wx-time">${time}</span>`;
      wx.title = "Cape May, NJ" + (label ? " · " + label : "") + (temp != null ? " · " + temp + "°F" : "");
    };
    renderChip();
    setInterval(renderChip, 30000);
    if (lat && lng) {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`)
        .then((r) => r.json())
        .then((d: any) => { const cur = (d && d.current) || {}; if (typeof cur.temperature_2m === "number") temp = Math.round(cur.temperature_2m); label = wmap(cur.weather_code); renderChip(); })
        .catch(() => {});
    }
  }

  /* ---- animated canvas sky ---- */
  host.classList.add("has-sky");
  const sky = document.createElement("div"); sky.className = "sky"; sky.setAttribute("aria-hidden", "true");
  const canvas = document.createElement("canvas"); canvas.className = "sky-canvas"; canvas.setAttribute("aria-hidden", "true");
  const scrim = document.createElement("div"); scrim.className = "sky-scrim"; scrim.setAttribute("aria-hidden", "true");
  host.prepend(scrim); host.prepend(canvas); host.prepend(sky);
  const ctx = canvas.getContext("2d")!;
  let weatherCode: number | null = null;

  const localHour = () => { try { return parseInt(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(new Date()), 10); } catch (e) { return new Date().getHours(); } };
  const phase = () => { const h = localHour(); if (h >= 5 && h < 8) return "dawn"; if (h >= 8 && h < 18) return "day"; if (h >= 18 && h < 20) return "dusk"; return "night"; };
  const wxState = () => { const c = weatherCode; return { clear: c === 0 || c == null, cloud: c === 1 || c === 2 || c === 3 || c === 45 || c === 48, fog: c === 45 || c === 48, rain: (c! >= 51 && c! <= 67) || (c! >= 80 && c! <= 82), storm: c != null && c >= 95, snow: (c! >= 71 && c! <= 77) || c === 85 || c === 86 }; };

  const SKIES: Record<string, string> = {
    dawn: "linear-gradient(180deg,#1b2a52 0%,#6f5a8e 50%,#e8845b 100%)",
    day: "linear-gradient(180deg,#2f72c9 0%,#5a9ad8 60%,#9cc6ee 100%)",
    dusk: "linear-gradient(180deg,#13203a 0%,#5a3a6b 55%,#d96b46 100%)",
    night: "linear-gradient(180deg,#05081a 0%,#0c1430 55%,#152043 100%)",
  };
  const skyGradient = () => { const p = phase(), w = wxState(), night = p === "night"; if (w.storm) return night ? "linear-gradient(180deg,#070a12,#1b222c)" : "linear-gradient(180deg,#3a424c,#5e6772)"; if (w.rain) return night ? "linear-gradient(180deg,#070b16,#1d2530)" : "linear-gradient(180deg,#4a525c,#79828d)"; if (w.snow) return night ? "linear-gradient(180deg,#0a1020,#222a3a)" : "linear-gradient(180deg,#7d8694,#aab3bd)"; if (w.fog) return night ? "linear-gradient(180deg,#0d1117,#2a313b)" : "linear-gradient(180deg,#9aa3ab,#c6ccd2)"; if (w.cloud) return night ? "linear-gradient(180deg,#070c1c,#222c40)" : "linear-gradient(180deg,#6f7c89,#aab4bd)"; return SKIES[p]; };
  const scrimBg = () => { const p = phase(); if (p === "night") return "linear-gradient(180deg,rgba(4,6,16,.18),rgba(4,6,16,.1))"; if (p === "day") return "linear-gradient(180deg,rgba(6,10,18,.42),rgba(6,10,18,.34))"; return "linear-gradient(180deg,rgba(6,10,18,.34),rgba(6,10,18,.26))"; };
  const moonPhase = (d: Date) => { const syn = 29.530588853; const ref = Date.UTC(2000, 0, 6, 18, 14) / 86400000; let p = ((d.getTime() / 86400000 - ref) % syn) / syn; if (p < 0) p += 1; return p; };

  let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2), raf: number | null = null;
  let stars: any[] = [], clouds: any[] = [], precip: any[] = [], flash = 0;
  const rnd = (a: number, z: number) => a + Math.random() * (z - a);
  function seed() {
    const small = W < 700;
    stars = []; for (let i = 0; i < (small ? 60 : 120); i++) stars.push({ x: rnd(0, W), y: rnd(0, H * .9), r: rnd(.4, 1.5), tw: rnd(0, 6), sp: rnd(.02, .05) });
    clouds = []; for (let i = 0; i < (small ? 3 : 5); i++) clouds.push({ x: rnd(0, W), y: rnd(H * .1, H * .7), s: rnd(70, 150), v: rnd(.06, .2), o: rnd(.14, .32) });
    precip = []; const w = wxState();
    if (w.rain || w.storm) { for (let i = 0; i < (small ? 80 : 150); i++) precip.push({ x: rnd(0, W), y: rnd(0, H), l: rnd(8, 16), v: rnd(7, 12) }); }
    else if (w.snow) { for (let i = 0; i < (small ? 45 : 90); i++) precip.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(1.1, 2.6), v: rnd(.5, 1.5), ph: rnd(0, 6) }); }
  }
  function resize() { W = host!.clientWidth; H = host!.clientHeight; canvas.width = Math.max(1, W * dpr); canvas.height = Math.max(1, H * dpr); canvas.style.width = W + "px"; canvas.style.height = H + "px"; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); seed(); }
  function drawSun(cx: number, cy: number, r: number) { const g = ctx.createRadialGradient(cx, cy, r * .4, cx, cy, r * 3); g.addColorStop(0, "rgba(255,243,205,.95)"); g.addColorStop(.4, "rgba(255,221,140,.45)"); g.addColorStop(1, "rgba(255,221,140,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 3, 0, 7); ctx.fill(); ctx.fillStyle = "#fff3cd"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); }
  function drawMoon(cx: number, cy: number, r: number) { const ph = moonPhase(new Date()); const g = ctx.createRadialGradient(cx, cy, r * .5, cx, cy, r * 2.6); g.addColorStop(0, "rgba(240,244,255,.4)"); g.addColorStop(1, "rgba(240,244,255,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 2.6, 0, 7); ctx.fill(); ctx.fillStyle = "#eef2ff"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.fillStyle = "rgba(175,186,214,.55)"; ctx.beginPath(); ctx.arc(cx - r * .3, cy - r * .18, r * .16, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(cx + r * .26, cy + r * .24, r * .12, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(cx + r * .08, cy - r * .34, r * .08, 0, 7); ctx.fill(); ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r + .5, 0, 7); ctx.clip(); const k = (1 - Math.cos(2 * Math.PI * ph)) / 2, dir = ph < .5 ? -1 : 1; ctx.fillStyle = "rgba(6,9,24,.93)"; ctx.beginPath(); ctx.arc(cx + dir * 2 * r * k, cy, r, 0, 7); ctx.fill(); ctx.restore(); }
  function frame() {
    ctx.clearRect(0, 0, W, H);
    const p = phase(), w = wxState(), night = p === "night", overcast = w.cloud || w.rain || w.storm || w.snow || w.fog, noDisc = W < 1000;
    // The right side holds the controls (toggle + menu) and the left holds the logo, so place the sun/moon in the open gap; skip it on narrow screens where there's no room.
    if (night) { const sa = overcast ? .45 : 1; for (const s of stars) { s.tw += s.sp; const a = (.35 + Math.abs(Math.sin(s.tw)) * .65) * sa; ctx.fillStyle = "rgba(255,255,255," + a + ")"; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); } if (!w.fog && !noDisc) drawMoon(W - 380, H * .5, 17); }
    else if (p === "day" && w.clear && !noDisc) { drawSun(W - 380, H * .46, 17); }
    if (w.cloud || w.fog) { for (const c of clouds) { const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.s); const oo = w.fog ? Math.min(c.o * 1.6, .5) : c.o; g.addColorStop(0, "rgba(255,255,255," + oo + ")"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, c.s, 0, 7); ctx.fill(); c.x += c.v; if (c.x - c.s > W) c.x = -c.s; } }
    if (w.rain || w.storm) { ctx.strokeStyle = "rgba(190,210,235,.55)"; ctx.lineWidth = 1.1; for (const d of precip) { ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 1.6, d.y + d.l); ctx.stroke(); d.y += d.v; d.x -= .6; if (d.y > H) { d.y = -8; d.x = rnd(0, W); } } if (w.storm) { if (Math.random() < .004) flash = 1; if (flash > 0) { ctx.fillStyle = "rgba(255,255,255," + (flash * .4) + ")"; ctx.fillRect(0, 0, W, H); flash -= .05; } } }
    else if (w.snow) { ctx.fillStyle = "rgba(255,255,255,.9)"; for (const d of precip) { d.ph += .02; ctx.beginPath(); ctx.arc(d.x + Math.sin(d.ph) * 5, d.y, d.r, 0, 7); ctx.fill(); d.y += d.v; if (d.y > H) { d.y = -6; d.x = rnd(0, W); } } }
    raf = requestAnimationFrame(frame);
  }
  const startA = () => { if (raf || reduce) return; raf = requestAnimationFrame(frame); };
  const stopA = () => { if (raf) { cancelAnimationFrame(raf); raf = null; } };
  const refresh = () => { sky.style.background = skyGradient(); scrim.style.background = scrimBg(); seed(); if (reduce) { stopA(); frame(); stopA(); } else { stopA(); startA(); } };

  resize(); refresh();
  window.addEventListener("resize", () => { dpr = Math.min(window.devicePixelRatio || 1, 2); resize(); refresh(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopA(); else startA(); });
  setInterval(refresh, 10 * 60 * 1000);
  if (lat && lng) {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lng + "&current=weather_code,is_day")
      .then((r) => r.json())
      .then((d: any) => { const cur = (d && d.current) || {}; if (typeof cur.weather_code === "number") { weatherCode = cur.weather_code; refresh(); } })
      .catch(() => {});
  }
}
if (document.readyState !== "loading") initSky(); else document.addEventListener("DOMContentLoaded", initSky);

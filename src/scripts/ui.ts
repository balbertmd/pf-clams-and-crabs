// Theme toggle, duty tabs, scroll-reveal, gallery lightbox, VIN decoder, date guard.
function ready(fn: () => void) { if (document.readyState !== "loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }

ready(() => {
  /* ---- Theme toggle ---- */
  const curTheme = () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  const paint = () => { const dark = curTheme() === "dark"; document.querySelectorAll("[data-theme-toggle]").forEach((b) => b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode")); };
  paint();
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => btn.addEventListener("click", () => {
    const next = curTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
    paint();
  }));

  /* ---- Mobile menu (hamburger) ---- */
  const header = document.querySelector(".site-header");
  const navToggle = document.querySelector("[data-nav-toggle]");
  const siteNav = document.getElementById("site-nav");
  if (header && navToggle) {
    const closeNav = () => { header.classList.remove("nav-open"); navToggle.setAttribute("aria-expanded", "false"); };
    navToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = header.classList.toggle("nav-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    siteNav && siteNav.addEventListener("click", (e) => { if ((e.target as HTMLElement).tagName === "A") closeNav(); });
    document.addEventListener("click", (e) => { if (header.classList.contains("nav-open") && !header.contains(e.target as Node)) closeNav(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeNav(); });
  }

  /* ---- Duty tabs ---- */
  document.querySelectorAll<HTMLElement>(".duty-btn").forEach((btn) => btn.addEventListener("click", () => {
    document.querySelectorAll(".duty-btn").forEach((x) => { x.classList.remove("active"); x.setAttribute("aria-selected", "false"); });
    document.querySelectorAll(".duty-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active"); btn.setAttribute("aria-selected", "true");
    const panel = document.getElementById("panel-" + btn.dataset.panel); if (panel) panel.classList.add("active");
  }));

  /* ---- Lightbox (shared) ---- */
  function buildLightbox() {
    let lb = document.getElementById("lightbox") as any;
    if (lb) return lb;
    lb = document.createElement("div"); lb.id = "lightbox"; lb.className = "lightbox";
    lb.innerHTML = '<button class="lb-close" aria-label="Close">&times;</button><button class="lb-nav lb-prev" aria-label="Previous">&lsaquo;</button><figure class="lb-fig"><img class="lb-img" alt="" /><figcaption class="lb-cap"></figcaption></figure><button class="lb-nav lb-next" aria-label="Next">&rsaquo;</button>';
    document.body.appendChild(lb);
    const render = () => { const g = lb._items[lb._i]; lb.querySelector(".lb-img").src = lb._base + g.file; lb.querySelector(".lb-cap").textContent = g.caption; };
    const move = (d: number) => { const n = lb._items.length; lb._i = (lb._i + d + n) % n; render(); };
    lb._render = render;
    lb.querySelector(".lb-close").onclick = () => lb.classList.remove("open");
    lb.querySelector(".lb-prev").onclick = (e: Event) => { e.stopPropagation(); move(-1); };
    lb.querySelector(".lb-next").onclick = (e: Event) => { e.stopPropagation(); move(1); };
    lb.onclick = (e: Event) => { if (e.target === lb) lb.classList.remove("open"); };
    document.addEventListener("keydown", (e) => { if (!lb.classList.contains("open")) return; if (e.key === "Escape") lb.classList.remove("open"); if (e.key === "ArrowLeft") move(-1); if (e.key === "ArrowRight") move(1); });
    // Touch swipe (mobile): swipe left = next, right = previous.
    let _tsX = 0, _tsY = 0;
    lb.addEventListener("touchstart", (e: TouchEvent) => { _tsX = e.changedTouches[0].clientX; _tsY = e.changedTouches[0].clientY; }, { passive: true });
    lb.addEventListener("touchend", (e: TouchEvent) => { const dx = e.changedTouches[0].clientX - _tsX, dy = e.changedTouches[0].clientY - _tsY; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1); }, { passive: true });
    return lb;
  }
  document.querySelectorAll<HTMLElement>("[data-gallery]").forEach((el) => {
    const base = el.dataset.base || "";
    let items: any[] = [];
    try { items = JSON.parse(el.dataset.items || "[]"); } catch (e) {}
    el.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(".gallery-item") as HTMLElement | null;
      if (btn && !btn.classList.contains("is-empty")) { const lb = buildLightbox(); lb._base = base; lb._items = items; lb._i = +(btn.dataset.i || 0); lb._render(); lb.classList.add("open"); }
    });
  });

  /* ---- Scroll reveal ---- */
  if ("IntersectionObserver" in window && !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    const sel = ".cat-card, .promo-card, .review-card, .gallery-item, .hours-card, .location-info, .welcome-media, .welcome-text, .reviews-head, .section > .container > .eyebrow, .section > .container > h2, .section > .container > .section-lead, .spoke-grid > .prose, .spoke-grid > .side-card";
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    const vh = window.innerHeight || 800;
    Array.prototype.slice.call(document.querySelectorAll(sel)).forEach((el: Element, i: number) => {
      if ((el as HTMLElement).getBoundingClientRect().top < vh * 0.9) return;
      el.classList.add("reveal"); (el as HTMLElement).style.transitionDelay = ((i % 4) * 70) + "ms"; io.observe(el);
    });
  }

  /* ---- Videos: click thumbnail to load the YouTube player ---- */
  document.querySelectorAll<HTMLElement>(".video-item").forEach((btn) => btn.addEventListener("click", () => {
    const id = btn.dataset.yt; if (!id) return;
    const label = (btn.getAttribute("aria-label") || "Video").replace(/"/g, "");
    const frame = document.createElement("div"); frame.className = "video-frame";
    frame.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0" title="' + label + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
    btn.replaceWith(frame);
  }));

  /* ---- VIN decoder ---- */
  const vbtn = document.getElementById("vin-decode");
  const vin = document.getElementById("vin") as HTMLInputElement | null;
  const veh = document.getElementById("vehicle") as HTMLInputElement | null;
  const out = document.getElementById("vin-result");
  if (vbtn && vin) {
    const say = (m: string) => { if (out) { (out as HTMLElement).style.display = "block"; out.textContent = m; } };
    const decode = () => {
      const v = (vin.value || "").trim().toUpperCase();
      if (v.length < 11) { say("Enter your full 17-character VIN to auto-fill."); return; }
      say("Decoding VIN…");
      fetch("https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/" + encodeURIComponent(v) + "?format=json")
        .then((r) => r.json())
        .then((d: any) => {
          const rows = d.Results || [];
          const get = (name: string) => { const f = rows.find((x: any) => x.Variable === name); return f && f.Value ? f.Value : ""; };
          const parts = [get("Model Year"), get("Make"), get("Model")].filter(Boolean).join(" ");
          const eng = get("Displacement (L)");
          if (parts) { if (veh) veh.value = parts + (eng ? " — " + (Math.round(parseFloat(eng) * 10) / 10) + "L" : ""); say("Found: " + parts + (eng ? " · " + (Math.round(parseFloat(eng) * 10) / 10) + "L" : "") + ". Edit above if needed."); }
          else { say("Couldn't read that VIN — please type your vehicle above."); }
        })
        .catch(() => say("VIN lookup is unavailable right now — please type your vehicle above."));
    };
    vbtn.addEventListener("click", decode);
    vin.addEventListener("blur", () => { if ((vin.value || "").trim().length >= 17) decode(); });
  }

  /* ---- Preferred date: no past dates ---- */
  const dt = document.getElementById("preferred_date") as HTMLInputElement | null;
  if (dt) { const t = new Date(); t.setMinutes(t.getMinutes() - t.getTimezoneOffset()); dt.min = t.toISOString().slice(0, 10); }
});

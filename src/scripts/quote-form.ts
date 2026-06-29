// Booking/quote form → Forminit. Photo-first intake: multi-select with thumbnail previews
// (add across multiple picks, remove individually), client-side image compression,
// multipart submit via fetch, honeypot spam guard, inline status. No page navigation.
function ready(fn: () => void) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

ready(() => {
  const form = document.getElementById('quote-form') as HTMLFormElement | null;
  if (!form) return;
  const status = document.getElementById('quote-status') as HTMLElement | null;
  const fileInput = document.getElementById('photo-input') as HTMLInputElement | null;
  const previews = document.getElementById('photo-previews') as HTMLElement | null;
  const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
  const formId = form.dataset.forminitId || '';
  const phone = form.dataset.phone || '';

  const say = (msg: string, ok?: boolean) => {
    if (!status) return;
    status.style.display = 'block';
    status.textContent = msg;
    status.style.color = ok ? 'var(--accent-dark)' : 'var(--text-body)';
  };

  // ---- Photo selection with live thumbnail previews ----
  let selected: { file: File; url: string }[] = [];
  const renderPreviews = () => {
    if (!previews) return;
    previews.innerHTML = '';
    selected.forEach((it, i) => {
      const cell = document.createElement('div');
      cell.className = 'photo-thumb';
      cell.innerHTML = '<img alt="Selected photo" /><button type="button" class="photo-x" aria-label="Remove photo">&times;</button>';
      (cell.querySelector('img') as HTMLImageElement).src = it.url;
      (cell.querySelector('.photo-x') as HTMLElement).addEventListener('click', () => {
        URL.revokeObjectURL(it.url);
        selected.splice(i, 1);
        renderPreviews();
      });
      previews.appendChild(cell);
    });
    previews.style.display = selected.length ? 'flex' : 'none';
  };
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const picked = fileInput.files ? Array.from(fileInput.files) : [];
      for (const f of picked) {
        if (!f.type.startsWith('image/')) continue;
        if (selected.some((s) => s.file.name === f.name && s.file.size === f.size)) continue;
        selected.push({ file: f, url: URL.createObjectURL(f) });
      }
      fileInput.value = ''; // allow picking the same file again / adding more
      renderPreviews();
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Honeypot: a real user never fills this hidden field.
    const hp = form.querySelector('[name="_gotcha"]') as HTMLInputElement | null;
    if (hp && hp.value) { say('Thanks!'); form.reset(); return; }

    if (!formId || formId.startsWith('CHECK')) {
      say(`Online form isn't connected yet — please call us at ${phone}.`);
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    say('Sending your request…');

    const fd = new FormData(form);
    if (!fd.get('fi-sender-email')) fd.delete('fi-sender-email');

    // Compress the selected images, then append as Forminit file fields.
    const files = selected.map((s) => s.file);
    if (files.length) {
      try {
        const mod: any = await import('browser-image-compression');
        const compress = mod.default || mod;
        for (const f of files) {
          let out: File = f;
          try { out = await compress(f, { maxSizeMB: 0.15, maxWidthOrHeight: 1200, useWebWorker: true }); } catch (_) { out = f; }
          fd.append('fi-file-photos[]', out, f.name || 'photo.jpg');
        }
      } catch (_) {
        for (const f of files) fd.append('fi-file-photos[]', f, f.name || 'photo.jpg');
      }
    }

    try {
      const res = await fetch('https://forminit.com/f/' + formId, {
        method: 'POST', body: fd, headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({} as any));
      if (res.ok && data.success !== false) {
        form.reset();
        selected.forEach((s) => URL.revokeObjectURL(s.url));
        selected = [];
        renderPreviews();
        say('✅ Thank you! We got your request and will get back to you shortly.', true);
      } else {
        say(`Sorry, something went wrong. Please call us at ${phone}.`);
      }
    } catch (_) {
      say(`Network error — please call us at ${phone}.`);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
});

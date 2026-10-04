(function () {
  "use strict";

  const CFG = Object.assign({ scriptUrl: "", askClassCode: true, defaultYear: 2050 }, window.FEED_CONFIG || {});
  const LIVE = /^https:\/\/script\.google(usercontent)?\.com\//.test((CFG.scriptUrl || "").trim());
  const YEARS = [2035, 2040, 2050, 2060, 2075, 2100];
  const AVATAR = ["#1877F2", "#E41E3F", "#31A24C", "#F7B928", "#8B5CF6", "#F5533D", "#0EA5E9", "#14B8A6"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DEMO_KEY = "futurefeed-demo-posts";
  const LIKED_KEY = "futurefeed-liked";
  const ME_KEY = "futurefeed-me";
  const MAX_SIDE = 1400;

  const $ = (sel, root = document) => root.querySelector(sel);
  const form = $("#postForm");
  const dialog = $("#composerDialog");
  const state = { posts: [], sort: "new", query: "", yearFilter: null, year: CFG.defaultYear, loading: false, upload: null };

  // ---------- storage (wrapped: private windows can block it) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };
  const liked = new Set(store.get(LIKED_KEY, []));

  // ---------- helpers ----------
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  const colourFor = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AVATAR[h % AVATAR.length]; };
  const avatar = (name, cls = "avatar") => `<div class="${cls}" style="background:${colourFor(name)}" aria-hidden="true">${esc(initials(name))}</div>`;
  const ago = (iso) => {
    const t = new Date(iso).getTime(); if (!t) return "";
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "Just now"; if (m < 60) return m + " min";
    const h = Math.round(m / 60); if (h < 24) return h + " h";
    const d = new Date(t); return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };
  const niceDate = (s) => { const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : ""; };
  const today = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
  const driveId = (s) => { const m = String(s || "").match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=|thumbnail\?id=)([\w-]{20,})/); return m ? m[1] : ""; };

  // Uploaded images and Google Drive share links become a direct image link.
  function imageSrc(image) {
    const s = String(image || "").trim();
    if (s.startsWith("data:image/")) return s;
    const id = driveId(s);
    if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
    return /^https:\/\//i.test(s) ? s : "";
  }

  // ---------- icons ----------
  const globe = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M1.5 8h13M8 1.5c2 2 2 11 0 13M8 1.5c-2 2-2 11 0 13" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
  const thumb = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 21H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3zm2 0V11l4.2-7.2c.4-.7 1.4-.9 2-.3.6.5.8 1.3.6 2L14.6 9H20a2 2 0 0 1 2 2.3l-1.2 7.6A2.5 2.5 0 0 1 18.3 21z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  const share = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4l7 7-7 7v-4c-5 0-8 1.5-11 5 1-6 4-10 11-11z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  const badgeThumb = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 21H4V11h3zm2 0V11l4.2-7.2c.4-.7 1.4-.9 2-.3.6.5.8 1.3.6 2L14.6 9H20a2 2 0 0 1 2 2.3l-1.2 7.6A2.5 2.5 0 0 1 18.3 21z"/></svg>';

  // ---------- rendering ----------
  function postHTML(p, opts = {}) {
    const changes = (p.changes || []).filter((c) => String(c).trim());
    const on = liked.has(p.id);
    const src = imageSrc(p.image);
    const likes = Number(p.likes) || 0;
    return `
      <article class="card post${opts.fresh ? " fresh" : ""}" id="post-${esc(p.id)}" data-id="${esc(p.id)}">
        <header class="p-head">
          ${avatar(p.name)}
          <div class="p-meta">
            <b class="p-name">${esc(p.name)}</b>
            <span class="p-sub">${esc(p.case)}${niceDate(p.date) ? ` · ${esc(niceDate(p.date))}` : ""} · ${globe}</span>
          </div>
          <span class="year-chip" title="Posted from the year ${esc(p.year)}">${esc(p.year)}</span>
        </header>
        <div class="p-text">
          <p class="p-headline">${esc(p.headline)}</p>
          ${p.story ? `<p class="p-story">${esc(p.story)}</p>` : ""}
        </div>
        ${src ? `<div class="p-img"><img src="${esc(src)}" alt="Image of ${esc(p.case)} in ${esc(p.year)}" loading="lazy"></div>` : `<div class="p-img empty-img">No image</div>`}
        <div class="p-extra">
          ${changes.length ? `<div class="p-changes"><p class="lbl">What has changed</p><ol>${changes.map((c) => `<li>${esc(c)}</li>`).join("")}</ol></div>` : ""}
          ${p.quote ? `<blockquote class="p-quote">${avatar(p.quoteBy || "?", "avatar")}<div class="bubble"><cite>${esc(p.quoteBy || "Voice from the future")}</cite><p>“${esc(String(p.quote).replace(/^[“"]+|[”"]+$/g, ""))}”</p></div></blockquote>` : ""}
        </div>
        <div class="p-stats">
          ${likes ? `<span class="like-badge">${badgeThumb}</span><span class="like-count">${likes}</span>` : `<span class="like-count"></span>`}
          <span class="p-time">${p.timestamp ? esc(ago(p.timestamp)) : ""}</span>
        </div>
        <div class="p-actions">
          <button type="button" class="act${on ? " on" : ""}" data-like="${esc(p.id)}" aria-pressed="${on}">${thumb}<span>${on ? "Liked" : "Like"}</span></button>
          <button type="button" class="act" data-share="${esc(p.id)}">${share}<span>Share</span></button>
        </div>
      </article>`;
  }

  function visiblePosts() {
    const q = state.query.toLowerCase();
    let list = state.posts.filter((p) => (!q || [p.name, p.case, p.headline, p.story].join(" ").toLowerCase().includes(q)) && (!state.yearFilter || Number(p.year) === state.yearFilter));
    if (state.sort === "liked") list = list.slice().sort((a, b) => (b.likes || 0) - (a.likes || 0));
    return list;
  }

  function renderFeed(freshId) {
    const box = $("#posts");
    const list = visiblePosts();
    if (!state.posts.length) {
      box.innerHTML = `<div class="card empty"><strong>${state.loading ? "Loading Fakebook…" : "No posts yet"}</strong>${state.loading ? "" : "Be the first to post from the future."}</div>`;
    } else if (!list.length) {
      box.innerHTML = `<div class="card empty"><strong>No matching posts</strong>Try another search or year.</div>`;
    } else {
      box.innerHTML = list.map((p) => postHTML(p, { fresh: p.id === freshId })).join("");
      box.querySelectorAll(".p-img img").forEach(guardImage);
    }
    const n = state.posts.length;
    $("#feedMeta").textContent = n ? `${n} post${n === 1 ? "" : "s"}${list.length !== n ? ` · ${list.length} shown` : ""}` : "";
    renderYears();
  }

  function renderYears() {
    const years = [...new Set(state.posts.map((p) => Number(p.year)).filter(Boolean))].sort((a, b) => a - b);
    const box = $("#yearChips");
    if (!years.length) { box.innerHTML = '<span class="muted">No posts yet</span>'; return; }
    box.innerHTML = `<button type="button" data-year="" class="${state.yearFilter ? "" : "on"}">All</button>` +
      years.map((y) => `<button type="button" data-year="${y}" class="${state.yearFilter === y ? "on" : ""}">${y}</button>`).join("");
  }

  function guardImage(img) {
    const onError = () => {
      const id = driveId(img.src);
      if (id && !img.dataset.retried) { img.dataset.retried = "1"; img.src = `https://lh3.googleusercontent.com/d/${id}=w1600`; return; }
      img.removeEventListener("error", onError);
      const wrap = img.parentElement;
      wrap.classList.add("broken");
      wrap.textContent = "Image could not load. If it is a Google Drive link, set sharing to “Anyone with the link”.";
    };
    img.addEventListener("error", onError);
  }

  // ---------- composer ----------
  function buildForm() {
    const years = $("#years");
    years.innerHTML = YEARS.map((y) => `<button type="button" data-year="${y}" class="${y === state.year ? "on" : ""}">${y}</button>`).join("") +
      `<input type="number" name="yearOther" min="2026" max="2200" placeholder="Other" aria-label="Other year">`;
    years.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-year]"); if (!b) return;
      state.year = Number(b.dataset.year); form.yearOther.value = "";
      years.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    });
    form.yearOther.addEventListener("input", () => {
      years.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
      state.year = Number(form.yearOther.value) || CFG.defaultYear;
    });

    const ph = ["Required", "Required", "Required", "Optional", "Optional"];
    $("#changes").innerHTML = ph.map((t, i) => `<li><input name="change" maxlength="160" aria-label="Change ${i + 1}${i < 3 ? " (required)" : " (optional)"}" placeholder="${t}"></li>`).join("");
    form.date.value = today();

    const me = store.get(ME_KEY, {});
    if (me.name) form.name.value = me.name;
    if (me.case) form.case.value = me.case;
    if (me.code) form.code.value = me.code;
    if (!LIVE || !CFG.askClassCode) $("#codeField").style.display = "none";
    showMe();

    form.addEventListener("submit", submit);
    form.name.addEventListener("input", showMe);
    ["headline", "story"].forEach((n) => {
      const el = form[n], out = $(`.count[data-for="${n}"]`);
      const upd = () => { out.textContent = `${el.value.length} / ${el.maxLength}`; };
      el.addEventListener("input", upd); upd();
    });
    bindUpload();

    $("#openComposer").addEventListener("click", () => openComposer());
    document.querySelectorAll(".cc-actions button").forEach((b) => b.addEventListener("click", () => openComposer(b.dataset.open)));
    $("#closeComposer").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  }

  function showMe() {
    const n = form.name.value.trim();
    const a = $("#meAvatar");
    a.textContent = initials(n); a.style.background = n ? colourFor(n) : "#BCC0C4";
    $("#openComposer").textContent = n ? `What does your future look like, ${n.split(/\s+/)[0]}?` : "What does your future look like?";
  }

  function openComposer(stepId) {
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    $("#formMsg").textContent = "";
    const target = stepId ? document.getElementById(stepId) : null;
    if (target) setTimeout(() => target.scrollIntoView({ block: "start" }), 0);
    else if (!form.name.value) form.name.focus();
  }

  function readForm() {
    return {
      name: form.name.value.trim(),
      case: form.case.value.trim(),
      date: form.date.value,
      year: state.year,
      headline: form.headline.value.trim(),
      image: state.upload ? state.upload.dataUrl : form.imageUrl.value.trim(),
      changes: [...form.querySelectorAll('input[name="change"]')].map((i) => i.value.trim()).filter(Boolean),
      quote: form.quote.value.trim(),
      quoteBy: form.quoteBy.value.trim(),
      story: form.story.value.trim(),
    };
  }

  function validate(p) {
    if (!p.name) return "Add the name of the poster.";
    if (!p.case) return "Add your case area.";
    if (!p.date) return "Add the date.";
    if (!(p.year >= 2026 && p.year <= 2200)) return "Choose a future year between 2026 and 2200.";
    if (!p.headline) return "Write a headline.";
    if (!p.image) return "Add your image: upload a photo or drawing, or paste an image link.";
    if (!state.upload && !/^https:\/\//i.test(p.image)) return "Image links must start with https://";
    if (p.changes.length < 3) return "List at least 3 changes from today.";
    if (!p.quote) return "Add a voice from the future.";
    if (!p.story) return "Write your future story.";
    if (LIVE && CFG.askClassCode && !form.code.value.trim()) return "Type the class code from your instructor.";
    return "";
  }

  async function submit(e) {
    e.preventDefault();
    const p = readForm();
    const msg = $("#formMsg");
    const problem = validate(p);
    if (problem) { msg.textContent = problem; msg.className = "form-msg err"; return; }
    const btn = $("#submitBtn");
    btn.disabled = true; msg.className = "form-msg";
    msg.textContent = state.upload ? "Uploading your image and posting…" : "Posting…";
    store.set(ME_KEY, { name: p.name, case: p.case, code: form.code.value.trim() });
    try {
      const saved = await api.create(p, form.code.value.trim(), state.upload);
      state.posts.unshift(saved);
      state.sort = "new"; state.yearFilter = null; state.query = ""; $("#search").value = ""; setSortButtons();
      renderFeed(saved.id);
      msg.textContent = "";
      form.headline.value = ""; form.quote.value = ""; form.quoteBy.value = ""; form.story.value = ""; form.imageUrl.value = "";
      form.querySelectorAll('input[name="change"]').forEach((i) => { i.value = ""; });
      form.querySelectorAll(".vision input").forEach((i) => { i.checked = false; });
      clearUpload();
      dialog.close();
      toast(`Posted to ${saved.year}`);
      const el = document.getElementById("post-" + saved.id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      msg.textContent = err.message || "Could not post. Please try again.";
      msg.className = "form-msg err";
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- image upload: shrink in the browser, then send with the post ----------
  function bindUpload() {
    const input = $("#imageFile"), drop = $("#drop");
    input.addEventListener("change", () => { if (input.files[0]) useFile(input.files[0]); });
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) useFile(f); });
    $("#removeImage").addEventListener("click", clearUpload);
  }

  async function useFile(file) {
    const msg = $("#formMsg");
    if (!/^image\//.test(file.type)) { msg.textContent = "Please choose an image file (JPG or PNG)."; msg.className = "form-msg err"; return; }
    msg.textContent = "Preparing your image…"; msg.className = "form-msg";
    try {
      const dataUrl = await shrink(file);
      state.upload = { dataUrl, name: file.name.replace(/\.[^.]+$/, "") + ".jpg" };
      $("#chosenImg").src = dataUrl; $("#chosenName").textContent = file.name; $("#chosen").hidden = false; $("#drop").hidden = true;
      msg.textContent = "";
    } catch (err) {
      msg.textContent = "That image could not be opened. Try a JPG or PNG (iPhone photos: share as JPG)."; msg.className = "form-msg err";
    }
  }

  function shrink(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
      img.src = url;
    });
  }

  function clearUpload() {
    state.upload = null;
    $("#imageFile").value = ""; $("#chosen").hidden = true; $("#drop").hidden = false; $("#chosenImg").removeAttribute("src");
  }

  // ---------- data ----------
  const api = {
    async list() {
      if (!LIVE) return store.get(DEMO_KEY, []);
      const r = await fetch(CFG.scriptUrl + (CFG.scriptUrl.includes("?") ? "&" : "?") + "t=" + Date.now());
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || "Could not load the feed.");
      return data.posts || [];
    },
    async create(p, code, upload) {
      if (!LIVE) {
        const post = Object.assign({ id: "local-" + Date.now().toString(36), timestamp: new Date().toISOString(), likes: 0 }, p);
        const list = store.get(DEMO_KEY, []);
        list.unshift(post); store.set(DEMO_KEY, list);
        return post;
      }
      const body = { action: "post", code, post: Object.assign({}, p, { image: upload ? "" : p.image }) };
      if (upload) body.upload = { data: upload.dataUrl.split(",")[1], mime: "image/jpeg", name: upload.name };
      const data = await postJSON(body);
      if (!data.ok) throw new Error(data.error || "Could not post.");
      return data.post;
    },
    async like(id) {
      if (!LIVE) {
        const list = store.get(DEMO_KEY, []);
        const p = list.find((x) => x.id === id); if (p) p.likes = (p.likes || 0) + 1;
        store.set(DEMO_KEY, list); return p ? p.likes : 0;
      }
      const data = await postJSON({ action: "like", id });
      if (!data.ok) throw new Error(data.error || "Could not like.");
      return data.likes;
    },
  };

  // A plain-text body keeps this a "simple" request, which Apps Script accepts from GitHub Pages.
  async function postJSON(body) {
    const r = await fetch(CFG.scriptUrl, { method: "POST", body: JSON.stringify(body), redirect: "follow" });
    return r.json();
  }

  async function load(quiet) {
    if (state.loading) return;
    state.loading = true;
    if (!quiet && !state.posts.length) renderFeed();
    try {
      state.posts = await api.list();
      state.loading = false;
      renderFeed();
      focusHash();
    } catch (err) {
      if (!quiet) $("#posts").innerHTML = `<div class="card empty"><strong>Could not load Fakebook</strong>${esc(err.message)}. Check the Apps Script URL in config.js.</div>`;
    } finally {
      state.loading = false;
    }
  }

  let hashDone = false;
  function focusHash() {
    if (hashDone || !location.hash.startsWith("#post-")) return;
    hashDone = true;
    const el = document.getElementById(location.hash.slice(1));
    if (el) { el.scrollIntoView({ block: "start" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 2500); }
  }

  // ---------- feed interactions ----------
  function setSortButtons() { document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.sort === state.sort)); }

  function bindFeed() {
    $("#posts").addEventListener("click", async (e) => {
      const sh = e.target.closest("button[data-share]");
      if (sh) {
        const link = location.href.split("#")[0] + "#post-" + sh.dataset.share;
        let copied = false;
        try { await navigator.clipboard.writeText(link); copied = true; } catch (err) {
          const t = document.createElement("textarea"); t.value = link; document.body.appendChild(t); t.select();
          try { copied = document.execCommand("copy"); } catch (e2) { copied = false; }
          t.remove();
        }
        toast(copied ? "Link copied" : "Copy the link from the address bar");
        if (!copied) location.hash = "post-" + sh.dataset.share;
        return;
      }
      const b = e.target.closest("button[data-like]"); if (!b) return;
      const id = b.dataset.like;
      if (liked.has(id)) { toast("You already liked this post"); return; }
      liked.add(id); store.set(LIKED_KEY, [...liked]);
      const p = state.posts.find((x) => x.id === id); if (p) p.likes = (p.likes || 0) + 1;
      const card = b.closest(".post");
      const paint = (n) => {
        b.classList.add("on"); b.setAttribute("aria-pressed", "true"); b.querySelector("span").textContent = "Liked";
        const stats = card.querySelector(".p-stats");
        stats.querySelectorAll(".like-badge, .like-count").forEach((x) => x.remove());
        stats.insertAdjacentHTML("afterbegin", `<span class="like-badge">${badgeThumb}</span><span class="like-count">${n}</span>`);
      };
      paint(p ? p.likes : 1);
      try { const n = await api.like(id); if (p && n) { p.likes = n; paint(n); } } catch (err) { /* keep the optimistic count */ }
    });
    $("#search").addEventListener("input", (e) => { state.query = e.target.value.trim(); renderFeed(); });
    document.querySelector(".tabs").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-sort]"); if (!b) return;
      state.sort = b.dataset.sort; setSortButtons(); renderFeed();
    });
    $("#yearChips").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-year]"); if (!b) return;
      state.yearFilter = b.dataset.year ? Number(b.dataset.year) : null; renderFeed();
    });
    $("#refresh").addEventListener("click", () => load(false));
    setInterval(() => { if (!document.hidden && !dialog.open) load(true); }, 60000);
  }

  let toastTimer;
  function toast(t) {
    const el = $("#toast"); el.textContent = t; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  }

  // ---------- start ----------
  function start() {
    if (CFG.activity) $("#activity").textContent = CFG.activity;
    if (CFG.course) $("#course").textContent = CFG.course;
    if (!LIVE) {
      const b = $("#banner");
      b.hidden = false;
      b.innerHTML = "<b>Demo mode.</b> Posts are saved only in this browser. Add your Apps Script web app URL in <code>config.js</code> to share one feed with the class.";
    }
    buildForm(); bindFeed(); load(false);
  }
  start();
})();

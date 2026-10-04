(function () {
  "use strict";

  const CFG = Object.assign({ scriptUrl: "", askClassCode: true, defaultYear: 2050 }, window.FEED_CONFIG || {});
  const LIVE = /^https:\/\/script\.google(usercontent)?\.com\//.test((CFG.scriptUrl || "").trim());
  const SCENES = [
    ["coastal_barangay", "Coastal barangay"],
    ["island_livelihoods", "Island livelihoods"],
    ["mountain_village", "Mountain village"],
    ["city_neighbourhood", "City neighbourhood"],
    ["farmland", "Farmland and river"],
  ];
  const YEARS = [2035, 2040, 2050, 2060, 2075, 2100];
  const AVATAR = ["#F07A62", "#6EC1E4", "#8CC56A", "#F6C343", "#F39A3D", "#D6EEF8"];
  const DEMO_KEY = "futurefeed-demo-posts";
  const LIKED_KEY = "futurefeed-liked";
  const ME_KEY = "futurefeed-me";

  const $ = (sel, root = document) => root.querySelector(sel);
  const form = $("#postForm");
  const state = { posts: [], sort: "new", query: "", year: CFG.defaultYear, loading: false };

  // ---------- storage helpers (wrapped: private windows can block storage) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };
  const liked = new Set(store.get(LIKED_KEY, []));

  // ---------- text helpers ----------
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  const colourFor = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AVATAR[h % AVATAR.length]; };
  const ago = (iso) => {
    const t = new Date(iso).getTime(); if (!t) return "";
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "just now"; if (m < 60) return m + " min ago";
    const h = Math.round(m / 60); if (h < 24) return h + " h ago";
    return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  };

  // Turn Google Drive share links into a direct image link.
  function imageSrc(image) {
    const s = String(image || "").trim();
    if (s.startsWith("scene:")) {
      const name = s.slice(6);
      return SCENES.some(([k]) => k === name) ? `assets/scenes/${name}.jpg` : `assets/scenes/coastal_barangay.jpg`;
    }
    const m = s.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/);
    if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1600`;
    return /^https:\/\//i.test(s) ? s : `assets/scenes/coastal_barangay.jpg`;
  }

  // ---------- rendering ----------
  const heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-10-9.2C.3 8.4 2.4 4 6.4 4c2.3 0 3.8 1.3 5.6 3.4C13.8 5.3 15.3 4 17.6 4c4 0 6.1 4.4 4.4 7.8C19.5 16.4 12 21 12 21z" fill="none" stroke="#1B1B1B" stroke-width="2"/></svg>';

  function postHTML(p, opts = {}) {
    const changes = (p.changes || []).filter((c) => String(c).trim());
    const isLiked = liked.has(p.id);
    return `
      <article class="post${opts.fresh ? " fresh" : ""}" data-id="${esc(p.id || "")}">
        <div class="post-head">
          <div class="avatar" style="background:${colourFor(p.name)}">${esc(initials(p.name))}</div>
          <div class="who"><b>${esc(p.name || "Your name")}</b><small>${esc(p.case || "Case area")}${p.sample ? ' · <span class="sample-flag">SAMPLE</span>' : ""}</small></div>
          <div class="year" aria-label="Year ${esc(p.year)}">${esc(p.year || "")}</div>
        </div>
        <h3>${esc(p.headline || "Your headline from the future")}</h3>
        <div class="post-img"><img src="${esc(imageSrc(p.image))}" alt="Image of ${esc(p.case || "the case area")} in ${esc(p.year || "the future")}" loading="lazy"></div>
        <div class="post-body">
          ${changes.length ? `<div><p class="micro">What changed</p><ol>${changes.map((c) => `<li>${esc(c)}</li>`).join("")}</ol></div>` : ""}
          ${p.quote ? `<blockquote class="quote"><p>“${esc(String(p.quote).replace(/^[“"]+|[”"]+$/g, ""))}”</p>${p.quoteBy ? `<cite>${esc(p.quoteBy)}</cite>` : ""}</blockquote>` : ""}
          ${p.story ? `<p class="story">${esc(p.story)}</p>` : ""}
        </div>
        <div class="post-foot">
          <span>${opts.preview ? "Preview" : "Posted from " + esc(p.year) + (p.timestamp ? " · shared " + esc(ago(p.timestamp)) : "")}</span>
          ${opts.preview ? "" : `<button type="button" class="like${isLiked ? " on" : ""}" data-like="${esc(p.id)}" aria-pressed="${isLiked}" aria-label="Like this post">${heart}<span>${Number(p.likes) || 0}</span></button>`}
        </div>
      </article>`;
  }

  function renderFeed(freshId) {
    const q = state.query.toLowerCase();
    let list = state.posts.filter((p) => !q || [p.name, p.case, p.headline, p.story].join(" ").toLowerCase().includes(q));
    if (state.sort === "liked") list = list.slice().sort((a, b) => (b.likes || 0) - (a.likes || 0));
    const box = $("#posts");
    if (!state.posts.length) {
      box.innerHTML = `<div class="empty"><strong>${state.loading ? "Loading the feed…" : "No posts yet"}</strong>${state.loading ? "" : "Be the first to post from the future."}</div>`;
    } else if (!list.length) {
      box.innerHTML = `<div class="empty"><strong>No matches</strong>Try another search.</div>`;
    } else {
      box.innerHTML = list.map((p) => postHTML(p, { fresh: p.id === freshId })).join("");
      box.querySelectorAll(".post-img img").forEach(guardImage);
    }
    const n = state.posts.length;
    $("#feedMeta").textContent = n ? `${n} post${n === 1 ? "" : "s"} from the future${q ? ` · ${list.length} shown` : ""}` : "";
  }

  function guardImage(img) {
    img.addEventListener("error", () => {
      const wrap = img.parentElement;
      wrap.classList.add("broken");
      wrap.textContent = "Image could not load. If it is a Google Drive link, set sharing to “Anyone with the link”.";
    }, { once: true });
  }

  // ---------- form ----------
  function buildForm() {
    const years = $("#years");
    years.innerHTML = YEARS.map((y) => `<button type="button" data-year="${y}" class="${y === state.year ? "on" : ""}">${y}</button>`).join("") +
      `<input type="number" name="yearOther" min="2026" max="2200" placeholder="Other" aria-label="Other year">`;
    years.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-year]"); if (!b) return;
      state.year = Number(b.dataset.year); form.yearOther.value = "";
      years.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      updatePreview();
    });
    form.yearOther.addEventListener("input", () => {
      const v = Number(form.yearOther.value);
      years.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
      state.year = v || CFG.defaultYear; updatePreview();
    });

    $("#scenes").innerHTML = SCENES.map(([k, label], i) => `
      <label class="scene"><input type="radio" name="scene" value="${k}" ${i === 0 ? "checked" : ""}>
        <img src="assets/scenes/${k}.jpg" alt=""><span>${label}</span></label>`).join("");

    $("#changes").innerHTML = [1, 2, 3, 4, 5].map((n) => `<li><input name="change" maxlength="160" aria-label="Change ${n}" placeholder="${n <= 3 ? "" : "Optional"}${n === 1 ? "Mangrove belt replanted along the shore" : ""}"></li>`).join("");

    const me = store.get(ME_KEY, {});
    if (me.name) form.name.value = me.name;
    if (me.case) form.case.value = me.case;
    if (me.code) form.code.value = me.code;
    if (!LIVE || !CFG.askClassCode) $("#codeField").style.display = "none";

    form.addEventListener("input", updatePreview);
    form.addEventListener("change", updatePreview);
    form.addEventListener("submit", submit);
    ["headline", "story"].forEach((n) => {
      const el = form[n], out = $(`.count[data-for="${n}"]`);
      const upd = () => { out.textContent = `${el.value.length} / ${el.maxLength}`; };
      el.addEventListener("input", upd); upd();
    });

    $("#composerToggle").addEventListener("click", () => {
      setComposer($("#composerToggle").getAttribute("aria-expanded") !== "true");
    });
  }

  function readForm() {
    const url = form.imageUrl.value.trim();
    const own = $("#ownImage").open && url;
    return {
      name: form.name.value.trim(),
      case: form.case.value.trim(),
      year: state.year,
      headline: form.headline.value.trim(),
      image: own ? url : "scene:" + (form.scene.value || "coastal_barangay"),
      changes: [...form.querySelectorAll('input[name="change"]')].map((i) => i.value.trim()).filter(Boolean),
      quote: form.quote.value.trim(),
      quoteBy: form.quoteBy.value.trim(),
      story: form.story.value.trim(),
    };
  }

  function updatePreview() {
    $("#preview").innerHTML = postHTML(readForm(), { preview: true });
    const img = $("#preview .post-img img"); if (img) guardImage(img);
  }

  function validate(p) {
    if (!p.name) return "Add your name or group.";
    if (!p.case) return "Add your case area.";
    if (!(p.year >= 2026 && p.year <= 2200)) return "Choose a future year between 2026 and 2200.";
    if (!p.headline) return "Write a headline.";
    if (!/^scene:/.test(p.image) && !/^https:\/\//i.test(p.image)) return "Image links must start with https://";
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
    btn.disabled = true; msg.className = "form-msg"; msg.textContent = "Posting…";
    store.set(ME_KEY, { name: p.name, case: p.case, code: form.code.value.trim() });
    try {
      const saved = await api.create(p, form.code.value.trim());
      state.posts.unshift(saved);
      state.sort = "new"; setSortButtons();
      renderFeed(saved.id);
      msg.textContent = "";
      form.headline.value = ""; form.quote.value = ""; form.quoteBy.value = ""; form.story.value = ""; form.imageUrl.value = "";
      form.querySelectorAll('input[name="change"]').forEach((i) => { i.value = ""; });
      form.querySelectorAll(".vision input").forEach((i) => { i.checked = false; });
      updatePreview();
      toast(`Posted to ${saved.year}`);
      const el = document.querySelector(`.post[data-id="${CSS.escape(saved.id)}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      msg.textContent = err.message || "Could not post. Please try again.";
      msg.className = "form-msg err";
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- data ----------
  const SAMPLES = [
    { id: "sample-1", sample: true, name: "Barangay Sample News", case: "Fictional coastal barangay", year: 2050,
      headline: "Creek road stays open through a record typhoon", image: "scene:coastal_barangay",
      changes: ["Mangrove belt replanted along the shore", "Creek culvert widened and cleared every month", "Waste collection reaches the upstream sitios", "Houses raised, with rain tanks and solar roofs"],
      quote: "The morning after the storm, our kids still walked to school.", quoteBy: "Lola Remy, sari-sari store owner",
      story: "The creek road no longer floods after storms. Mangroves slow the waves, the culvert stays clear, and families spend less on repairs.",
      likes: 12, timestamp: new Date(Date.now() - 864e5).toISOString() },
    { id: "sample-2", sample: true, name: "Hill Valley Post", case: "Fictional mountain municipality", year: 2060,
      headline: "Spring-fed water tanks keep every ward supplied through the dry season", image: "scene:mountain_village",
      changes: ["Springs protected and recharge ponds dug above the village", "Every household has a rain tank", "A farmer cooperative shares weather alerts by phone"],
      quote: "We stopped walking two hours for water. That time went back to school and the fields.", quoteBy: "Maya, ward youth volunteer",
      story: "Dry seasons still come, but the village plans for them. Recharge ponds refill the springs, and the cooperative decides together when to store and when to share.",
      likes: 7, timestamp: new Date(Date.now() - 2 * 864e5).toISOString() },
  ];

  const api = {
    async list() {
      if (!LIVE) return store.get(DEMO_KEY, null) || SAMPLES.slice();
      const r = await fetch(CFG.scriptUrl + (CFG.scriptUrl.includes("?") ? "&" : "?") + "t=" + Date.now());
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || "Could not load the feed.");
      return data.posts || [];
    },
    async create(p, code) {
      if (!LIVE) {
        const post = Object.assign({ id: "local-" + Date.now().toString(36), timestamp: new Date().toISOString(), likes: 0 }, p);
        const list = store.get(DEMO_KEY, null) || SAMPLES.slice();
        list.unshift(post); store.set(DEMO_KEY, list);
        return post;
      }
      const data = await postJSON({ action: "post", code, post: p });
      if (!data.ok) throw new Error(data.error || "Could not post.");
      return data.post;
    },
    async like(id) {
      if (!LIVE) {
        const list = store.get(DEMO_KEY, null) || SAMPLES.slice();
        const p = list.find((x) => x.id === id); if (p) p.likes = (p.likes || 0) + 1;
        store.set(DEMO_KEY, list); return p ? p.likes : 0;
      }
      const data = await postJSON({ action: "like", id });
      if (!data.ok) throw new Error(data.error || "Could not like.");
      return data.likes;
    },
  };

  // Plain-text body keeps this a "simple" request, which Apps Script accepts from GitHub Pages.
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
    } catch (err) {
      if (!quiet) { $("#posts").innerHTML = `<div class="empty"><strong>Could not load the feed</strong>${esc(err.message)}. Check the Apps Script URL in config.js.</div>`; }
    } finally {
      state.loading = false;
    }
  }

  // ---------- feed interactions ----------
  function setSortButtons() { document.querySelectorAll(".seg button").forEach((b) => b.classList.toggle("on", b.dataset.sort === state.sort)); }

  function bindFeed() {
    $("#posts").addEventListener("click", async (e) => {
      const b = e.target.closest("button[data-like]"); if (!b) return;
      const id = b.dataset.like;
      if (liked.has(id)) { toast("You already liked this post"); return; }
      liked.add(id); store.set(LIKED_KEY, [...liked]);
      const p = state.posts.find((x) => x.id === id); if (p) p.likes = (p.likes || 0) + 1;
      b.classList.add("on"); b.setAttribute("aria-pressed", "true"); b.querySelector("span").textContent = p ? p.likes : "";
      try { const n = await api.like(id); if (p && n) { p.likes = n; b.querySelector("span").textContent = n; } } catch (err) { /* keep the optimistic count */ }
    });
    $("#search").addEventListener("input", (e) => { state.query = e.target.value.trim(); renderFeed(); });
    document.querySelector(".seg").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-sort]"); if (!b) return;
      state.sort = b.dataset.sort; setSortButtons(); renderFeed();
    });
    $("#refresh").addEventListener("click", () => load(false));
    setInterval(() => { if (!document.hidden && !form.contains(document.activeElement)) load(true); }, 60000);
  }

  function setComposer(open) {
    const t = $("#composerToggle");
    t.setAttribute("aria-expanded", String(open));
    t.querySelector(".chev").textContent = open ? "▾" : "▸";
    form.hidden = !open;
  }

  let toastTimer;
  function toast(t) {
    const el = $("#toast"); el.textContent = t; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  }

  // ---------- start ----------
  function start() {
    if (CFG.title) $("#title").textContent = CFG.title;
    if (CFG.activity) $("#activity").textContent = CFG.activity;
    if (CFG.course) $("#course").textContent = CFG.course;
    if (!LIVE) {
      const b = $("#banner");
      b.hidden = false;
      b.innerHTML = "<b>Demo mode.</b> Posts are saved only in this browser. Add your Apps Script web app URL in <code>config.js</code> to share one feed with the class.";
    }
    if (window.matchMedia("(max-width: 860px)").matches) setComposer(false);
    buildForm(); updatePreview(); bindFeed(); load(false);
  }
  start();
})();

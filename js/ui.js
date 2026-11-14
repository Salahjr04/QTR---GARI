/* Small UI kit shared by the rider app: icons, toast, modal, and the simulated payment flows. */
window.Gari = window.Gari || {};
(() => {
  "use strict";
  const G = window.Gari, t = (...a) => G.t(...a);
  const P = (d, extra = "") => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
  const I = {
    bike: P('<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5l4-7h6l3 7M9.5 9.5l-1.5-3H6M15.5 9.5l-3 7h-7"/>'),
    lock: P('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    unlock: P('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>'),
    clock: P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    route: P('<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h8"/>'),
    camera: P('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
    check: P('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    x: P('<path d="M6 6l12 12M18 6L6 18"/>'),
    warn: P('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.01"/>'),
    info: P('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>'),
    card: P('<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h4"/>'),
    chevron: P('<path d="M9 6l6 6-6 6"/>', 'class="ico chev"'),
    star: P('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
    user: P('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    history: P('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>'),
    globe: P('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/>'),
    moon: P('<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>'),
    sun: P('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    chart: P('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    logout: P('<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>'),
    spark: P('<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/>'),
    pin: P('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
    walk: P('<circle cx="13" cy="4" r="2"/><path d="M10 21l2-6 3 3v3M8 12l2-4h4l2 4 3 1M12 8l-1 5"/>'),
    battery: P('<rect x="2.5" y="7" width="17" height="10" rx="2"/><path d="M22 10.5v3"/>'),
    bluetooth: P('<path d="M7 7l10 10-5 4V3l5 4L7 17"/>'),
    tag: P('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>'),
    help: P('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>'),
  };

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let toastT = 0;
  function toast(msg, kind = "") {
    const el = $("#toast"); if (!el) return;
    el.textContent = msg; el.className = "toast show " + kind; clearTimeout(toastT);
    toastT = setTimeout(() => (el.className = "toast"), 2600);
  }

  const modal = {
    onClose: null,
    open(html, { onClose, cls = "" } = {}) {
      const w = $("#modal"), b = $("#modalBody"); b.className = "modal " + cls; b.innerHTML = html; w.hidden = false;
      requestAnimationFrame(() => w.classList.add("open")); this.onClose = onClose || null;
      w.onclick = (e) => { if (e.target === w) this.close(); };
      b.querySelectorAll("[data-close]").forEach((x) => (x.onclick = () => this.close()));
      return b;
    },
    close() { const w = $("#modal"); w.classList.remove("open"); setTimeout(() => (w.hidden = true), 180); const f = this.onClose; this.onClose = null; f && f(); },
  };

  // ---------------- payment methods (prototype: nothing is charged)
  const METHOD_ICON = {
    applepay: `<span class="pm-logo apple"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M16.4 12.6c0-2.4 2-3.6 2.1-3.6-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.6-1-2.6-4zM14 5.6c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z"/></svg>Pay</span>`,
    knet: `<span class="pm-logo knet">KNET</span>`,
    visa: `<span class="pm-logo visa">VISA</span>`,
  };
  const methodLabel = (pm) => (pm?.type === "visa" ? `Visa •••• ${pm.last4}` : pm?.type === "knet" ? t("knet") : pm?.type === "applepay" ? "Apple Pay" : "");
  function getPM(user) { return G.Store.get().users[user.id]?.payment || null; }
  function setPM(user, pm) { G.Store.update((db) => { db.users[user.id] = { ...(db.users[user.id] || { id: user.id, name: user.name }), payment: pm }; G.Store.log("PUT", `/users/${user.id}/payment`, { type: pm.type, last4: pm.last4 || null }); }); }

  // choose / add a payment method. resolves with the method or null
  function choosePayment(user) {
    return new Promise((resolve) => {
      const cur = getPM(user);
      const row = (type, sub) => `<button class="pm-row ${cur?.type === type ? "sel" : ""}" data-pm="${type}">${METHOD_ICON[type]}<span class="pm-txt"><b>${type === "visa" ? t("visa") : t(type)}</b>${sub ? `<small>${sub}</small>` : ""}</span>${cur?.type === type ? `<span class="chip good">${t("default")}</span>` : I.chevron}</button>`;
      const b = modal.open(`
        <div class="modal-head"><h3>${t("wallet")}</h3><button class="icon-btn" data-close aria-label="${t("close")}">${I.x}</button></div>
        <div class="pm-list">${row("applepay")}${row("knet")}${row("visa", cur?.type === "visa" ? "•••• " + cur.last4 : t("addCard"))}</div>
        <p class="demo-note">${I.info}<span>${t("demoPay")}</span></p>`, { onClose: () => resolve(getPM(user)) });
      b.querySelectorAll("[data-pm]").forEach((el) => (el.onclick = () => {
        const type = el.dataset.pm;
        if (type === "visa") return addCard(user).then((pm) => { if (pm) { modal.onClose = null; modal.close(); resolve(pm); } });
        const pm = { type }; setPM(user, pm); modal.onClose = null; modal.close(); toast("✓ " + methodLabel(pm)); resolve(pm);
      }));
    });
  }
  function addCard(user) {
    return new Promise((resolve) => {
      const b = modal.open(`
        <div class="modal-head"><button class="icon-btn" data-back aria-label="${t("back")}">${I.chevron}</button><h3>${t("addCard")}</h3><span></span></div>
        <div class="card-preview"><span class="pm-logo visa">VISA</span><div class="cp-num num" id="cpNum">•••• •••• •••• ••••</div><div class="cp-row"><span id="cpName">${esc(user.name)}</span><span class="num" id="cpExp">MM/YY</span></div></div>
        <form id="cardForm" class="card-form" novalidate>
          <label class="field"><span>${t("cardNumber")}</span><input class="num" id="ccNum" inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242" dir="ltr"></label>
          <div class="row2"><label class="field"><span>${t("expiry")}</span><input class="num" id="ccExp" inputmode="numeric" autocomplete="cc-exp" placeholder="12/28" dir="ltr"></label>
          <label class="field"><span>${t("cvv")}</span><input class="num" id="ccCvv" inputmode="numeric" autocomplete="cc-csc" placeholder="123" dir="ltr"></label></div>
          <button class="btn btn-primary btn-block" type="submit">${t("save")}</button>
          <p class="demo-note">${I.info}<span>${t("demoPay")}</span></p>
        </form>`, { onClose: () => resolve(null) });
      const num = $("#ccNum", b), exp = $("#ccExp", b);
      num.oninput = () => { const v = num.value.replace(/\D/g, "").slice(0, 16); num.value = v.replace(/(.{4})/g, "$1 ").trim(); $("#cpNum", b).textContent = (v + "•".repeat(16 - v.length)).replace(/(.{4})/g, "$1 ").trim(); };
      exp.oninput = () => { let v = exp.value.replace(/\D/g, "").slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2); exp.value = v; $("#cpExp", b).textContent = v || "MM/YY"; };
      $("[data-back]", b).onclick = () => { modal.onClose = null; modal.close(); setTimeout(() => choosePayment(user).then(resolve), 200); };
      $("#cardForm", b).onsubmit = (e) => {
        e.preventDefault(); const digits = num.value.replace(/\D/g, "");
        if (digits.length < 12) { num.focus(); num.classList.add("bad"); return; }
        const pm = { type: "visa", last4: digits.slice(-4) }; setPM(user, pm); modal.onClose = null; modal.close(); toast("✓ " + methodLabel(pm)); resolve(pm);
      };
    });
  }
  // run the payment for an amount with the user's method; resolves true when "paid"
  function pay(user, amount) {
    const pm = getPM(user) || { type: "applepay" };
    return new Promise((resolve) => {
      if (pm.type === "applepay") {
        const b = modal.open(`
          <div class="applepay-sheet"><div class="ap-head">${METHOD_ICON.applepay}<button class="icon-btn" data-close>${I.x}</button></div>
          <div class="ap-row"><span>GARI</span><b class="num">${G.money(amount)}</b></div>
          <div class="ap-row muted"><span>Card</span><span>Apple Card •••• 1048</span></div>
          <div class="ap-side" id="apSide"><div class="ap-btn-anim"></div><span>${t("applePayConfirm")}</span></div>
          <button class="btn btn-block ap-pay" id="apPay">${t("confirm")}</button></div>`, { cls: "sheet-modal", onClose: () => resolve(false) });
        $("#apPay", b).onclick = () => { $("#apPay", b).innerHTML = `<span class="spinner"></span>`; setTimeout(() => { $("#apSide", b).innerHTML = `<div class="ap-done">${I.check}</div><span>${t("paid")}</span>`; setTimeout(() => { modal.onClose = null; modal.close(); resolve(true); }, 700); }, 900); };
      } else if (pm.type === "knet") {
        const b = modal.open(`
          <div class="knet-page"><div class="knet-bar"><span class="pm-logo knet">KNET</span><span class="muted small">${t("knetRedirect")}</span></div>
          <div class="knet-amt"><span>GARI</span><b class="num">${G.money(amount)}</b></div>
          <label class="field"><span>${t("knetBank")}</span><select id="knBank"><option>NBK</option><option>KFH</option><option>Boubyan</option><option>Gulf Bank</option><option>Burgan</option><option>Warba</option></select></label>
          <label class="field"><span>${t("cardNumber")}</span><input class="num" dir="ltr" value="•••• •••• 5821" readonly></label>
          <label class="field"><span>${t("knetPin")}</span><input class="num" dir="ltr" type="password" value="1234"></label>
          <div class="row2"><button class="btn btn-secondary" data-close>${t("cancel")}</button><button class="btn btn-primary" id="knPay">${t("confirm")}</button></div></div>`, { onClose: () => resolve(false) });
        $("#knPay", b).onclick = () => { $("#knPay", b).innerHTML = `<span class="spinner"></span>`; setTimeout(() => { modal.onClose = null; modal.close(); resolve(true); }, 1100); };
      } else {
        const b = modal.open(`<div class="modal-head"><h3>${t("payTitle")}</h3><span></span></div>
          <div class="pay-card">${METHOD_ICON.visa}<span>•••• ${pm.last4}</span><b class="num">${G.money(amount)}</b></div>
          <div class="progress-line"><i></i></div><p class="muted center small">3-D Secure · ${t("paying")}</p>`, {});
        setTimeout(() => { modal.onClose = null; modal.close(); resolve(true); }, 1500);
      }
    });
  }

  G.UI = { I, $, esc, toast, modal, choosePayment, addCard, pay, getPM, methodLabel, METHOD_ICON };
})();

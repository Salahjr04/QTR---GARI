/* Gari strings, Arabic (default, RTL) and English. t("key", {n: 3}) fills {n}. */
window.Gari = window.Gari || {};
(() => {
  "use strict";
  const S = {
    ar: {
      appName: "قاري", tagline: "دراجتك أقرب مما تتوقع",
      signApple: "المتابعة مع Apple", signGoogle: "المتابعة مع Google", or: "أو",
      username: "اسم المستخدم", password: "كلمة السر", signIn: "تسجيل الدخول", createHint: "إذا ما عندك حساب، نسوي لك واحد على طول",
      skip: "تخطي", terms: "بالمتابعة توافق على الشروط وسياسة الخصوصية",
      needUser: "اكتب اسم المستخدم", needPass: "كلمة السر لازم ٤ أحرف أو أكثر", welcome: "هلا {name}",
      providerSoon: "نسخة تجريبية: الدخول عن طريق {p} محاكاة",
      locate: "موقعي", layers: "توقعات الزحمة", menu: "القائمة",
      nearest: "أقرب دراجة", bike: "دراجة", walk: "{n} د مشي", away: "{d} عنك", battery: "بطارية القفل",
      unlockApp: "افتح القفل من التطبيق", reserve: "احجزها · {fee}", navigate: "امشِ لها بدون حجز",
      nearHint: "أنت جنب الدراجة، افتح القفل مباشرة", farHint: "الدراجة بعيدة شوي. الحجز يثبتها لك {n} دقيقة",
      priceLine: "{unlock} فتح القفل (يشمل أول {m} د) · {block} لكل {m} د بعدها",
      pricing: "الأسعار", pUnlock: "فتح القفل", pUnlockSub: "يشمل أول {m} دقايق", pBlock: "كل {m} دقايق بعدها", pReserve: "حجز دراجة بعيدة", pReserveSub: "يثبت الدراجة {n} دقيقة",
      noBikes: "ما في دراجات متاحة قريب منك الحين",
      bikesAt: "{n} دراجات", parkingZone: "منطقة ركن قاري",
      reservedTitle: "محجوزة لك", holdLeft: "باقي على الحجز", walkThere: "امشِ للدراجة", walking: "قاعد تمشي…", imHere: "وصلت",
      cancelRes: "إلغاء الحجز", cancelResQ: "تلغي الحجز؟ رسوم الحجز ما تنرد.", resExpired: "خلص وقت الحجز", resCancelled: "انلغى الحجز",
      payFirst: "اختار طريقة الدفع أول", paywith: "الدفع عن طريق",
      bleConnecting: "نتصل بالقفل الذكي عن طريق البلوتوث…", bleAuth: "نتحقق من الهوية…", bleOpen: "انفتح القفل", bleLocking: "نقفل الدراجة…", bleLocked: "انقفلت الدراجة",
      riding: "الرحلة شغالة", time: "الوقت", cost: "التكلفة", distance: "المسافة", speed: "السرعة", kmh: "كم/س",
      destination: "وين رايح؟", chooseDest: "اختار منطقة ركن", rideTo: "روح لـ {name}", freeRide: "ركوب حر",
      endRide: "إنهاء الرحلة", holdToLock: "اضغط مطولاً لقفل الدراجة", lockOnlyApp: "القفل يتسكر ويتفتح من التطبيق بس",
      outOfZone: "أنت برا منطقة الركن ({d}). الركن لازم يكون داخل منطقة قاري", goNearestZone: "روح لأقرب منطقة",
      lockedTitle: "انقفلت الدراجة", meterRunning: "العداد بعده شغال لين تتأكد الصورة",
      takePhoto: "صوّر الدراجة مع القفل", photoHint: "خل الدراجة كاملة والقفل الأخضر على العجلة واضح بالصورة",
      reopen: "أبي أكمل الركوب",
      analyzing: "الذكاء الاصطناعي يحلل الصورة…",
      ck_quality: "وضوح الصورة والإضاءة", ck_bike: "في دراجة بالصورة", ck_lock: "القفل الذكي ظاهر", ck_onwheel: "القفل مركب على العجلة",
      ck_lockstate: "القفل مسكّر (من القفل الذكي)", ck_zone: "داخل منطقة ركن قاري", ck_upright: "واقفة وما تسد الطريق",
      d_dark: "الصورة غامقة", d_bright: "الصورة محروقة", d_blurry: "الصورة مو واضحة", d_none: "مو ظاهر", d_loose: "القفل مو على العجلة", d_unsure: "مو متأكد، بتنراجع",
      d_open: "القفل مفتوح", d_blocking: "تسد الطريق", d_fallen: "طايحة", d_m: "يبعد {n} م",
      vPass: "الصورة مقبولة", vPassSub: "وقف العداد", vReview: "مقبولة مع مراجعة", vReviewSub: "وقف العداد، وفريقنا بيراجع الصورة",
      vFail: "لازم تعيد التصوير", vFailSub: "العداد بعده شغال", retake: "صوّر مرة ثانية", engineDevice: "تحليل على الجهاز", engineClaude: "تحليل Claude",
      payTitle: "الدفع", payNow: "ادفع {total}", paid: "تم الدفع", paying: "جاري الدفع…",
      unlockFee: "فتح القفل", reserveFee: "رسوم الحجز", timeFee: "الوقت ({n} × {m} د)", total: "المجموع",
      receipt: "انتهت الرحلة", thanks: "شكراً لأنك ركبت قاري", rate: "قيّم رحلتك", done: "تم", parkedAt: "انركنت عند",
      wallet: "طرق الدفع", knet: "كي نت", visa: "فيزا / ماستركارد", applepay: "Apple Pay", addCard: "إضافة بطاقة", cardNumber: "رقم البطاقة", expiry: "الانتهاء", cvv: "CVV",
      save: "حفظ", cancel: "إلغاء", close: "إغلاق", back: "رجوع", default: "الافتراضي", setDefault: "خله الافتراضي",
      knetRedirect: "بتنتقل لبوابة كي نت (محاكاة)", knetBank: "البنك", knetPin: "الرقم السري", confirm: "تأكيد", applePayConfirm: "اضغط مرتين للدفع (محاكاة)",
      demoPay: "نسخة تجريبية: ما في أي خصم حقيقي",
      history: "رحلاتي", noRides: "ما عندك رحلات للحين", profile: "الحساب", language: "اللغة", theme: "المظهر", light: "فاتح", dark: "داكن", auto: "تلقائي",
      admin: "لوحة الإدارة", signOut: "تسجيل الخروج", guest: "ضيف", signInToRide: "سجّل دخول عشان تركب",
      aiTitle: "توقعات الذكاء الاصطناعي", trafficNow: "الزحمة الحين", low: "خفيفة", medium: "متوسطة", high: "زحمة",
      bestTime: "أفضل وقت للركوب", demandHere: "الطلب على الدراجات قريب منك", mayRunOut: "ممكن تخلص الدراجات بـ {name}",
      in1h: "بعد ساعة", now: "الحين", plus: "+{n} س", legendTraffic: "زحمة الشوارع", legendDemand: "الطلب المتوقع",
      simBadge: "محاكاة ×{n}", setLoc: "حط موقعي هني", locSet: "تغير موقعك",
      bikeTaken: "أحد سبقك على هذي الدراجة", min: "د", m: "م", km: "كم", kd: "د.ك",
      howItWorks: "شلون تشتغل", step1: "لقِ أقرب دراجة على الخريطة", step2: "افتح القفل من التطبيق", step3: "اركب واستمتع", step4: "اقفلها وصوّرها عشان يوقف العداد",
    },
    en: {
      appName: "Gari", tagline: "Your ride is closer than you think",
      signApple: "Continue with Apple", signGoogle: "Continue with Google", or: "or",
      username: "Username", password: "Password", signIn: "Sign in", createHint: "No account? We'll create one for you right away",
      skip: "Skip", terms: "By continuing you agree to the Terms and Privacy Policy",
      needUser: "Enter a username", needPass: "Password needs 4+ characters", welcome: "Welcome, {name}",
      providerSoon: "Prototype: {p} sign-in is simulated",
      locate: "My location", layers: "Traffic forecast", menu: "Menu",
      nearest: "Nearest bike", bike: "Bike", walk: "{n} min walk", away: "{d} away", battery: "Lock battery",
      unlockApp: "Unlock in the app", reserve: "Reserve · {fee}", navigate: "Walk there without booking",
      nearHint: "You're next to the bike, unlock it now", farHint: "This bike is a bit far. Booking holds it for {n} min",
      priceLine: "{unlock} to unlock (first {m} min) · {block} per {m} min after",
      pricing: "Pricing", pUnlock: "Unlock", pUnlockSub: "Includes the first {m} minutes", pBlock: "Every {m} minutes after", pReserve: "Book a bike that's far", pReserveSub: "Holds the bike for {n} minutes",
      noBikes: "No bikes available near you right now",
      bikesAt: "{n} bikes", parkingZone: "Gari parking zone",
      reservedTitle: "Reserved for you", holdLeft: "Hold time left", walkThere: "Walk to the bike", walking: "Walking…", imHere: "I'm here",
      cancelRes: "Cancel booking", cancelResQ: "Cancel the booking? The booking fee isn't refunded.", resExpired: "Your booking expired", resCancelled: "Booking cancelled",
      payFirst: "Choose a payment method first", paywith: "Pay with",
      bleConnecting: "Connecting to the smart lock over Bluetooth…", bleAuth: "Verifying…", bleOpen: "Lock open", bleLocking: "Locking the bike…", bleLocked: "Bike locked",
      riding: "Ride in progress", time: "Time", cost: "Cost", distance: "Distance", speed: "Speed", kmh: "km/h",
      destination: "Where to?", chooseDest: "Choose a parking zone", rideTo: "Ride to {name}", freeRide: "Free ride",
      endRide: "End ride", holdToLock: "Press and hold to lock the bike", lockOnlyApp: "The lock only opens and closes from the app",
      outOfZone: "You're outside a parking zone ({d}). Rides must end inside a Gari zone", goNearestZone: "Go to nearest zone",
      lockedTitle: "Bike locked", meterRunning: "The meter keeps running until the photo is verified",
      takePhoto: "Photograph the bike and lock", photoHint: "Fit the whole bike in, with the green lock clearly on the wheel",
      reopen: "Keep riding",
      analyzing: "AI is checking your photo…",
      ck_quality: "Photo sharp and well lit", ck_bike: "Bicycle in the photo", ck_lock: "Smart lock visible", ck_onwheel: "Lock is on the wheel",
      ck_lockstate: "Lock closed (smart lock report)", ck_zone: "Inside a Gari parking zone", ck_upright: "Upright, not blocking the way",
      d_dark: "Too dark", d_bright: "Overexposed", d_blurry: "Blurry", d_none: "Not found", d_loose: "Lock is not on the wheel", d_unsure: "Not sure, sent for review",
      d_open: "Lock is open", d_blocking: "Blocking the way", d_fallen: "Fallen over", d_m: "{n} m away",
      vPass: "Photo accepted", vPassSub: "Meter stopped", vReview: "Accepted, under review", vReviewSub: "Meter stopped; our team will review the photo",
      vFail: "Please retake the photo", vFailSub: "The meter is still running", retake: "Retake photo", engineDevice: "On-device analysis", engineClaude: "Claude analysis",
      payTitle: "Payment", payNow: "Pay {total}", paid: "Paid", paying: "Processing…",
      unlockFee: "Unlock", reserveFee: "Booking", timeFee: "Time ({n} × {m} min)", total: "Total",
      receipt: "Ride complete", thanks: "Thanks for riding Gari", rate: "Rate your ride", done: "Done", parkedAt: "Parked at",
      wallet: "Payment methods", knet: "KNET", visa: "Visa / Mastercard", applepay: "Apple Pay", addCard: "Add card", cardNumber: "Card number", expiry: "Expiry", cvv: "CVV",
      save: "Save", cancel: "Cancel", close: "Close", back: "Back", default: "Default", setDefault: "Make default",
      knetRedirect: "You'll be taken to the KNET gateway (simulated)", knetBank: "Bank", knetPin: "PIN", confirm: "Confirm", applePayConfirm: "Double-click to pay (simulated)",
      demoPay: "Prototype: nothing is actually charged",
      history: "My rides", noRides: "No rides yet", profile: "Account", language: "Language", theme: "Appearance", light: "Light", dark: "Dark", auto: "Auto",
      admin: "Admin dashboard", signOut: "Sign out", guest: "Guest", signInToRide: "Sign in to ride",
      aiTitle: "AI forecast", trafficNow: "Traffic now", low: "Light", medium: "Moderate", high: "Heavy",
      bestTime: "Best time to ride", demandHere: "Bike demand near you", mayRunOut: "Bikes may run low at {name}",
      in1h: "In 1 hour", now: "Now", plus: "+{n}h", legendTraffic: "Street traffic", legendDemand: "Expected demand",
      simBadge: "Simulation ×{n}", setLoc: "Set my location here", locSet: "Location updated",
      bikeTaken: "Someone just took this bike", min: "min", m: "m", km: "km", kd: "KD",
      howItWorks: "How it works", step1: "Find the nearest bike on the map", step2: "Unlock it from the app", step3: "Ride and enjoy", step4: "Lock it and take a photo to stop the meter",
    },
  };
  const LANG_KEY = "gari.lang";
  let lang = (() => { try { return localStorage.getItem(LANG_KEY) || "ar"; } catch { return "ar"; } })();
  function apply() { document.documentElement.lang = lang; document.documentElement.dir = lang === "ar" ? "rtl" : "ltr"; }
  function t(k, vars) { let s = (S[lang] && S[lang][k]) ?? S.en[k] ?? k; if (vars) for (const [a, b] of Object.entries(vars)) s = s.split(`{${a}}`).join(b); return s; }
  function setLang(l) { lang = l; try { localStorage.setItem(LANG_KEY, l); } catch {} apply(); }
  // numbers: Western digits in both languages (common in Kuwaiti apps), currency label localised
  const money = (v) => (lang === "ar" ? `${window.Gari.KD(v)} د.ك` : `KD ${window.Gari.KD(v)}`);
  const dist = (m) => (m < 1000 ? `${Math.round(m)} ${t("m")}` : `${(m / 1000).toFixed(1)} ${t("km")}`);
  const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60; return (h ? h + ":" + String(mm).padStart(2, "0") : mm) + ":" + String(ss).padStart(2, "0"); };
  const hhmm = (t) => { const d = new Date(t + 3 * 3600000); return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0"); };
  // theme
  const THEME_KEY = "gari.theme";
  function getTheme() { try { return localStorage.getItem(THEME_KEY) || "auto"; } catch { return "auto"; } }
  function setTheme(v) { try { localStorage.setItem(THEME_KEY, v); } catch {} if (v === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", v); }
  apply(); setTheme(getTheme());
  Object.assign(window.Gari, { t, setLang, getLang: () => lang, money, dist, clock, hhmm, getTheme, setTheme });
})();

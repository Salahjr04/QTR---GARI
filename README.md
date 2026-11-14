# Gari · قاري

Gari is an AI-powered bike-sharing platform in Kuwait, offering convenient, affordable bicycle rentals through a mobile-friendly web app. Built by Team QTL for Kuwait AI Hackathon 2026.

**قاري**: تأجير دراجات بمحافظة العاصمة. تفتح الموقع، تشوف أقرب دراجة على الخريطة، تفتح القفل الذكي من التطبيق، تركب، وبالنهاية تقفلها وتصوّرها. الذكاء الاصطناعي يتأكد من الصورة وبعدها بس يوقف العداد.

| | Link |
|---|---|
| Rider app (تطبيق المستخدم) | `index.html` |
| Admin dashboard + simulator (لوحة الإدارة والمحاكي) | `admin.html` |
| Sample photos to upload (صور تجريبية) | [`test-photos/`](test-photos/) |

> **للفريق ولأي AI يكمّل الشغل:** اقرأوا [`CLAUDE.md`](CLAUDE.md) أول. التطبيق ٨٠٪ خالص: عدّلوا وحسّنوا وضيفوا ميزات، بس لا تمسحون ميزة ولا تغيّرون الثيم أو الألوان أو الأسعار.
>
> **Team & any AI continuing this work:** read [`CLAUDE.md`](CLAUDE.md) first.

---

## بالعربي

### شنو يسوي
1. **تسجيل الدخول**: Apple أو Google (محاكاة) أو اسم مستخدم وكلمة سر. وفيه زر «تخطي» خفيف تحت.
2. **أول ما تفتح**: خريطة محافظة العاصمة بشوارعها الحقيقية (OpenStreetMap)، وأقرب دراجة لك ظاهرة وتنبض.
3. **الحجز**: إذا الدراجة بعيدة عنك (أكثر من ١٠٠ م) تقدر تحجزها بـ **0.250 د.ك** وتنمسك لك ١٥ دقيقة، ويطلع لك طريق المشي عليها. إذا أنت جنبها تفتحها على طول بدون حجز.
4. **فتح القفل**: القفل الذكي ما ينفتح ولا يتسكر إلا من التطبيق (بلوتوث، محاكاة). فتح القفل بـ **1.000 د.ك** ويشمل أول ١٠ دقايق.
5. **الركوب**: كل **١٠ دقايق بعدها 0.100 د.ك**. تختار منطقة الركن اللي رايح لها، والدراجة تمشي على الشوارع الحقيقية.
6. **إنهاء الرحلة**: تضغط مطوّل عشان تقفل الدراجة. **العداد يظل شغال** لين تصوّر الدراجة.
7. **الصورة**: الذكاء الاصطناعي يحلل الصورة: وضوح وإضاءة، في دراجة؟، القفل الأخضر ظاهر؟، القفل على العجلة؟، القفل مسكّر (من القفل نفسه)، وأنت داخل منطقة ركن قاري (GPS). إذا كله تمام يوقف العداد.
8. **الدفع**: كي نت، فيزا، Apple Pay (كلها محاكاة، ما في خصم حقيقي) وبعدها الإيصال.
9. **توقعات الزحمة** (زر ✦ فوق): الذكاء الاصطناعي يلوّن الشوارع حسب الزحمة المتوقعة، ويبين الطلب على الدراجات بكل منطقة، وأفضل وقت للركوب، ووين ممكن تخلص الدراجات. تقدر تشوف الحين، +١ س، +٢ س، +٣ س.
10. **عربي / English** و**فاتح / داكن / تلقائي** من القائمة.

### لوحة الإدارة (`admin.html`)
- نظرة عامة: الإيراد، الرحلات، اللي يركبون الحين، الدراجات المتاحة، متوسط الرحلة، نسبة الصور المقبولة من أول مرة، ورسم «الرحلات بالساعة: الفعلي مقابل توقع الذكاء الاصطناعي».
- خريطة حية: الدراجات، الراكبين، زحمة الشوارع، والطلب المتوقع.
- توقعات الذكاء الاصطناعي: الطلب للـ ١٢ ساعة الجاية، مؤشر الزحمة، كل منطقة (نقص / مضبوط / زيادة)، واقتراحات نقل دراجات تقدر تنفذها.
- الرحلات: كل رحلة مع الصورة والفحوصات وطلبات الـ API.
- **المحاكي**: سرعة الوقت ×1 لين ×600 (مثلاً ×30 = كل ثانية حقيقية ٣٠ ثانية)، تقديم الوقت، الصبح/الظهر/المسا/الليل، يوم دوام أو جمعة، مستوى الطلب، الطقس، الفعاليات، نسبة الصور المرفوضة والركن برا المنطقة.
- الإعدادات: كل الأسعار تتغير، ومفتاح Claude اختياري لتحليل الصور.

**مهم:** الأدمن وتطبيق المستخدم يشتغلون على نفس البيانات إذا فتحتهم بنفس المتصفح (تبويبين). سرعة الوقت تمشي على الاثنين.

### الصور التجريبية
بمجلد [`test-photos/`](test-photos/) سبع صور برا التطبيق. نزّلها على جوالك أو جهازك، وبالخطوة الأخيرة اضغط «صوّر الدراجة مع القفل» واختارها. كل صورة نتيجتها مكتوبة في [`test-photos/README.md`](test-photos/README.md).

---

## In English

### Run it
Static files, no build step.
```bash
python3 -m http.server 8000
# rider app:  http://localhost:8000/
# admin:      http://localhost:8000/admin.html
```
GitHub Pages works too: Settings → Pages → deploy from this branch, folder `/ (root)`.

### Pricing (editable in Admin → Settings)
| | KD |
|---|---|
| Unlock (includes the first 10 min) | 1.000 |
| Every further 10 min | 0.100 |
| Booking a bike that's not next to you (held 15 min) | 0.250 |

### How the photo check works (`js/vision.js`)
The meter stops only when the end-of-ride photo passes:
- **On-device (default, offline):** brightness and sharpness; a bicycle found either as two similar wheels side by side (gradient Hough circle search) or by a pretrained object detector (COCO-SSD, trained on real photos that include bicycles; it also works on angled phone photos where the wheels look like ellipses); the green Gari smart lock found as a colour blob; the lock must sit on a wheel. The detector (TensorFlow.js + model, ~19 MB) lives in `vendor/`, loads when the rider locks the bike, and never sends the photo anywhere. If it can't load, the wheel search alone decides.
- **Claude vision (optional):** add an Anthropic API key in Admin → Settings and the photo is also sent to Claude, which answers in a fixed JSON shape (bicycle? lock visible? lock on wheel? upright? blocking the way?). The key stays in that browser; in production this call belongs on a server.
- Always combined with the lock state reported by the smart lock and whether the GPS position is inside a parking zone (80 m).

### The AI forecast (`js/forecast.js`)
Demand per parking zone = hourly pattern (workdays vs Friday/Saturday, Kuwait time) × zone character (parks in the evening, squares and the waterfront at weekends) × weather × events × a correction learned from the rides seen in the last 3 hours. Street congestion uses a rush-hour profile weighted towards downtown. The admin simulator spawns riders from this same forecast.

### Files
| Path | What |
|---|---|
| `index.html`, `js/app.js`, `js/ui.js`, `css/app.css` | Rider app |
| `admin.html`, `js/admin.js`, `css/admin.css` | Admin dashboard |
| `js/sim.js` | Simulator (riders, photos, payments on a shared clock) |
| `js/core.js` | Settings, pricing, simulation clock, shared store, ride API |
| `js/forecast.js` | AI demand and congestion forecast |
| `js/vision.js` | Photo check |
| `vendor/` | Leaflet 1.9.4 (map), TensorFlow.js 4.22.0 and COCO-SSD 2.2.3 with the `lite_mobilenet_v2` weights (bike detector), Apache 2.0; see `vendor/coco-ssd/README.md` |
| `js/i18n.js` | Arabic / English strings, theme |
| `js/map/` | Capital Governorate streets, routing graph, parking zones (© OpenStreetMap contributors, ODbL), taken from the `gari` branch of Iron-Reins |
| `css/tokens.css` | Colours (light and dark), shared by both pages |
| `assets/` | Logo (cleaned from the original in `tools/logo-original.png`) and icons |
| `test-photos/` | Sample photos to upload; regenerate with `node tools/make_test_photos.js` |
| `tools/` | Map data builders and the photo generator |
| `docs/ARCHITECTURE.md` | Prototype vs production architecture |
| `docs/SECURE_API.md` | How to run Claude photo checks without exposing the API key |
| `docs/ROADMAP.md` | Next steps (e.g. separating admin from rider) |
| `server/` | Cloudflare Worker that keeps the API key secret |

### Prototype limits
- Sign-in with Apple/Google, the Bluetooth lock and the payments (KNET, Visa, Apple Pay) are simulated. Nothing is charged.
- Data lives in the browser's localStorage, so the admin page sees rides from the same browser only.
- Inside the app, GPS movement is simulated along real streets. Long-press the map to move "you".

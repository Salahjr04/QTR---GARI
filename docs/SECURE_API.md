# تشغيل تحليل الصور بـ Claude بشكل آمن · Running Claude photo checks securely

## القاعدة الذهبية
**مفتاح الـ API ما ينحط أبداً في الموقع ولا في GitHub ولا ينرسل بالواتساب.** أي شي بالموقع (HTML/JS) يقدر أي زائر يشوفه، وأي مفتاح ينكشف ممكن أحد يصرف عليه.

الحل: سيرفر صغير (Cloudflare Worker، مجاني) يمسك المفتاح كـ «secret». الموقع يرسل له **الصورة بس**، والسيرفر يضيف المفتاح، والطلب (prompt)، والموديل، ويرجع النتيجة.

```
[الموقع العام / جهاز الحكام] --صورة فقط--> [gari-vision-proxy (فيه المفتاح سري)] --> [Claude API]
```

حماية السيرفر (في `server/src/index.js`):
- يقبل بس من المواقع المسموحة (`ALLOWED_ORIGINS`).
- يسوي شي واحد بس: تحليل صورة دراجة بطلب ثابت. ما يقدر أحد يستخدمه كـ «Claude مجاني».
- حد أعلى لحجم الصورة، وحد لعدد الطلبات لكل IP بالساعة (`RATE_PER_HOUR`).
- المفتاح ما يطلع أبداً بالرد.

## الخطوات (صاحب المفتاح يسويها بنفسه، ومحد غيره يشوف المفتاح)
1. **مفتاح خاص للمشروع**: في console.anthropic.com سوِّ Workspace جديد اسمه مثلاً `gari-hackathon`، وحط له **حد صرف شهري** صغير (Spend limit)، وسوِّ مفتاح جديد داخله. لا تستخدم مفتاحك الشخصي الأساسي.
2. حساب Cloudflare مجاني، وبعدين على جهازك:
   ```bash
   cd server
   npm install
   npx wrangler login
   npx wrangler secret put ANTHROPIC_API_KEY   # يطلب منك تلصق المفتاح هني، ما ينحفظ بأي ملف
   npx wrangler deploy                         # يعطيك رابط مثل https://gari-vision-proxy.<name>.workers.dev
   ```
3. عدّل `ALLOWED_ORIGINS` في `server/wrangler.toml` لرابط موقعكم (GitHub Pages) واعمل `deploy` مرة ثانية.
4. في الموقع: لوحة الإدارة ← الإعدادات ← **رابط سيرفر التحليل** ← الصق رابط السيرفر ← حفظ. خانة «مفتاح Anthropic API» تخليها **فاضية**.
5. بعد الهاكاثون: امسح المفتاح من الـ console (Revoke) أو وقف الـ Workspace.

صاحب المفتاح يقدر يسوي الخطوات ١-٣ بروحه ويعطيكم **الرابط بس**. الرابط ما فيه أي سر.

## إذا ما تبون سيرفر
- **بدون مفتاح أبداً:** التحليل على الجهاز شغال (الوضوح، العجلات، القفل الأخضر، القفل على العجلة، منطقة الركن)، ويكفي للعرض والصور التجريبية.
- **للعرض على لابتوب واحد بس:** صاحب المفتاح يلصقه بنفسه في خانة المفتاح بالإعدادات على **لابتوبه هو**. ينحفظ بمتصفح هذا الجهاز بس، ولا ينرفع لـ GitHub. لا تسوونها على موقع عام أو جهاز مشترك.

## English summary
Never put the API key in the website, the repo or chat. Deploy `server/` as a Cloudflare Worker, store the key with `wrangler secret put ANTHROPIC_API_KEY`, restrict `ALLOWED_ORIGINS`, use a dedicated workspace with a spend limit, then paste the worker URL into Admin → Settings → Vision server URL. Revoke the key after the event.

# Sample end-of-ride photos · صور تجريبية

Upload these in the rider app at the last step (**Photograph the bike and lock / صوّر الدراجة مع القفل**).
They are not inside the app on purpose: download them to your phone or computer, then pick one.

نزّل الصور على جهازك، وبآخر خطوة بالرحلة اختار وحدة منها.

The app is **lenient by default**: only a photo with no bicycle is refused. Admin → Settings → Photo check strictness switches to the strict rules.

| File | Lenient (default) · الوضع المرن | Strict · الوضع الصارم |
|---|---|---|
| `01_pass_locked_park.jpg` | ✅ Accepted · مقبولة | ✅ Accepted: bike + green lock on the rear wheel |
| `02_pass_locked_street.jpg` | ✅ Accepted · مقبولة | ✅ Accepted (different place and light) |
| `03_fail_no_lock.jpg` | ⚠️ Accepted, under review · مقبولة مع مراجعة | ❌ Smart lock not visible |
| `04_fail_lock_not_on_wheel.jpg` | ⚠️ Accepted, under review | ❌ Lock is lying on the ground, not on the wheel |
| `05_fail_too_dark.jpg` | ⚠️ Accepted, under review | ❌ Photo too dark |
| `06_fail_blurry.jpg` | ⚠️ Accepted, under review | ❌ Photo blurry |
| `07_fail_no_bike.jpg` | ❌ Refused: no bicycle · مرفوضة: ما في دراجة | ❌ No bike, no lock |

The zone check also needs you to be inside a Gari parking zone (pick a destination in the app and ride there).
A real phone photo of any bicycle works too; on-device analysis looks for the green lock and two wheels, and with a Claude API key set (Admin → Settings) the photo is also checked by Claude.

Regenerate: `node tools/make_test_photos.js` (prints the analyzer's verdict for each photo).

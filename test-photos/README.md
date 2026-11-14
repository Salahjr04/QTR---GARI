# Sample end-of-ride photos · صور تجريبية

Upload these in the rider app at the last step (**Photograph the bike and lock / صوّر الدراجة مع القفل**).
They are not inside the app on purpose: download them to your phone or computer, then pick one.

نزّل الصور على جهازك، وبآخر خطوة بالرحلة اختار وحدة منها.

| File | Expected result | النتيجة المتوقعة |
|---|---|---|
| `01_pass_locked_park.jpg` | ✅ Accepted: bike + green lock on the rear wheel | ✅ مقبولة |
| `02_pass_locked_street.jpg` | ✅ Accepted (different place and light) | ✅ مقبولة |
| `03_fail_no_lock.jpg` | ❌ Smart lock not visible | ❌ القفل مو ظاهر |
| `04_fail_lock_not_on_wheel.jpg` | ❌ Lock is lying on the ground, not on the wheel | ❌ القفل مو على العجلة |
| `05_fail_too_dark.jpg` | ❌ Photo too dark | ❌ الصورة غامقة |
| `06_fail_blurry.jpg` | ❌ Photo blurry | ❌ الصورة مو واضحة |
| `07_fail_no_bike.jpg` | ❌ No bike, no lock | ❌ ما في دراجة ولا قفل |

The zone check also needs you to be inside a Gari parking zone (pick a destination in the app and ride there).
A real phone photo of any bicycle works too; on-device analysis looks for the green lock and two wheels, and with a Claude API key set (Admin → Settings) the photo is also checked by Claude.

Regenerate: `node tools/make_test_photos.js` (prints the analyzer's verdict for each photo).

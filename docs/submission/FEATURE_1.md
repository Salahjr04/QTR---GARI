# Feature 1: Photo-Proof Parking (AI End-of-Ride Check)

## 1. Feature name and purpose

**Photo-Proof Parking.** A ride on Gari doesn't end when you walk away from the bike. It ends when an AI checks your photo and confirms the bike is locked and properly parked, so every bike goes back to the street ready for the next rider.

## 2. Expected behavior

| What the rider does | What they see |
|---|---|
| Presses and holds the lock button | The bike locks through the app. A banner appears: **"The meter keeps running until the photo is verified"**, with a live timer and price. |
| Taps **"Photograph the bike and lock"** and uploads a photo | A scanning animation runs over the photo while the AI analyses it. |
| The photo has a problem (no lock, lock lying on the ground, too dark, blurry, no bike, or the rider is outside a parking zone) | Each check is ticked or crossed in real time. A red banner says **"Please retake the photo"** and says the meter is still running, and the rider is offered **Retake photo**. |
| Uploads a correct photo (bike visible, green smart lock on the wheel) | All checks turn green, a green banner says **"Photo accepted: meter stopped"**, and the final price is shown with a **Pay** button, then the receipt. |

The AI makes six decisions on each photo: is the photo clear and well lit, is there a bicycle, is the green Gari smart lock visible, is the lock on the wheel, is the lock actually closed (reported by the lock itself), and is the bike inside a Gari parking zone (checked by GPS). On the photo, the wheels it found are circled in green and the lock in yellow, so the rider sees what the AI saw.

This is a real action with real consequences: it decides whether the rider's meter stops and whether they are charged. It is not a login, a static page or a copy of another feature.

## 3. Live app and where to find it

- **Live app:** https://claude.ai/artifact/Q15kEb7FQybuG3jKidHNJb
- **Where:** the rider app opens on the map. The feature is the last step of a ride: **press-and-hold lock → "Photograph the bike and lock"**.

## 4. Test instructions (about 1 minute)

Use a phone, or a desktop browser narrowed to phone width. No account is needed.

1. On the first screen, tick the two small boxes (18+ and helmet), then tap the faint **تخطي / Skip** at the bottom.
2. Tap **احجزها / Reserve**, then choose **Apple Pay** (simulated, nothing is charged), then tap **وصلت / I'm here**, then **افتح القفل من التطبيق / Unlock in the app**.
3. **Press and hold** the dark **"Press and hold to lock the bike"** button until the bar fills. The meter is now running and the lock banner appears.
4. Tap **صوّر الدراجة مع القفل / Photograph the bike and lock** and upload the photos below, in this order:
   - `test-photos/03_fail_no_lock.jpg`: **expected: rejected**, the "smart lock visible" check turns red, and the meter keeps running.
   - `test-photos/01_pass_locked_park.jpg`: **expected: accepted**, all checks turn green and the meter stops.
5. Tap **Pay** to see the receipt.

Other photos to try (all in `test-photos/`):

| File | Expected result |
|---|---|
| `04_fail_lock_not_on_wheel.jpg` | Rejected: lock is on the ground, not on the wheel |
| `05_fail_too_dark.jpg` | Rejected: too dark |
| `06_fail_blurry.jpg` | Rejected: blurry |
| `07_fail_no_bike.jpg` | Rejected: no bike in the photo |
| `02_pass_locked_street.jpg` | Accepted |

You can also upload a photo of any real bicycle, or use the phone camera directly. The photo is analysed in the browser; with the optional secure Claude server connected (see `server/README.md`), Claude also checks it and the result panel says "Claude analysis".

## 5. Screenshots

1. `docs/submission/1-locked-meter-running.png`: the bike is locked, and the banner shows the meter still running (1.250 KD) until a photo is verified.
2. `docs/submission/2-ai-rejects-photo.png`: the AI rejects a photo with no smart lock; the failed check is crossed out and the rider is told to retake it.
3. `docs/submission/3-ai-accepts-meter-stops.png`: a correct photo is accepted, with the wheels (green) and the lock (yellow) highlighted; the meter stops and the final price is shown.

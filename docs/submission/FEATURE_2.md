# Feature 2: AI Traffic & Demand Forecast

## 1. Feature name and purpose
**AI Traffic & Demand Forecast.** One tap on the ✦ button turns the map into a forecast: every main street is coloured by how congested the AI expects it to be, and the rider is told when the quietest time to ride is and where bikes may run out.

## 2. Expected behavior
| Rider action | Visible result |
|---|---|
| Taps the ✦ button (top corner of the map) | The streets are coloured green / orange / red for predicted traffic. Parking zones get a soft halo showing expected bike demand. A forecast card opens with: traffic now (Light / Moderate / Heavy), bike demand near you, the best time to ride, and a warning such as "Bikes may run low at Kaifan Park" when a nearby zone is about to run short. |
| Taps **+1h / +2h / +3h** | The whole map recolours for that future hour, the clock on the card changes, and the traffic and demand labels update. |
| Taps ✦ again | The forecast is hidden and the normal map returns. |

The forecast is computed from the hour of the day (workday vs Friday/Saturday, Kuwait time), the character of each zone (parks fill up in the evening, squares and the waterfront at weekends), weather and events, plus a correction learned from the rides actually happening.

## 3. Live app and where to find it
- **Live app:** https://claude.ai/artifact/Q15kEb7FQybuG3jKidHNJb
- **Where:** the ✦ button at the top of the map screen (the first screen after signing in).

## 4. Test instructions (30 seconds)
1. Tick the two small boxes (18+ and helmet), then tap the faint **Skip** (تخطي) at the bottom.
2. On the map, tap the **✦** button at the top.
3. Look at the street colours and the forecast card.
4. Tap **+1h**, **+2h**, **+3h** and watch the streets and the card change.

Colours depend on the real time of day: rush hours (about 7 to 9 am, 1 to 3 pm and 5 to 9 pm) show red and orange; at night most streets are green.
To see rush hour at any time: menu (☰) → **Admin dashboard** → **Simulator** → tap **Evening 7:00** (المسا ٧:٠٠), then go back to the app and tap ✦.

## 5. Screenshots
1. `docs/submission/f2-1-map-before.png`: the normal map.
2. `docs/submission/f2-2-forecast-now-rush-hour.png`: forecast on at 6 pm, with heavy congestion (red) on the main roads and the forecast card.
3. `docs/submission/f2-3-forecast-plus-3h-calm.png`: the same map at +3h (9 pm), with the roads easing to moderate (orange).

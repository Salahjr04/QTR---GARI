"""Build Gari's bike routing graph and real parking spots from the OSM API extract.
Usage: python3 -I build_graph.py <osm_dir> <out_js>"""
import glob, json, math, sys
from collections import defaultdict, Counter
from shapely.geometry import LineString
osm_dir, out_js = sys.argv[1], sys.argv[2]
LAT0 = 29.35; KX = 111320 * math.cos(math.radians(LAT0)); KY = 110574
proj = lambda la, lo: (lo * KX, la * KY)
OK = {"primary": 1.6, "primary_link": 1.6, "secondary": 1.3, "secondary_link": 1.3, "tertiary": 1.1, "tertiary_link": 1.1,
      "residential": 1.0, "unclassified": 1.0, "living_street": 0.9, "pedestrian": 0.9, "cycleway": 0.7}
ways, coord, seen = [], {}, set()
parks = {}
for f in sorted(glob.glob(f"{osm_dir}/t*.json")):
    for e in json.load(open(f))["elements"]:
        if e["id"] in seen: continue
        seen.add(e["id"])
        for nid, p in zip(e["nodes"], e["geometry"]): coord[nid] = (p["lat"], p["lon"])
        t = e["tags"]
        if t.get("highway") in OK and t.get("access") not in ("private", "no") and t.get("bicycle") != "no":
            ways.append(e)
        elif t.get("leisure") in ("park", "garden") and (t.get("name:ar") or t.get("name")):
            parks[e["id"]] = e
use = Counter()
for w in ways:
    for n in w["nodes"]: use[n] += 1
    use[w["nodes"][0]] += 1; use[w["nodes"][-1]] += 1
edges = []  # (a, b, pts, cost_mult, oneway)
for w in ways:
    t = w["tags"]; ns = w["nodes"]
    one = t.get("oneway") == "yes" and t["highway"] not in ("residential", "service", "living_street", "unclassified")
    start = 0
    for i in range(1, len(ns)):
        if use[ns[i]] > 1 or i == len(ns) - 1:
            seg = ns[start:i + 1]
            if len(seg) >= 2 and seg[0] != seg[-1]:
                edges.append((seg[0], seg[-1], [coord[n] for n in seg], OK[t["highway"]], one))
            start = i
# largest connected component (undirected)
adj = defaultdict(list)
for i, (a, b, *_ ) in enumerate(edges): adj[a].append(b); adj[b].append(a)
comp, best = {}, None
for s in adj:
    if s in comp: continue
    stack, members = [s], []
    comp[s] = s
    while stack:
        x = stack.pop(); members.append(x)
        for y in adj[x]:
            if y not in comp: comp[y] = s; stack.append(y)
    if best is None or len(members) > len(best): best = members
keep = set(best)
edges = [e for e in edges if e[0] in keep]
nodes = sorted({e[0] for e in edges} | {e[1] for e in edges})
idx = {n: i for i, n in enumerate(nodes)}
def q(p): return (round(p[0] * 1e5), round(p[1] * 1e5))
N = []; pl = (0, 0)
for n in nodes:
    c = q(coord[n]); N += [c[0] - pl[0], c[1] - pl[1]]; pl = c
E = []
for a, b, pts, mult, one in edges:
    ls = LineString([proj(*p) for p in pts])
    length = ls.length
    simp = ls.simplify(3)
    mids = [(y / KY, x / KX) for x, y in list(simp.coords)[1:-1]]
    E += [idx[a], idx[b], round(length), round(mult * 10) * 2 + (1 if one else 0), len(mids)]
    prev = q(coord[a])
    for m in mids:
        c = q(m); E += [c[0] - prev[0], c[1] - prev[1]]; prev = c

# ---- parking spots: one real OSM bicycle_parking + named parks inside the Capital Governorate ----
CAPITAL = {  # parks whose area belongs to the Capital Governorate (others are Hawalli / Farwaniya)
 "Al Soor Gardens | Al Shaheed park": ("حديقة الشهيد", "park"),
 "Green Island": ("الجزيرة الخضراء", "park"),
 "Sief Square": ("ساحة السيف", "square"),
 "Al Zahameel Square": ("ساحة الزهاميل · شرق", "square"),
 "Mansouriya Block 1 Main Public Park": ("حديقة المنصورية ق١", "park"),
 "Dasma B3 Public Park": ("حديقة الدسمة ق٣", "park"),
 "Dasma Block 6 Park": ("حديقة الدسمة ق٦", "park"),
 "Abdullah Al-Salem Public Park Block 3 Number 1": ("حديقة ضاحية عبدالله السالم ق٣", "park"),
 "Al Dahiya Block 4 Park": ("حديقة الضاحية ق٤", "park"),
 "Faiha B7 Park": ("حديقة الفيحاء ق٧", "park"),
 "Martyr Hussain Al-Zaʿabi Park": ("حديقة الشهيد حسين الزعابي · الفيحاء", "park"),
 "Kaifan Block 2 Park": ("حديقة كيفان ق٢", "park"),
 "Khaled Al Jeran Park": ("حديقة خالد الجيران · كيفان", "park"),
 "Shuwaikh Park B6 No 3": ("حديقة الشويخ ق٦", "park"),
 "Jammal Abdu al-Nasser Park": ("حديقة جمال عبدالناصر · الروضة", "park"),
 "Rawda Block 3 Public Park": ("حديقة الروضة ق٣", "park"),
 "Mansouriya Block 2 Public Park": ("حديقة المنصورية ق٢", "park"),
}
pois = json.load(open(f"{osm_dir}/pois.json"))
targets = []
for k, p in pois.items():
    if p["tags"].get("amenity") == "bicycle_parking":
        targets.append(("موقف دراجات · أبراج الكويت", "bicycle_parking", [(p["lat"], p["lon"])], k))
for wid, e in parks.items():
    en = e["tags"].get("name:en") or e["tags"].get("name")
    if en in CAPITAL:
        nm, kind = CAPITAL[en]
        targets.append((nm, kind, [(g["lat"], g["lon"]) for g in e["geometry"]], f"w{wid}"))
# snap each spot to the nearest point on a calm street next to it (park edge -> street)
calm = [(a, b) for a, b, pts, mult, one in edges if mult <= 1.1]
ncoord = {n: coord[n] for n in nodes}
def d(p, q2): return math.hypot((p[0] - q2[0]) * KY, (p[1] - q2[1]) * KX)
spots = []
for nm, kind, ring, src in targets:
    best = None
    for p in ring:
        for n in nodes:
            dd = d(p, ncoord[n])
            if best is None or dd < best[0]: best = (dd, n, p)
    # spot sits on the park edge point closest to the street, nudged 30% toward the street
    dd, n, p = best
    c = ncoord[n]
    lat, lng = p[0] + (c[0] - p[0]) * 0.3, p[1] + (c[1] - p[1]) * 0.3
    if kind == "bicycle_parking": lat, lng = ring[0]
    spots.append({"name": nm, "kind": kind, "lat": round(lat, 6), "lng": round(lng, 6), "osm": src})
js = ("/* Gari bike routing graph + real parking spots for the Capital Governorate.\n"
      " * Data (c) OpenStreetMap contributors, ODbL 1.0 - https://www.openstreetmap.org/copyright\n"
      " * Built by build_graph.py. nodes: delta-encoded [lat,lng]*1e5. edges: a,b,lengthM,flags,nMid,mid deltas. */\n"
      "window.Gari = window.Gari || {};\nwindow.Gari.GRAPH = " + json.dumps({"nodes": N, "edges": E}, separators=(",", ":")) + ";\n"
      "window.Gari.REAL_SPOTS = " + json.dumps(spots, ensure_ascii=False, separators=(",", ":")) + ";\n")
open(out_js, "w").write(js)
print("nodes", len(nodes), "edges", len(edges), "spots", len(spots), "bytes", len(js.encode()))
for s in spots: print(s)

"""Build Gari's embedded street map (streets.js) from OpenStreetMap Overpass JSON tiles.
Usage: python3 build_streets.py <osm_dir> <out_js>
"""
import glob, json, math, sys
from shapely.geometry import LineString, Polygon, box, Point
from shapely.ops import linemerge, polygonize, unary_union

osm_dir, out_js = sys.argv[1], sys.argv[2]

MAJOR = {"motorway", "trunk", "primary", "motorway_link", "trunk_link", "primary_link"}
MID = {"secondary", "tertiary", "secondary_link", "tertiary_link"}
MINOR = {"residential", "unclassified", "living_street", "pedestrian"}

ways, seen = [], set()
for f in sorted(glob.glob(f"{osm_dir}/t*.json")):
    for el in json.load(open(f))["elements"]:
        if el["type"] != "way" or el["id"] in seen or "geometry" not in el:
            continue
        seen.add(el["id"])
        ways.append(el)

# metres-ish projection around Kuwait City for simplification
LAT0 = 29.35
KX = 111320 * math.cos(math.radians(LAT0)); KY = 110574
proj = lambda lat, lng: (lng * KX, lat * KY)
unproj = lambda x, y: (y / KY, x / KX)

def simplify(coords, tol):
    ls = LineString([proj(p["lat"], p["lon"]) for p in coords])
    s = ls.simplify(tol, preserve_topology=False)
    return [unproj(x, y) for x, y in s.coords]

def enc(pts):
    out, plat, plng = [], 0, 0
    for lat, lng in pts:
        a, b = round(lat * 1e5), round(lng * 1e5)
        out += [a - plat, b - plng]; plat, plng = a, b
    return out

roads = {"major": [], "mid": [], "minor": []}
parks = []
for w in ways:
    t = w.get("tags", {})
    if t.get("highway") in MAJOR | MID | MINOR:
        cls = "major" if t["highway"] in MAJOR else "mid" if t["highway"] in MID else "minor"
        pts = simplify(w["geometry"], 2.5 if cls != "minor" else 3.5)
        if len(pts) >= 2:
            roads[cls].append(enc(pts))
    elif "highway" in t:
        continue
    elif t.get("leisure") in ("park", "garden"):
        g = w["geometry"]
        if len(g) >= 4 and g[0] == g[-1]:
            pts = simplify(g, 3)
            if len(pts) >= 4:
                poly = Polygon([proj(a, b) for a, b in pts])
                if poly.area > 2500:  # skip tiny gardens (< 50x50 m)
                    parks.append(enc(pts))

# coastline -> land and sea polygons inside the coastline box
CB = (29.30, 47.88, 29.42, 48.06)  # s, w, n, e
coast = json.load(open(f"{osm_dir}/coast.json"))["elements"]
lines = [LineString([proj(p["lat"], p["lon"]) for p in w["geometry"]]) for w in coast if w["type"] == "way"]
bx = box(*proj(CB[0], CB[1]), *proj(CB[2], CB[3]))
merged = linemerge(unary_union(lines))
pieces = list(polygonize(unary_union([bx.exterior, merged.intersection(bx)])))
city = Point(*proj(29.36, 47.98))  # Kuwait City, on land
land_pieces = []
for pc in pieces:
    # a piece is land if it contains a known land point or most of its area is south of the bay
    rp = pc.representative_point()
    if pc.contains(city):
        land_pieces.append(pc); continue
lat_c = lambda pc: unproj(*pc.representative_point().coords[0])[0]
land = unary_union(land_pieces) if land_pieces else None
# any piece touching the box's south edge that isn't the Gulf is also land; decide via the coast direction:
# OSM coastlines keep land on the LEFT. Classify each piece by testing a point just left of a coast segment.
land_pieces = []
for pc in pieces:
    rp = pc.representative_point()
    best = None
    for ln in lines:
        d = ln.distance(rp)
        if best is None or d < best[0]:
            best = (d, ln)
    ln = best[1]
    proj_d = ln.project(rp)
    a = ln.interpolate(max(0, proj_d - 1)); b = ln.interpolate(min(ln.length, proj_d + 1))
    dx, dy = b.x - a.x, b.y - a.y
    cross = dx * (rp.y - a.y) - dy * (rp.x - a.x)
    if cross > 0:  # left side
        land_pieces.append(pc)
land = unary_union(land_pieces)
sea = bx.difference(land)

def poly_rings(g, tol=4):
    g = g.simplify(tol)
    polys = [g] if g.geom_type == "Polygon" else list(getattr(g, "geoms", []))
    out = []
    for p in polys:
        if p.area < 4000:
            continue
        out.append([enc([unproj(x, y) for x, y in p.exterior.coords])] + [enc([unproj(x, y) for x, y in r.coords]) for r in p.interiors])
    return out

data = {
    "roads": roads,
    "parks": parks,
    "land": poly_rings(land),
    "sea": poly_rings(sea),
    "box": [CB[0], CB[1], CB[2], CB[3]],
}
js = ("/* Capital Governorate streets, parks and coastline.\n"
      " * Data (c) OpenStreetMap contributors, ODbL 1.0 - https://www.openstreetmap.org/copyright\n"
      " * Built by build_streets.py: simplified to ~3 m and delta-encoded (1e-5 degrees). */\n"
      "window.Gari = window.Gari || {};\nwindow.Gari.STREETS = " + json.dumps(data, separators=(",", ":")) + ";\n")
open(out_js, "w").write(js)
print("ways", len(ways), {k: len(v) for k, v in roads.items()}, "parks", len(parks),
      "land polys", len(data["land"]), "sea polys", len(data["sea"]), "bytes", len(js))

"""Fetch the Capital area from the official OSM API in small tiles and keep only what Gari needs.
Writes osm2/tNN.json in the Overpass-like format build_streets.py reads, plus osm2/pois.json."""
import json, os, subprocess, sys, time, xml.etree.ElementTree as ET
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
S, N, W, E = 29.285, 29.400, 47.880, 48.035
ny, nx = 8, 10
HW = {"motorway","trunk","primary","secondary","tertiary","residential","unclassified","living_street","pedestrian",
      "motorway_link","trunk_link","primary_link","secondary_link","tertiary_link","cycleway","footway","path","service"}
pois = {}
for iy in range(ny):
    for ix in range(nx):
        name = f"{out}/t{iy}{ix}.json"
        if os.path.exists(name): continue
        s = S + (N - S) * iy / ny; n = S + (N - S) * (iy + 1) / ny
        w = W + (E - W) * ix / nx; e = W + (E - W) * (ix + 1) / nx
        url = f"https://api.openstreetmap.org/api/0.6/map?bbox={w:.5f},{s:.5f},{e:.5f},{n:.5f}"
        for tryn in range(4):
            r = subprocess.run(["curl", "-sS", "-m", "120", "-A", "gari-prototype-map-build", "-o", f"{out}/tmp.xml", "-w", "%{http_code}", url], capture_output=True, text=True)
            if r.stdout == "200": break
            print("retry", iy, ix, r.stdout, r.stderr.strip()[:80], flush=True); time.sleep(5 * (tryn + 1))
        else:
            print("FAIL", iy, ix, flush=True); continue
        root = ET.parse(f"{out}/tmp.xml").getroot()
        nodes = {}
        for nd in root.iter("node"):
            nodes[nd.get("id")] = (float(nd.get("lat")), float(nd.get("lon")))
            tags = {t.get("k"): t.get("v") for t in nd.findall("tag")}
            if tags.get("amenity") in ("bicycle_parking", "bicycle_rental"):
                pois["n" + nd.get("id")] = {"lat": nodes[nd.get("id")][0], "lon": nodes[nd.get("id")][1], "tags": tags}
        els = []
        for wy in root.iter("way"):
            tags = {t.get("k"): t.get("v") for t in wy.findall("tag")}
            refs = [x.get("ref") for x in wy.findall("nd")]
            if not refs or any(r not in nodes for r in refs): continue
            keep = tags.get("highway") in HW or tags.get("leisure") in ("park", "garden")
            if tags.get("amenity") in ("bicycle_parking", "bicycle_rental"):
                la = sum(nodes[r][0] for r in refs) / len(refs); lo = sum(nodes[r][1] for r in refs) / len(refs)
                pois["w" + wy.get("id")] = {"lat": la, "lon": lo, "tags": tags}
            if keep:
                els.append({"type": "way", "id": int(wy.get("id")), "nodes": [int(r) for r in refs], "tags": tags,
                            "geometry": [{"lat": nodes[r][0], "lon": nodes[r][1]} for r in refs]})
        json.dump({"elements": els}, open(name, "w"))
        print("ok", iy, ix, len(els), flush=True)
        time.sleep(1)
os.remove(f"{out}/tmp.xml") if os.path.exists(f"{out}/tmp.xml") else None
old = json.load(open(f"{out}/pois.json")) if os.path.exists(f"{out}/pois.json") else {}
old.update(pois); json.dump(old, open(f"{out}/pois.json", "w"), ensure_ascii=False, indent=0)
print("pois", len(old))

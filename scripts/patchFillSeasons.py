"""
Fill empty seasons from Transfermarkt performanceperclub (real career totals per club).
Also rebuild clubs path from that data + transfers.
"""
from __future__ import annotations

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "realPlayerCareers.json"
CACHE = ROOT / "scripts" / "_tm_data" / "perf_club_cache.json"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
HEADERS = {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "https://www.transfermarkt.co.uk/",
}


def http_json(url: str, retries: int = 4):
    last = None
    for i in range(retries):
        try:
            req = Request(url, headers=HEADERS)
            with urlopen(req, timeout=40) as r:
                return json.loads(r.read().decode("utf-8", errors="replace"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as e:
            last = e
            time.sleep(0.3 * (i + 1))
    raise last  # type: ignore


def normalize(name: str) -> str:
    import unicodedata

    s = unicodedata.normalize("NFD", str(name or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


def fetch_perf_clubs(pid: int):
    data = http_json(f"https://www.transfermarkt.co.uk/ceapi/player/{pid}/performanceperclub")
    out = []
    for p in data.get("performances") or []:
        ent = p.get("entity") or {}
        name = ent.get("name") or "—"
        out.append(
            {
                "clubName": name,
                "clubId": ent.get("id"),
                "apps": int(p.get("gamesPlayed") or 0),
                "goals": int(p.get("goalsScored") or 0),
                "assists": int(p.get("assists") or 0),
                "cleanSheets": int(p.get("cleanSheets") or 0),
            }
        )
    return out


def years_for_club(club_name: str, transfers: list, debut: int | None):
    """Infer from/to years from transfer list (real dates)."""
    n = normalize(club_name)
    years = []
    for t in transfers or []:
        for side in (t.get("toClub"), t.get("fromClub")):
            sn = normalize(side or "")
            if not sn:
                continue
            if n == sn or n in sn or sn in n:
                if t.get("year"):
                    years.append(int(t["year"]))
    if years:
        return min(years), max(years)
    if debut:
        return debut, debut + 1
    return None, None


def build_seasons_from_clubs(perf_clubs, transfers, debut):
    seasons = []
    clubs_path = []
    for c in perf_clubs:
        if c["apps"] <= 0:
            continue
        y0, y1 = years_for_club(c["clubName"], transfers, debut)
        if y0 is None:
            y0, y1 = 2020, 2026
        # one row = career total at club (real TM aggregate, not invented per-season split)
        seasons.append(
            {
                "season": y1,
                "label": f"{y0}/{str(y1)[2:]}" if y1 >= 1000 else "career",
                "clubName": c["clubName"],
                "apps": c["apps"],
                "goals": c["goals"],
                "assists": c["assists"],
                "minutes": None,
                "yellows": None,
                "reds": None,
                "aggregate": True,
            }
        )
        clubs_path.append({"clubName": c["clubName"], "fromYear": y0, "toYear": y1})
    # order by fromYear
    clubs_path.sort(key=lambda x: x["fromYear"])
    seasons.sort(key=lambda x: (x["season"], x["clubName"]))
    return seasons, clubs_path


def main():
    db = json.loads(OUT.read_text(encoding="utf-8"))
    by_name = db["byName"]
    need = []
    for name, row in by_name.items():
        if row.get("seasons"):
            continue
        pid = row.get("tmPlayerId")
        if pid:
            need.append((name, int(pid)))

    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    todo = [(n, pid) for n, pid in need if str(pid) not in cache]
    print(f"Need seasons: {len(need)} · cached {len(cache)} · todo {len(todo)}", flush=True)

    def job(item):
        name, pid = item
        try:
            return str(pid), fetch_perf_clubs(pid), None
        except Exception as e:
            return str(pid), [], str(e)

    done = 0
    with ThreadPoolExecutor(max_workers=14) as ex:
        futs = [ex.submit(job, it) for it in todo]
        for fut in as_completed(futs):
            pid, clubs, err = fut.result()
            cache[pid] = clubs
            done += 1
            if done % 100 == 0:
                CACHE.write_text(json.dumps(cache), encoding="utf-8")
                print(f"  perf {done}/{len(todo)} n={len(clubs)} err={err}", flush=True)

    CACHE.write_text(json.dumps(cache), encoding="utf-8")

    filled = 0
    for name, pid in need:
        clubs = cache.get(str(pid)) or []
        if not clubs:
            continue
        row = by_name[name]
        seasons, clubs_path = build_seasons_from_clubs(
            clubs, row.get("transfers") or [], row.get("debutYear")
        )
        if not seasons:
            continue
        row["seasons"] = seasons
        if not row.get("clubs"):
            row["clubs"] = clubs_path
        row["debutYear"] = clubs_path[0]["fromYear"] if clubs_path else row.get("debutYear")
        apps = sum(s["apps"] for s in seasons)
        goals = sum(s["goals"] for s in seasons)
        caps = (row.get("intl") or {}).get("caps") or 0
        row["summaryTh"] = (
            f"{name} · Transfermarkt จริง · {apps} นัด {goals} ประตู · "
            f"แคป {caps} · ย้าย {len(row.get('transfers') or [])} · "
            f"เจ็บ {len(row.get('injuries') or [])} · แชมป์ {len(row.get('titles') or [])}"
        )
        filled += 1

    with_apps = sum(1 for v in by_name.values() if v.get("seasons"))
    db["stats"]["withAppearances"] = with_apps
    db["stats"]["filledFromPerfClub"] = filled
    db["generatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    OUT.write_text(json.dumps(db, ensure_ascii=False), encoding="utf-8")
    print(f"Filled {filled} · withAppearances now {with_apps}", flush=True)

    for n in ["Chanathip Songkrasin", "Amad", "Vinícius Júnior"]:
        s = by_name.get(n) or {}
        print(n, len(s.get("seasons") or []), (s.get("seasons") or [])[:2], flush=True)


if __name__ == "__main__":
    main()

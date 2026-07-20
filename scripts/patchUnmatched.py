"""Retry unmatched roster names with cleaned HTML entities / aliases."""
from __future__ import annotations

import html
import json
import re
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "realPlayerCareers.json"
ROSTER_FILES = [
    "playersEng.json",
    "playersEsp.json",
    "playersGer.json",
    "playersIta.json",
    "playersFra.json",
    "playersTha.json",
    "playersEng2.json",
    "playersEsp2.json",
    "playersGer2.json",
    "playersIta2.json",
    "playersFra2.json",
    "playersTha2.json",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "https://www.transfermarkt.co.uk/",
}


def normalize(name: str) -> str:
    s = html.unescape(str(name or ""))
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


def http_json(url: str):
    req = Request(url, headers=HEADERS)
    with urlopen(req, timeout=35) as r:
        return json.loads(r.read().decode("utf-8", errors="replace"))


def search(query: str):
    try:
        data = http_json(
            f"https://www.transfermarkt.co.uk/spieler/searchSpielerDaten?q={quote(query)}"
        )
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return None
    rows = data if isinstance(data, list) else []
    qn = normalize(query)
    best = None
    best_score = -1
    for row in rows[:20]:
        name = re.sub(r"<[^>]+>", "", str(row.get("name") or row.get("playerName") or ""))
        pid = row.get("id") or row.get("playerId")
        href = str(row.get("link") or row.get("url") or "")
        if not pid:
            m = re.search(r"/spieler/(\d+)", href)
            pid = m.group(1) if m else None
        if not pid:
            continue
        nn = normalize(name)
        score = 100 if nn == qn else (60 if qn in nn or nn in qn else 5)
        if score > best_score:
            best_score = score
            best = {"player_id": int(pid), "name": name}
    return best if best_score >= 60 else None


def fetch_bundle(pid: int):
    transfers = []
    injuries = []
    national = {"caps": 0, "goals": 0}
    try:
        t = http_json(f"https://www.transfermarkt.co.uk/ceapi/transferHistory/list/{pid}")
        for tr in t.get("transfers") or []:
            if tr.get("upcoming"):
                continue
            du = tr.get("dateUnformatted") or ""
            year = int(du[:4]) if len(du) >= 4 and du[:4].isdigit() else 0
            fee_s = str(tr.get("fee") or "")
            fee = None
            kind = "transfer"
            sl = fee_s.lower()
            if "loan" in sl:
                kind = "loan"
            elif "free" in sl:
                fee, kind = 0, "free"
            else:
                m = re.search(r"([\d.]+)\s*(m|k)?", fee_s.replace(",", ""), re.I)
                if m:
                    num = float(m.group(1))
                    if (m.group(2) or "").lower() == "m":
                        num *= 1_000_000
                    elif (m.group(2) or "").lower() == "k":
                        num *= 1_000
                    fee = int(num)
            transfers.append(
                {
                    "year": year,
                    "fromClub": (tr.get("from") or {}).get("clubName") or "—",
                    "toClub": (tr.get("to") or {}).get("clubName") or "—",
                    "feeEur": fee,
                    "kind": kind,
                    "noteTh": f"season {tr.get('season')}" if tr.get("season") else None,
                }
            )
    except Exception:
        pass
    try:
        inj = http_json(f"https://tmapi-alpha.transfermarkt.technology/player/{pid}/injury")
        for i in (inj.get("data") or {}).get("injuries") or []:
            injuries.append(
                {
                    "date": (i.get("start") or "")[:10] or None,
                    "season": (i.get("seasonId") or 0) + 1 if i.get("seasonId") else None,
                    "type": "other",
                    "typeTh": i.get("name") or "injury",
                    "daysOut": (i.get("durationDetails") or {}).get("days") or 7,
                    "gamesMissed": i.get("missedGamesCount"),
                    "source": "transfermarkt",
                    "noteTh": i.get("name"),
                    "chronic": False,
                }
            )
    except Exception:
        pass
    try:
        nat = http_json(
            f"https://tmapi-alpha.transfermarkt.technology/player/{pid}/national-career-history"
        )
        hist = (nat.get("data") or {}).get("history") or []
        national = {
            "caps": sum(int(h.get("gamesPlayed") or 0) for h in hist),
            "goals": sum(int(h.get("goalsScored") or 0) for h in hist),
        }
    except Exception:
        pass
    perf = []
    try:
        p = http_json(f"https://www.transfermarkt.co.uk/ceapi/player/{pid}/performanceperclub")
        for row in p.get("performances") or []:
            ent = row.get("entity") or {}
            perf.append(
                {
                    "clubName": ent.get("name") or "—",
                    "apps": int(row.get("gamesPlayed") or 0),
                    "goals": int(row.get("goalsScored") or 0),
                    "assists": int(row.get("assists") or 0),
                }
            )
    except Exception:
        pass
    return transfers, injuries, national, perf


def main():
    db = json.loads(OUT.read_text(encoding="utf-8"))
    have = set(db["byName"])
    roster = []
    for f in ROSTER_FILES:
        p = ROOT / "src" / "data" / "world" / f
        if not p.exists():
            continue
        data = json.loads(p.read_text(encoding="utf-8"))
        clubs = data.get("clubs") or data
        for arr in clubs.values():
            if not isinstance(arr, list):
                continue
            for pl in arr:
                n = pl.get("name")
                if n and n not in have:
                    roster.append(html.unescape(n))
    roster = sorted(set(roster))
    print(f"Still missing from roster: {len(roster)}", flush=True)

    added = 0

    def job(name: str):
        hit = search(name)
        if not hit:
            # try last token for Korean/compound
            parts = name.replace("-", " ").split()
            if len(parts) >= 2:
                hit = search(" ".join(parts[-2:])) or search(parts[-1])
        return name, hit

    hits = {}
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = [ex.submit(job, n) for n in roster]
        for i, fut in enumerate(as_completed(futs), 1):
            name, hit = fut.result()
            if hit:
                hits[name] = hit
            if i % 50 == 0:
                print(f"  search {i}/{len(roster)} hits {len(hits)}", flush=True)

    print(f"New hits: {len(hits)}", flush=True)
    for name, hit in hits.items():
        pid = hit["player_id"]
        transfers, injuries, national, perf = fetch_bundle(pid)
        seasons = []
        clubs = []
        for c in perf:
            if c["apps"] <= 0:
                continue
            seasons.append(
                {
                    "season": 2026,
                    "label": "career",
                    "clubName": c["clubName"],
                    "apps": c["apps"],
                    "goals": c["goals"],
                    "assists": c["assists"],
                    "aggregate": True,
                }
            )
            clubs.append({"clubName": c["clubName"], "fromYear": 2018, "toYear": 2026})
        db["byName"][name] = {
            "source": "transfermarkt",
            "tmPlayerId": pid,
            "tmUrl": None,
            "nation": "—",
            "seasons": seasons,
            "clubs": clubs,
            "transfers": [t for t in transfers if t["year"] >= 2000],
            "titles": [],
            "intl": {
                "nation": "—",
                "nationTh": "—",
                "caps": national["caps"],
                "goals": national["goals"],
                "worldCups": [],
                "majorTournaments": [],
            },
            "injuries": injuries[:16],
            "debutYear": clubs[0]["fromYear"] if clubs else None,
            "summaryTh": f"{name} · Transfermarkt จริง · แคป {national['caps']} · ย้าย {len(transfers)} · เจ็บ {len(injuries)}",
        }
        added += 1

    still = [n for n in roster if n not in db["byName"]]
    db["stats"]["matched"] = len(db["byName"])
    db["stats"]["unmatched"] = len(still)
    db["stats"]["withAppearances"] = sum(1 for v in db["byName"].values() if v.get("seasons"))
    db["stats"]["withTransfers"] = sum(1 for v in db["byName"].values() if v.get("transfers"))
    db["stats"]["withInjuries"] = sum(1 for v in db["byName"].values() if v.get("injuries"))
    db["unmatchedSample"] = still[:60]
    db["generatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    OUT.write_text(json.dumps(db, ensure_ascii=False), encoding="utf-8")
    print(f"Added {added} · unmatched left {len(still)}", flush=True)
    print("still sample", still[:20], flush=True)


if __name__ == "__main__":
    main()

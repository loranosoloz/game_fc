"""
Build COMPLETE real player careers — Transfermarkt only, no simulation.

Sources:
- Local DuckDB/CSV: players, appearances, games, clubs, worldHistory
- Live TM API: transfers (ceapi), injuries + national career (tmapi-alpha)

Usage: python scripts/buildCompleteRealCareers.py
"""
from __future__ import annotations

import gzip
import io
import json
import re
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

import duckdb

ROOT = Path(__file__).resolve().parents[1]
TM_DIR = ROOT / "scripts" / "_tm_data"
OUT = ROOT / "public" / "data" / "realPlayerCareers.json"
HISTORY = ROOT / "src" / "data" / "world" / "worldHistory.json"
DUCK = TM_DIR / "transfermarkt-datasets.duckdb"

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

INTL_COMP = {"FIWC", "EURO", "COPA", "AFAC", "AFCN"}
MAJOR_INTL = {
    "EURO": ("UEFA Euro", "ยูโร"),
    "COPA": ("Copa América", "โกปา อเมริกา"),
    "AFAC": ("AFC Asian Cup", "เอเชียนคัพ"),
    "AFCN": ("AFCON", "แอฟริกา คัพ ออฟ เนชันส์"),
}

# Known short / alternate roster names → TM search / exact names
NAME_ALIASES = {
    "amad": "amad diallo",
    "ebere eze": "eberechi eze",
    "benjamin white": "ben white",
    "jose gimenez": "jose maria gimenez",
    "josé giménez": "jose maria gimenez",
    "fermin": "fermin lopez",
    "fermín": "fermin lopez",
    "ez abde": "abde ezzalzouli",
    "vinicius junior": "vinicius junior",
    "vinícius júnior": "vinicius junior",
    "heung-min son": "heung-min son",
    "son heung-min": "heung-min son",
    "gabriel": "gabriel magalhaes",  # careful — only if club ars
    "alisson": "alisson",
    "rodri": "rodri",
    "pedri": "pedri",
    "gavi": "gavi",
    "lamine yamal": "lamine yamal",
    "mbappe": "kylian mbappe",
    "kylian mbappé": "kylian mbappe",
}

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
HEADERS_JSON = {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "https://www.transfermarkt.co.uk/",
}


def normalize(name: str) -> str:
    s = unicodedata.normalize("NFD", str(name or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("'", "").replace("`", "").replace("'", "")
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


def http_json(url: str, retries: int = 3):
    last = None
    for i in range(retries):
        try:
            req = Request(url, headers=HEADERS_JSON)
            with urlopen(req, timeout=40) as r:
                return json.loads(r.read().decode("utf-8", errors="replace"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as e:
            last = e
            time.sleep(0.4 * (i + 1))
    raise last  # type: ignore


def collect_roster():
    """Return list of {name, clubKey, leagueFile}"""
    rows = []
    seen = set()
    for f in ROSTER_FILES:
        p = ROOT / "src" / "data" / "world" / f
        if not p.exists():
            continue
        data = json.loads(p.read_text(encoding="utf-8"))
        clubs = data.get("clubs") or data
        for club_key, arr in clubs.items():
            if not isinstance(arr, list):
                continue
            for pl in arr:
                name = pl.get("name")
                if not name or name in seen:
                    continue
                seen.add(name)
                rows.append({"name": name, "clubKey": club_key, "pack": f})
    return rows


def load_tm_players(con):
    df = con.execute(
        """
        select player_id, name, first_name, last_name, player_code,
               current_club_id, current_club_name, market_value_in_eur,
               highest_market_value_in_eur, last_season,
               country_of_citizenship, international_caps, international_goals, url
        from players
        """
    ).fetchdf()
    return df


def pick_best(cands):
    return sorted(
        cands,
        key=lambda r: (
            int(r.get("last_season") or 0) if str(r.get("last_season") or "").isdigit() else 0,
            int(r.get("market_value_in_eur") or 0),
            int(r.get("highest_market_value_in_eur") or 0),
        ),
        reverse=True,
    )[0]


def match_players(roster, tm_df):
    by_norm = {}
    by_first = {}
    by_last = {}
    by_code = {}
    for _, row in tm_df.iterrows():
        rec = row.to_dict()
        n = normalize(rec.get("name"))
        by_norm.setdefault(n, []).append(rec)
        fn = normalize(rec.get("first_name") or "")
        ln = normalize(rec.get("last_name") or "")
        if fn:
            by_first.setdefault(fn, []).append(rec)
        if ln:
            by_last.setdefault(ln, []).append(rec)
        code = normalize(str(rec.get("player_code") or "").replace("-", " "))
        if code:
            by_code.setdefault(code, []).append(rec)

    matched = {}
    unmatched = []

    for r in roster:
        name = r["name"]
        n = normalize(name)
        alias = NAME_ALIASES.get(n)
        keys = [n]
        if alias:
            keys.append(normalize(alias))

        # Benjamin → Ben + last
        parts = n.split()
        if len(parts) >= 2 and parts[0] in {"benjamin", "alexander", "nicholas", "christopher", "william", "thomas", "joseph", "michael", "joshua", "matthew"}:
            short = {"benjamin": "ben", "alexander": "alex", "nicholas": "nick", "christopher": "chris", "william": "will", "thomas": "tom", "joseph": "joe", "michael": "mike", "joshua": "josh", "matthew": "matt"}[parts[0]]
            keys.append(normalize(f"{short} {' '.join(parts[1:])}"))

        found = None
        for k in keys:
            if k in by_norm:
                found = pick_best(by_norm[k])
                break
            if k in by_code:
                found = pick_best(by_code[k])
                break

        # single-token / short name: first_name unique high value
        if not found and len(parts) == 1:
            cands = by_first.get(n) or by_last.get(n) or []
            if cands:
                # prefer high MV + recent
                top = pick_best(cands)
                if int(top.get("market_value_in_eur") or 0) >= 1_000_000 or int(top.get("highest_market_value_in_eur") or 0) >= 5_000_000:
                    found = top

        # two-token: try last name unique among valuable
        if not found and len(parts) >= 2:
            ln = parts[-1]
            cands = [c for c in by_last.get(ln, []) if normalize(c.get("first_name") or "") == parts[0] or normalize(c.get("name") or "").startswith(parts[0])]
            if not cands:
                # first name match last
                cands = [c for c in by_first.get(parts[0], []) if ln in normalize(c.get("name") or "")]
            if cands:
                found = pick_best(cands)

        if found:
            matched[name] = found
        else:
            unmatched.append(r)

    return matched, unmatched


def search_player(query: str):
    """TM search — returns best player_id or None."""
    url = f"https://www.transfermarkt.co.uk/spieler/searchSpielerDaten?q={quote(query)}"
    try:
        data = http_json(url)
    except Exception:
        return None
    # shape varies
    rows = data if isinstance(data, list) else data.get("player") or data.get("results") or data.get("data") or []
    if not isinstance(rows, list) or not rows:
        return None
    best = None
    best_score = -1
    qn = normalize(query)
    for row in rows[:15]:
        name = row.get("name") or row.get("playerName") or row.get("title") or ""
        # strip html
        name = re.sub(r"<[^>]+>", "", str(name))
        pid = row.get("id") or row.get("playerId") or row.get("spieler_id")
        if not pid:
            href = row.get("link") or row.get("url") or ""
            m = re.search(r"/spieler/(\d+)", str(href))
            if m:
                pid = m.group(1)
        if not pid:
            continue
        nn = normalize(name)
        score = 100 if nn == qn else (50 if qn in nn or nn in qn else 10)
        mv = int(row.get("marketValue") or row.get("mw") or 0) if str(row.get("marketValue") or "").isdigit() else 0
        score += min(mv // 1_000_000, 50)
        if score > best_score:
            best_score = score
            best = {"player_id": int(pid), "name": name, "raw": row}
    return best


def fetch_transfers(pid: int):
    data = http_json(f"https://www.transfermarkt.co.uk/ceapi/transferHistory/list/{pid}")
    out = []
    for t in data.get("transfers") or []:
        if t.get("upcoming") or t.get("futureTransfer"):
            continue
        du = t.get("dateUnformatted") or ""
        if isinstance(du, str) and len(du) >= 4 and du[:4].isdigit():
            year = int(du[:4])
        else:
            season = str(t.get("season") or "")
            m = re.match(r"(\d{2})/(\d{2})", season)
            year = 2000 + int(m.group(2)) if m else 0
        fee_str = t.get("fee")
        fee = None
        kind = "transfer"
        s = str(fee_str or "").lower()
        if "loan" in s:
            kind = "loan_end" if "end of loan" in s or "loan end" in s else "loan"
        elif "free" in s or "ablösefrei" in s:
            fee = 0
            kind = "free"
        else:
            m = re.search(r"([\d.]+)\s*(bn|b|m|k)?", str(fee_str or "").replace(",", ""), re.I)
            if m:
                num = float(m.group(1))
                suf = (m.group(2) or "").lower()
                if suf in {"bn", "b"}:
                    num *= 1_000_000_000
                elif suf == "m":
                    num *= 1_000_000
                elif suf == "k":
                    num *= 1_000
                fee = int(num)
        from_club = (t.get("from") or {}).get("clubName") or "—"
        to_club = (t.get("to") or {}).get("clubName") or "—"
        if from_club == to_club:
            continue
        out.append(
            {
                "year": year,
                "fromClub": from_club,
                "toClub": to_club,
                "feeEur": fee,
                "kind": kind,
                "noteTh": f"ฤดูกาล {t['season']}" if t.get("season") else None,
            }
        )
    out.sort(key=lambda x: (x["year"], x["fromClub"]))
    return [x for x in out if x["year"] >= 2000][-30:]


def fetch_injuries(pid: int):
    data = http_json(f"https://tmapi-alpha.transfermarkt.technology/player/{pid}/injury")
    injuries = (data.get("data") or {}).get("injuries") or []
    out = []
    for inj in injuries:
        start = (inj.get("start") or "")[:10]
        end = (inj.get("end") or "")[:10]
        days = (inj.get("durationDetails") or {}).get("days")
        if days is None and start and end:
            try:
                from datetime import date

                d0 = date.fromisoformat(start)
                d1 = date.fromisoformat(end)
                days = max(1, (d1 - d0).days)
            except ValueError:
                days = 7
        season_id = inj.get("seasonId")
        out.append(
            {
                "date": start or None,
                "season": int(season_id) + 1 if isinstance(season_id, int) else None,
                "type": "other",
                "typeTh": inj.get("name") or "เจ็บ",
                "bodyPart": None,
                "daysOut": int(days or 7),
                "gamesMissed": inj.get("missedGamesCount"),
                "source": "transfermarkt",
                "noteTh": inj.get("name") or None,
                "chronic": False,
            }
        )
    out.sort(key=lambda x: x.get("date") or "", reverse=True)
    return out[:20]


def fetch_national(pid: int):
    data = http_json(
        f"https://tmapi-alpha.transfermarkt.technology/player/{pid}/national-career-history"
    )
    hist = (data.get("data") or {}).get("history") or []
    caps = sum(int(h.get("gamesPlayed") or 0) for h in hist)
    goals = sum(int(h.get("goalsScored") or 0) for h in hist)
    nation = None
    for h in hist:
        # clubId for nations — we may not have name; leave from player row
        if h.get("gamesPlayed"):
            nation = h.get("clubName") or nation
    return {"caps": caps, "goals": goals, "teams": hist}


def main():
    print("Loading roster…")
    roster = collect_roster()
    print(f"Roster unique names: {len(roster)}")

    print("Connecting DuckDB…")
    con = duckdb.connect(str(DUCK), read_only=True)
    tm_df = load_tm_players(con)
    print(f"TM players: {len(tm_df)}")

    print("Matching names…")
    matched, unmatched = match_players(roster, tm_df)
    print(f"Matched local: {len(matched)} / {len(roster)} · unmatched {len(unmatched)}")

    # Search API for unmatched (limit concurrency)
    print("Searching Transfermarkt for unmatched…")
    still = []
    search_hits = 0

    def do_search(row):
        name = row["name"]
        n = normalize(name)
        q = NAME_ALIASES.get(n, name)
        hit = search_player(q)
        return name, hit

    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = [ex.submit(do_search, r) for r in unmatched]
        for i, fut in enumerate(as_completed(futs), 1):
            name, hit = fut.result()
            if hit:
                matched[name] = {
                    "player_id": hit["player_id"],
                    "name": hit["name"],
                    "country_of_citizenship": None,
                    "international_caps": 0,
                    "international_goals": 0,
                    "url": None,
                    "market_value_in_eur": 0,
                    "current_club_name": None,
                    "last_season": None,
                    "_from_search": True,
                }
                search_hits += 1
            else:
                still.append(name)
            if i % 100 == 0:
                print(f"  search {i}/{len(unmatched)} · hits {search_hits}")

    print(f"After search: matched {len(matched)} · still unmatched {len(still)}")

    # Load clubs map
    clubs = {
        str(r[0]): r[1]
        for r in con.execute("select club_id, name from clubs").fetchall()
    }

    # Load games season map
    print("Loading games…")
    games = {
        str(r[0]): (int(r[1] or 0), r[2] or "")
        for r in con.execute("select game_id, season, competition_id from games").fetchall()
    }
    print(f"Games: {len(games)}")

    target_ids = {str(int(v["player_id"])) for v in matched.values()}
    id_to_game_name = {str(int(v["player_id"])): k for k, v in matched.items()}

    # Appearances aggregation via duckdb SQL — much faster
    print("Aggregating appearances in DuckDB…")
    ids_sql = ",".join(target_ids) if target_ids else "0"
    app_rows = con.execute(
        f"""
        select a.player_id, a.player_club_id, a.competition_id, a.goals, a.assists,
               a.minutes_played, a.yellow_cards, a.red_cards, a.date, a.game_id
        from appearances a
        where a.player_id in ({ids_sql})
        """
    ).fetchall()
    print(f"Appearance rows: {len(app_rows)}")

    season_agg = {}  # pid -> {(seasonStart, clubName): stats}
    intl_bags = {}

    for row in app_rows:
        pid, club_id, comp, goals, assists, mins, yel, red, date, game_id = row
        pid = str(pid)
        g = games.get(str(game_id))
        season_start = g[0] if g else (int(str(date)[:4]) if date else 0)
        if not season_start:
            continue
        comp = comp or (g[1] if g else "")
        date_year = int(str(date)[:4]) if date else season_start
        goals = int(goals or 0)
        assists = int(assists or 0)
        mins = int(mins or 0)
        yel = int(yel or 0)
        red = int(red or 0)

        if comp in INTL_COMP:
            bag = intl_bags.setdefault(pid, {"wc": {}, "majors": {}})
            if comp == "FIWC":
                e = bag["wc"].setdefault(date_year, {"year": date_year, "apps": 0, "goals": 0, "assists": 0})
                e["apps"] += 1
                e["goals"] += goals
                e["assists"] += assists
            elif comp in MAJOR_INTL:
                mk = f"{comp}|{date_year}"
                meta = MAJOR_INTL[comp]
                e = bag["majors"].setdefault(
                    mk,
                    {"year": date_year, "name": meta[0], "nameTh": meta[1], "apps": 0, "goals": 0},
                )
                e["apps"] += 1
                e["goals"] += goals
            continue

        club_name = clubs.get(str(club_id))
        if not club_name:
            continue
        key = (season_start, club_name)
        bag = season_agg.setdefault(pid, {})
        cur = bag.setdefault(
            key,
            {
                "seasonStart": season_start,
                "clubName": club_name,
                "apps": 0,
                "goals": 0,
                "assists": 0,
                "minutes": 0,
                "yellows": 0,
                "reds": 0,
            },
        )
        cur["apps"] += 1
        cur["goals"] += goals
        cur["assists"] += assists
        cur["minutes"] += mins
        cur["yellows"] += yel
        cur["reds"] += red

    history = json.loads(HISTORY.read_text(encoding="utf-8")) if HISTORY.exists() else {}

    print("Fetching live transfers + injuries + national (this takes a while)…")
    live = {}  # pid -> {transfers, injuries, national}

    def fetch_live(pid: str):
        try:
            transfers = fetch_transfers(int(pid))
        except Exception as e:
            transfers = []
            err_t = str(e)
        else:
            err_t = None
        try:
            injuries = fetch_injuries(int(pid))
        except Exception:
            injuries = []
        try:
            national = fetch_national(int(pid))
        except Exception:
            national = {"caps": 0, "goals": 0, "teams": []}
        return pid, {"transfers": transfers, "injuries": injuries, "national": national, "err": err_t}

    pids = list(target_ids)
    done = 0
    with ThreadPoolExecutor(max_workers=12) as ex:
        futs = [ex.submit(fetch_live, pid) for pid in pids]
        for fut in as_completed(futs):
            pid, payload = fut.result()
            live[pid] = payload
            done += 1
            if done % 100 == 0:
                print(f"  live {done}/{len(pids)}")

    print("Building output…")
    by_name = {}
    with_apps = 0
    with_transfers = 0
    with_injuries = 0

    for game_name, tm in matched.items():
        pid = str(int(tm["player_id"]))
        bags = season_agg.get(pid, {})
        seasons = []
        apps_by_club = {}
        for cur in bags.values():
            s = {
                "season": cur["seasonStart"] + 1,
                "label": f"{cur['seasonStart']}/{str(cur['seasonStart'] + 1)[2:]}",
                "clubName": cur["clubName"],
                "apps": cur["apps"],
                "goals": cur["goals"],
                "assists": cur["assists"],
                "minutes": cur["minutes"],
                "yellows": cur["yellows"],
                "reds": cur["reds"],
            }
            seasons.append(s)
            apps_by_club[s["clubName"]] = apps_by_club.get(s["clubName"], 0) + s["apps"]
        seasons = [s for s in seasons if apps_by_club.get(s["clubName"], 0) >= 3]
        seasons.sort(key=lambda x: (x["season"], x["clubName"]))
        if seasons:
            with_apps += 1

        club_meta = {}
        for s in seasons:
            prev = club_meta.get(s["clubName"]) or {
                "clubName": s["clubName"],
                "fromYear": s["season"] - 1,
                "toYear": s["season"],
                "firstSeason": s["season"],
            }
            prev["fromYear"] = min(prev["fromYear"], s["season"] - 1)
            prev["toYear"] = max(prev["toYear"], s["season"])
            prev["firstSeason"] = min(prev["firstSeason"], s["season"])
            club_meta[s["clubName"]] = prev
        clubs_path = [
            {"clubName": c["clubName"], "fromYear": c["fromYear"], "toYear": c["toYear"]}
            for c in sorted(club_meta.values(), key=lambda x: x["firstSeason"])
        ]

        lv = live.get(pid) or {}
        transfers = [t for t in (lv.get("transfers") or []) if t.get("year", 0) >= 2005][-30:]
        if transfers:
            with_transfers += 1
        injuries = lv.get("injuries") or []
        if injuries:
            with_injuries += 1
        national = lv.get("national") or {}

        titles = []
        for league in (history.get("leagues") or {}).values():
            for ch in league.get("champions") or []:
                hit = any(
                    s["season"] == ch["endYear"]
                    and (
                        normalize(s["clubName"]) == normalize(ch["club"])
                        or normalize(ch["club"]).split()[-1] in normalize(s["clubName"])
                    )
                    for s in seasons
                )
                if not hit:
                    continue
                titles.append(
                    {
                        "year": ch["endYear"],
                        "label": f"{league['name']} {ch['season']}",
                        "labelTh": f"{league['nameTh']} {ch['season']}",
                        "competition": "league",
                        "clubName": ch["club"],
                    }
                )
        for ev in history.get("timeline") or []:
            if ev.get("comp") != "ucl" or not ev.get("winner"):
                continue
            hit = any(
                s["season"] == ev["year"]
                and (
                    normalize(s["clubName"]) == normalize(ev["winner"])
                    or normalize(ev["winner"]).split()[-1] in normalize(s["clubName"])
                )
                for s in seasons
            )
            if not hit:
                continue
            titles.append(
                {
                    "year": ev["year"],
                    "label": f"UCL {ev.get('season') or ev['year']}",
                    "labelTh": f"แชมเปียนส์ลีก {ev.get('season') or ev['year']}",
                    "competition": "ucl",
                    "clubName": ev["winner"],
                }
            )

        intl_raw = intl_bags.get(pid) or {"wc": {}, "majors": {}}
        world_cups = []
        for w in sorted(intl_raw["wc"].values(), key=lambda x: x["year"]):
            entry = {
                "year": w["year"],
                "apps": w["apps"],
                "goals": w["goals"],
                "assists": w["assists"],
                "bestStage": "Final" if w["apps"] >= 6 else ("Knockout" if w["apps"] >= 4 else "Group"),
                "bestStageTh": "ลึก / ชิง" if w["apps"] >= 6 else ("รอบน็อกเอาต์" if w["apps"] >= 4 else "รอบกลุ่ม"),
                "champion": False,
            }
            champ = next(
                (e for e in (history.get("timeline") or []) if e.get("comp") == "world_cup" and e.get("year") == w["year"]),
                None,
            )
            nation = tm.get("country_of_citizenship") or ""
            if champ and normalize(champ.get("winner") or "") == normalize(nation):
                entry["champion"] = True
                entry["bestStage"] = "Winner"
                entry["bestStageTh"] = "แชมป์โลก"
                titles.append(
                    {
                        "year": w["year"],
                        "label": f"FIFA World Cup {w['year']}",
                        "labelTh": f"ฟุตบอลโลก {w['year']}",
                        "competition": "world_cup",
                        "nation": nation,
                    }
                )
            world_cups.append(entry)

        majors = sorted(intl_raw["majors"].values(), key=lambda x: x["year"])
        major_tournaments = [
            {
                "year": e["year"],
                "name": e["name"],
                "nameTh": e["nameTh"],
                "apps": e["apps"],
                "goals": e["goals"],
                "bestStageTh": "รอบน็อกเอาต์" if e["apps"] >= 4 else "รอบกลุ่ม",
            }
            for e in majors
        ]

        caps = int(national.get("caps") or tm.get("international_caps") or 0)
        intl_goals = int(national.get("goals") or tm.get("international_goals") or 0)
        nation = tm.get("country_of_citizenship") or "—"
        apps_tot = sum(s["apps"] for s in seasons)
        goals_tot = sum(s["goals"] for s in seasons)

        by_name[game_name] = {
            "source": "transfermarkt",
            "tmPlayerId": int(pid),
            "tmUrl": tm.get("url"),
            "nation": nation,
            "seasons": seasons,
            "clubs": clubs_path,
            "transfers": transfers,
            "titles": sorted(titles, key=lambda x: -x["year"]),
            "intl": {
                "nation": nation,
                "nationTh": nation,
                "caps": caps,
                "goals": intl_goals,
                "worldCups": world_cups,
                "majorTournaments": major_tournaments,
            },
            "injuries": injuries,
            "debutYear": clubs_path[0]["fromYear"] if clubs_path else (seasons[0]["season"] - 1 if seasons else None),
            "summaryTh": (
                f"{game_name} · Transfermarkt จริง · {apps_tot} นัด {goals_tot} ประตู · "
                f"แคป {caps} · ย้าย {len(transfers)} · เจ็บ {len(injuries)} · แชมป์ {len(titles)}"
            ),
        }

    out = {
        "version": 2,
        "source": "transfermarkt (appearances + ceapi transfers + tmapi injuries/national)",
        "sourceUrl": "https://www.transfermarkt.co.uk/",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "noteTh": "ข้อมูลจริงทั้งหมดจาก Transfermarkt — ไม่มีการประมาณการ · คนที่จับคู่ชื่อไม่ได้จะไม่มีประวัติอาชีพ",
        "stats": {
            "roster": len(roster),
            "matched": len(matched),
            "withAppearances": with_apps,
            "withTransfers": with_transfers,
            "withInjuries": with_injuries,
            "unmatched": len(still),
            "searchHits": search_hits,
        },
        "unmatchedSample": still[:60],
        "byName": by_name,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(json.dumps(out["stats"], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

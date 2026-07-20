"""
Re-fetch Transfermarkt transfers for all matched players and patch realPlayerCareers.json.
Fixes date/fee parsing (dateUnformatted + €Xm strings).
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
CACHE = ROOT / "scripts" / "_tm_data" / "transfers_cache.json"

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
            time.sleep(0.35 * (i + 1))
    raise last  # type: ignore


def parse_fee(fee_str) -> tuple[int | None, str]:
    """Return (feeEur, kind)."""
    if fee_str is None:
        return None, "transfer"
    if isinstance(fee_str, (int, float)):
        v = int(fee_str)
        return v, ("free" if v == 0 else "transfer")
    s = str(fee_str).strip().lower()
    # strip currency symbols / weird encodings
    raw = str(fee_str)
    if "loan" in s or "leihe" in s:
        kind = "loan_end" if "end of loan" in s or "leihende" in s or "loan end" in s else "loan"
        return None, kind
    if "free" in s or "ablösefrei" in s or "ohne ablöse" in s:
        return 0, "free"
    if "draft" in s or "?" in s or s in {"-", "—", ""}:
        return None, "transfer"
    # €65.00m / €500k / €1.50bn
    m = re.search(r"([\d.,]+)\s*(bn|b|m|k)?", raw.replace(",", ""), re.I)
    if not m:
        return None, "transfer"
    num = float(m.group(1))
    suf = (m.group(2) or "").lower()
    if suf in {"bn", "b"}:
        num *= 1_000_000_000
    elif suf == "m":
        num *= 1_000_000
    elif suf == "k":
        num *= 1_000
    return int(num), "transfer"


def parse_year(t: dict) -> int:
    du = t.get("dateUnformatted") or ""
    if isinstance(du, str) and len(du) >= 4 and du[:4].isdigit():
        return int(du[:4])
    season = str(t.get("season") or "")
    # 19/20 → 2020 (arrival year prefer date)
    m = re.match(r"(\d{2})/(\d{2})", season)
    if m:
        return 2000 + int(m.group(2))
    date = str(t.get("date") or "")
    # 29/01/2020
    m = re.search(r"(20\d{2})", date)
    if m:
        return int(m.group(1))
    return 0


def fetch_transfers(pid: int):
    data = http_json(f"https://www.transfermarkt.co.uk/ceapi/transferHistory/list/{pid}")
    out = []
    for t in data.get("transfers") or []:
        if t.get("upcoming") or t.get("futureTransfer"):
            continue
        year = parse_year(t)
        fee, kind = parse_fee(t.get("fee"))
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


def main():
    db = json.loads(OUT.read_text(encoding="utf-8"))
    by_name = db["byName"]
    # unique tm ids
    id_to_names: dict[str, list[str]] = {}
    for name, row in by_name.items():
        pid = str(row.get("tmPlayerId") or "")
        if not pid:
            continue
        id_to_names.setdefault(pid, []).append(name)

    cache = {}
    if CACHE.exists():
        cache = json.loads(CACHE.read_text(encoding="utf-8"))

    todo = [pid for pid in id_to_names if pid not in cache]
    print(f"Players with TM id: {len(id_to_names)} · cached {len(cache)} · todo {len(todo)}", flush=True)

    def job(pid: str):
        try:
            return pid, fetch_transfers(int(pid)), None
        except Exception as e:
            return pid, [], str(e)

    done = 0
    with ThreadPoolExecutor(max_workers=16) as ex:
        futs = [ex.submit(job, pid) for pid in todo]
        for fut in as_completed(futs):
            pid, transfers, err = fut.result()
            cache[pid] = transfers
            done += 1
            if done % 100 == 0:
                CACHE.write_text(json.dumps(cache), encoding="utf-8")
                print(f"  transfers {done}/{len(todo)} · sample_n={len(transfers)} err={err}", flush=True)

    CACHE.write_text(json.dumps(cache), encoding="utf-8")

    with_t = 0
    for pid, names in id_to_names.items():
        transfers = cache.get(pid) or []
        if transfers:
            with_t += 1
        for name in names:
            row = by_name[name]
            row["transfers"] = transfers
            # refresh summary
            apps = sum(s.get("apps", 0) for s in row.get("seasons") or [])
            goals = sum(s.get("goals", 0) for s in row.get("seasons") or [])
            caps = (row.get("intl") or {}).get("caps") or 0
            inj = len(row.get("injuries") or [])
            titles = len(row.get("titles") or [])
            row["summaryTh"] = (
                f"{name} · Transfermarkt จริง · {apps} นัด {goals} ประตู · "
                f"แคป {caps} · ย้าย {len(transfers)} · เจ็บ {inj} · แชมป์ {titles}"
            )

    db["stats"]["withTransfers"] = with_t
    db["generatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    db["noteTh"] = (
        "ข้อมูลจริง Transfermarkt — appearances + ceapi transfers (ค่าตัว) + "
        "tmapi injuries/national · ไม่ประมาณการ"
    )
    OUT.write_text(json.dumps(db, ensure_ascii=False), encoding="utf-8")
    print(f"Patched {OUT} · withTransfers={with_t}", flush=True)

    # spot check
    for n in ["Bruno Fernandes", "Harry Kane", "Amad", "Mohamed Salah"]:
        row = by_name.get(n) or {}
        ts = row.get("transfers") or []
        print(n, len(ts), ts[-1] if ts else None, flush=True)


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""后台补拉 partial clone 缺的对象(Python 版:subprocess 带超时,避免 git fetch 卡死)。

- 每轮列 origin/main 的 missing objects;取前 8 个用 `git fetch origin <sha...>` 拉;
- 单次 fetch 超时 90s,失败重试 3 次;网络断就等 10s 再试;
- 直到 missing == 0 或跑满 240 轮。
日志: .tmp/fetch-blobs-loop.log
"""
import subprocess
import sys
import time

REPO = r"D:\workspace\yinjia"
LOG = r"D:\workspace\yinjia\.tmp\fetch-blobs-loop.log"
GIT = ["git", "-c", "http.proxy=", "-c", "http.sslBackend=openssl", "-c", "http.postBuffer=524288000"]


def log(msg):
    line = "%s %s" % (time.strftime("%H:%M:%S"), msg)
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def run(args, timeout):
    try:
        p = subprocess.run(args, cwd=REPO, capture_output=True, timeout=timeout)
        return p.returncode, p.stdout.decode("utf-8", "replace"), p.stderr.decode("utf-8", "replace")
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"


def missing():
    rc, out, _ = run(GIT + ["rev-list", "--objects", "--missing=print", "origin/main"], 180)
    if rc != 0:
        return None
    return [ln[1:].strip() for ln in out.splitlines() if ln.startswith("?")]


log("=== python-loop start ===")
for rnd in range(1, 241):
    miss = missing()
    if miss is None:
        log("round %d: enumerate failed, sleep" % rnd)
        time.sleep(10)
        continue
    if not miss:
        log("=== ALL PRESENT at round %d ===" % rnd)
        break
    chunk = miss[:8]
    ok = False
    for t in range(1, 4):
        rc, out, err = run(GIT + ["fetch", "--no-tags", "--quiet", "origin"] + chunk, 90)
        if rc == 0:
            ok = True
            break
        time.sleep(3)
    log("round %d missing=%d chunk=%d ok=%s" % (rnd, len(miss), len(chunk), ok))
    if not ok:
        time.sleep(10)

miss = missing()
log("=== python-loop end missing=%s ===" % (len(miss) if miss is not None else "?"))

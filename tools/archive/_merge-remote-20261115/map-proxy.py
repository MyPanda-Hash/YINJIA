# -*- coding: utf-8 -*-
"""本机 DNS 被污染(github.com → 20.247.166.64,不可达)时的临时映射代理。

链路:git(HTTPS) → 本代理(CONNECT 改写 github.com → 20.205.243.166) → Clash(127.0.0.1:7890) → GitHub
- 只监听 127.0.0.1:18080;上游代理可用 UPSTREAM 环境变量覆盖(默认 http://127.0.0.1:7890)。
- 收到 CONNECT host:port:host 命中 MAP 时把目标换成 IP,再向 Clash 发一次 CONNECT;
  非 MAP 的 host 原样转发。TLS 的 SNI/Host 仍是 github.com ⇒ 证书校验照常。
"""
import asyncio
import os
import sys

MAP = {"github.com": "20.205.243.166"}
UPSTREAM = os.environ.get("UPSTREAM", "127.0.0.1:7890")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18080
LOG = r"D:\workspace\yinjia\.tmp\map-proxy.log"


def log(msg):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(msg + "\n")


async def pipe(reader, writer):
    try:
        while True:
            data = await reader.read(65536)
            if not data:
                break
            writer.write(data)
            await writer.drain()
    except Exception:
        pass
    finally:
        try:
            writer.close()
        except Exception:
            pass


async def handle(reader, writer):
    try:
        head = await reader.readuntil(b"\r\n\r\n")
    except Exception:
        writer.close()
        return
    parts = head.decode("latin-1").split("\r\n")[0].split()
    if len(parts) < 2 or parts[0] != "CONNECT":
        writer.write(b"HTTP/1.1 405 Only CONNECT\r\n\r\n")
        writer.close()
        return
    hostport = parts[1]
    host, _, port = hostport.rpartition(":")
    port = port or "443"
    target = MAP.get(host, host)
    try:
        up_r, up_w = await asyncio.open_connection(*UPSTREAM.split(":"))
        up_w.write(("CONNECT %s:%s HTTP/1.1\r\nHost: %s:%s\r\n\r\n" % (target, port, target, port)).encode())
        await up_w.drain()
        resp = await up_r.readuntil(b"\r\n\r\n")
        code = resp.split(b" ")[1] if b" " in resp else b"???"
        log("CONNECT %s:%s -> %s via upstream: %s" % (host, port, target, code.decode(errors="ignore")))
        if not code.startswith(b"2"):
            writer.write(b"HTTP/1.1 502 Upstream " + code + b"\r\n\r\n")
            writer.close()
            return
    except Exception as e:
        log("upstream fail %s: %s" % (target, e))
        writer.write(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
        writer.close()
        return
    writer.write(b"HTTP/1.1 200 Connection Established\r\n\r\n")
    await writer.drain()
    await asyncio.gather(pipe(reader, up_w), pipe(up_r, writer))


async def main():
    server = await asyncio.start_server(handle, "127.0.0.1", PORT)
    log("listening on 127.0.0.1:%d upstream=%s" % (PORT, UPSTREAM))
    async with server:
        await server.serve_forever()


asyncio.run(main())

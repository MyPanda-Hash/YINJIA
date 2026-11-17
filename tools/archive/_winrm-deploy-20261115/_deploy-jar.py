#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_deploy-jar.py — 用仓库自带的 deploy_src.py 换 jar,但**放宽 WinRM 超时**

为什么需要这层壳:`build_jar()` 是在服务器上同步跑 `npm ci && npm run build && mvn package`
(实测 3~8 分钟),而 pywinrm 默认 `read_timeout_sec = 30` —— 构建期日志写的是文件,
stdout 可能静默超过 30s ⇒ 客户端先 ReadTimeout,服务器那边还在构建,状态难判。
这里把 read/operation 超时放宽到 30/29 分钟再调用 `deploy_src.main()`,其余行为完全一致。

用法:
    python _deploy-jar.py --ref <sha>            # 完整流程(构建→备份库→停→换 jar→起→验收)
    python _deploy-jar.py --check                # 只读体检
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "deploy" / "winrm"))

import winrm_client  # noqa: E402

_orig_connect = winrm_client.connect


def connect_loose():
    s = _orig_connect()
    for attr, val in (("read_timeout_sec", 1800), ("operation_timeout_sec", 1700)):
        try:
            setattr(s._s.protocol.transport, attr, val)
        except Exception:
            pass
    return s


winrm_client.connect = connect_loose   # deploy_src 里 `from winrm_client import connect` 在 import 时绑定

import deploy_src  # noqa: E402

if __name__ == "__main__":
    sys.argv[0] = "deploy_src.py"
    raise SystemExit(deploy_src.main())

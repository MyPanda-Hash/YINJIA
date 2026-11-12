#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
winrm_client.py — YINJIA-MES 服务器连接库(macOS / Linux 通用)

作用:在 **非 Windows** 机器上连 Windows 服务器执行命令。
  工具:pywinrm(纯 Python,`pip install pywinrm`),协议 WinRM over HTTP(5985)。

⚠ 为什么是 WinRM 而不是 SSH/SMB:
  服务器只开 4 个端口 —— 22(SSH) 不通、445(SMB) 不通、22/445 都不通。
  实测可达:5985(WinRM)、1433(SQL Server)、3389(RDP)、8090(应用)。
  ⇒ 程序化通道只剩 WinRM;传文件走"服务器自己下载"(见 deploy_src.py)。

凭据来源(优先级从高到低):
  1. 环境变量 YJ_SERVER_USER / YJ_SERVER_PASS
  2. 同目录 config.json 的 server.user / server.pass
  3. 交互式询问(不落盘)

安全:密码只在内存里用,本库不写任何日志文件;config.json 建议 chmod 600。
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

try:
    import winrm
except ImportError:
    sys.stderr.write(
        "\n[缺少依赖] 请先安装:\n"
        "    python3 -m pip install pywinrm\n\n"
    )
    raise SystemExit(2)

HERE = Path(__file__).resolve().parent
CONFIG_PATH = HERE / "config.json"   # 本地私有，已 gitignore；模板见 config.example.json

# ─────────────────────────────────────────────────────────────
# 终端编码
#   macOS 默认 UTF-8,但两处会翻车:
#     ① Windows 上跑(GBK 控制台)中文会变 ?;
#     ② 管道/重定向时 Python 按 locale 猜编码。
#   这里统一把 stdout/stderr 钉成 UTF-8,并在不支持时退回 replace 而不是崩。
# ─────────────────────────────────────────────────────────────
def _force_utf8() -> None:
    import io

    for name in ("stdout", "stderr"):
        stream = getattr(sys, name)
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")  # py3.7+
        except Exception:
            try:
                setattr(sys, name, io.TextIOWrapper(stream.buffer, encoding="utf-8", errors="replace"))
            except Exception:
                pass


_force_utf8()


# ─────────────────────────────────────────────────────────────
# 配置
# ─────────────────────────────────────────────────────────────
DEFAULTS = {
    "server": {
        "host": "36.140.66.163",
        "winrm_port": 5985,
        "user": "administrator",
        "pass": "",
        "app_port": 8090,
        "install_dir": r"C:\yinjia",
        "deploy_dir": r"C:\yj-deploy",
        "task_name": "YINJIA-MES",
        "app_user": "admin",
        "app_pass": "123456",
    },
    "repo": {
        "owner": "MyPanda-Hash",
        "name": "YINJIA",
        "branch": "main",
    },
    "sql": {
        "host": "36.140.66.163",
        "port": 1433,
        "user": "yinjia",
        # 🔴 口令一律不落仓库：运行时用环境变量 YJ_SQL_PASS，或写进 deploy/winrm/config.json（已 gitignore）。
        #    历史上本文件在仓库外时曾把口令写死在这里，搬进仓库前已清空。
        "pass": "",
        "db": "HSDZ_MES",
        "db_test": "HSDZ_MES_TEST",
    },
}


def _deep_merge(base: dict, over: dict) -> dict:
    out = dict(base)
    for k, v in (over or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def load_config() -> dict:
    """读 config.json 并叠加环境变量覆盖。"""
    cfg = json.loads(json.dumps(DEFAULTS))  # deep copy
    if CONFIG_PATH.exists():
        try:
            cfg = _deep_merge(cfg, json.loads(CONFIG_PATH.read_text("utf-8")))
        except Exception as e:
            sys.stderr.write(f"[warn] config.json 解析失败,用默认值: {e}\n")

    srv = cfg["server"]
    srv["host"] = os.environ.get("YJ_SERVER_HOST", srv["host"])
    srv["user"] = os.environ.get("YJ_SERVER_USER", srv["user"])
    srv["pass"] = os.environ.get("YJ_SERVER_PASS", srv["pass"])
    if os.environ.get("YJ_SERVER_PORT"):
        srv["winrm_port"] = int(os.environ["YJ_SERVER_PORT"])
    sql = cfg["sql"]
    sql["pass"] = os.environ.get("YJ_SQL_PASS", sql["pass"])
    return cfg


def resolve_credentials(cfg: dict, prompt: bool = True) -> tuple[str, str]:
    """取出 (user, pass);没有密码时按需交互询问一次。"""
    srv = cfg["server"]
    user, pw = srv.get("user", ""), srv.get("pass", "")
    if pw:
        return user, pw
    if not prompt:
        raise SystemExit(
            "[缺少密码] 请设置环境变量 YJ_SERVER_PASS,或在 config.json 里填 server.pass"
        )
    import getpass

    if not user:
        user = input("服务器用户名 [administrator]: ").strip() or "administrator"
    pw = getpass.getpass(f"{user}@{srv['host']} 的密码: ")
    if not pw:
        raise SystemExit("[中止] 密码为空")
    return user, pw


# ─────────────────────────────────────────────────────────────
# 会话
# ─────────────────────────────────────────────────────────────
class Server:
    """一个 WinRM 会话的薄封装。失败信息统一成可读的一句话。"""

    def __init__(self, cfg: dict | None = None, prompt: bool = True):
        self.cfg = cfg or load_config()
        srv = self.cfg["server"]
        self.host = srv["host"]
        self.user, self.pw = resolve_credentials(self.cfg, prompt=prompt)
        endpoint = f"http://{self.host}:{srv['winrm_port']}/wsman"
        # 2026-11-05：该服务器 NTLM 协商被拒（服务器同时开了 Negotiate/Basic），
        # 实测 Basic 可用 ⇒ 允许用 YJ_WINRM_TRANSPORT=basic 显式指定，缺省仍是 ntlm。
        transport = (os.environ.get("YJ_WINRM_TRANSPORT") or "ntlm").strip().lower()
        self._s = winrm.Session(endpoint, auth=(self.user, self.pw), transport=transport)
        if transport == "basic":
            print("      [注意] 使用 Basic 认证（明文 HTTP，仅限本次部署会话）")
        self.endpoint = endpoint

    # ---- 底层 ----
    @staticmethod
    def _decode(b: bytes) -> str:
        return (b or b"").decode("utf-8", "replace").replace("\r\n", "\n").strip()

    def run(self, cmd: str, check: bool = False) -> tuple[int, str, str]:
        """执行一条 **cmd.exe** 命令(适合 where/curl/tar/schtasks 这类)。"""
        r = self._s.run_cmd(cmd)
        out, err = self._decode(r.std_out), self._decode(r.std_err)
        if check and r.status_code != 0:
            raise RuntimeError(f"命令失败(rc={r.status_code}): {cmd}\n{err[:800]}")
        return r.status_code, out, err

    def ps(self, script: str, check: bool = False) -> tuple[int, str, str]:
        """执行一段 **PowerShell**。多行脚本走 stdin,不受命令行长度限制。"""
        r = self._s.run_ps(script)
        out, err = self._decode(r.std_out), self._decode(r.std_err)
        # PowerShell 把 warning/progress 塞进 stderr 的 CLIXML,过滤掉噪音
        if err.startswith("#< CLIXML"):
            keep = [ln for ln in err.split("\n") if not ln.startswith("<Objs")]
            err = "\n".join(keep).strip()
        if check and r.status_code != 0:
            raise RuntimeError(f"PowerShell 失败(rc={r.status_code}):\n{err[:800] or out[:800]}")
        return r.status_code, out, err

    # ---- 便捷 ----
    def ping(self) -> str:
        _, out, _ = self.run("hostname")
        return out

    def exists(self, path: str) -> bool:
        rc, out, _ = self.ps(f"if (Test-Path -LiteralPath '{path}') {{ 'YES' }} else {{ 'NO' }}")
        return out.strip().endswith("YES")

    def read_text(self, path: str) -> str:
        _, out, _ = self.ps(f"if (Test-Path -LiteralPath '{path}') {{ Get-Content -LiteralPath '{path}' -Raw }}")
        return out

    def tail(self, path: str, n: int = 60) -> str:
        _, out, _ = self.ps(
            f"if (Test-Path -LiteralPath '{path}') {{ Get-Content -LiteralPath '{path}' -Tail {n} }}"
        )
        return out


def connect() -> Server:
    """给脚本用的一步到位连接(连上就打印一行确认)。"""
    s = Server()
    try:
        name = s.ping()
    except Exception as e:
        sys.stderr.write(f"\n[连接失败] {s.endpoint}\n  {type(e).__name__}: {e}\n\n")
        sys.stderr.write(
            "排查顺序:\n"
            "  1) 网络:ping 36.140.66.163;telnet 36.140.66.163 5985\n"
            "  2) 凭据:确认 YJ_SERVER_PASS / config.json 里的密码正确(注意 % 等特殊字符要加引号)\n"
            "  3) 服务器 WinRM:\n"
            "     winrm quickconfig\n"
            "     winrm get winrm/config/service    # 看 AllowUnencrypted / Auth\n"
        )
        raise SystemExit(1)
    print(f"[ok] 已连接 {name} ({s.endpoint})")
    return s


if __name__ == "__main__":
    s = connect()
    print("主机名:", s.ping())
    rc, out, _ = s.run("where java")
    print("java:", out.split("\n")[0] if out else "(未找到)")

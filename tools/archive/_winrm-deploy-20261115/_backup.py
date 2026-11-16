#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_backup.py — 部署前双保险:数据库 .bak + 现役 jar 归档(2026-11-15)

为什么单独做一遍:`deploy_src.py` 自带的库备份发生在 **迁移之后、换 jar 之前**,
而本轮要先跑 22 条迁移 —— 迁移一旦改库,再备份就丢了"迁移前"这个回滚点。
所以顺序必须是:**先备份 → 再跑迁移 → 再换 jar**。

只做三件事(全部可复核):
  1. BACKUP DATABASE HSDZ_MES / HSDZ_MES_TEST → C:\\yinjia\\backup\\pre-deploy-<ts>.bak
     (FORMAT, INIT;备份后 RESTORE VERIFYONLY 校验头部与页校验和)
  2. 归档现役 C:\\yinjia\\app.jar → C:\\yinjia\\backup\\app-<ts>.jar(SHA256 与现役一致才算成功)
  3. 打印 C 盘剩余空间 + 两份备份大小

凭据:YJ_SERVER_USER / YJ_SERVER_PASS / YJ_WINRM_TRANSPORT=basic(不落盘);
     本机系统代理会截胡 pywinrm ⇒ 必须 NO_PROXY=<host>。
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "deploy" / "winrm"))

from winrm_client import Server  # noqa: E402

INST = r"C:\yinjia"


def main() -> int:
    s = Server(prompt=False)
    ps = rf'''
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$bakDir = '{INST}\backup'
if (-not (Test-Path $bakDir)) {{ New-Item -ItemType Directory -Path $bakDir -Force | Out-Null }}

$d = Get-PSDrive C
Write-Output ('disk-free=' + [math]::Round($d.Free/1GB,1) + 'GB')

$jar = '{INST}\app.jar'
$jarHash = (Get-FileHash $jar -Algorithm SHA256).Hash
Write-Output ('jar-now=' + $jarHash + ' size=' + (Get-Item $jar).Length)

$bak  = Join-Path $bakDir ('pre-deploy-' + $ts + '.bak')
$bakT = Join-Path $bakDir ('pre-deploy-test-' + $ts + '.bak')
$jarB = Join-Path $bakDir ('app-' + $ts + '.jar')

# ① 库备份(正式 + 测试)
& sqlcmd -S localhost -E -b -Q "BACKUP DATABASE [HSDZ_MES] TO DISK = N'$bak' WITH FORMAT, INIT" *> $null
Write-Output ('BAK01=' + $(if (Test-Path $bak) {{ [math]::Round((Get-Item $bak).Length/1MB,1).ToString() + 'MB' }} else {{ 'MISSING' }}))
& sqlcmd -S localhost -E -b -Q "BACKUP DATABASE [HSDZ_MES_TEST] TO DISK = N'$bakT' WITH FORMAT, INIT" *> $null
Write-Output ('BAK02=' + $(if (Test-Path $bakT) {{ [math]::Round((Get-Item $bakT).Length/1MB,1).ToString() + 'MB' }} else {{ 'MISSING' }}))

# ② 备份可还原性(RESTORE VERIFYONLY:只读备份头+页校验,不动现库)
& sqlcmd -S localhost -E -b -Q "RESTORE VERIFYONLY FROM DISK = N'$bak'"  *> $null
Write-Output ('VERIFY01=' + $(if ($LASTEXITCODE -eq 0) {{ 'OK' }} else {{ 'FAIL' }}))
& sqlcmd -S localhost -E -b -Q "RESTORE VERIFYONLY FROM DISK = N'$bakT'" *> $null
Write-Output ('VERIFY02=' + $(if ($LASTEXITCODE -eq 0) {{ 'OK' }} else {{ 'FAIL' }}))

# ③ 现役 jar 归档 + 校验
Copy-Item $jar $jarB -Force
$jarBHash = (Get-FileHash $jarB -Algorithm SHA256).Hash
Write-Output ('JARB=' + $jarB)
Write-Output ('JARB-HASH-OK=' + $(if ($jarBHash -eq $jarHash) {{ 'YES' }} else {{ 'NO' }}))
Write-Output ('TS=' + $ts)
'''
    rc, out, err = s.ps(ps)
    print(out.strip())
    if err.strip() and not err.startswith("#< CLIXML"):
        print("[stderr]", err[:500])
    ok = all(k in out for k in ("BAK01=", "BAK02=", "VERIFY01=OK", "VERIFY02=OK", "JARB-HASH-OK=YES")) and "MISSING" not in out
    print("\nRESULT:", "BACKUP-ALL-OK" if ok else "BACKUP-PROBLEM(看上面逐项)")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

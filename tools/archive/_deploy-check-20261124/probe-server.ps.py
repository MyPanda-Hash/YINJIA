#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
probe-server.ps.py — 2026-11-24 只读体检:服务器上有没有「刚才」发生过部署。

只跑读命令(dir / schtasks / Get-Process / 日志时间戳),不写不删。
凭据:环境变量 YJ_SERVER_PASS,YJ_WINRM_TRANSPORT=basic,NO_PROXY=<host>。
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(r"D:\workspace\yinjia\deploy\winrm")))
from winrm_client import connect  # noqa: E402

PS = r"""
$ErrorActionPreference = 'SilentlyContinue'
function L($t) { Write-Output ("=== " + $t + " ===") }

L 'app.jar'
$j = Get-Item 'C:\yinjia\app.jar'
if ($j) { Write-Output ("{0}  {1} bytes  {2}" -f $j.FullName, $j.Length, $j.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')) }
Write-Output ('SHA256 ' + (Get-FileHash 'C:\yinjia\app.jar' -Algorithm SHA256).Hash)

L 'backup jars (newest 5)'
Get-ChildItem 'C:\yinjia\backup\*.jar' | Sort-Object LastWriteTime -Descending |
  Select-Object -First 5 | ForEach-Object { Write-Output ("{0}  {1}  {2} MB" -f $_.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'), $_.Name, [math]::Round($_.Length/1MB,1)) }

L 'backup bak (newest 5)'
Get-ChildItem 'C:\yinjia\backup\*.bak' | Sort-Object LastWriteTime -Descending |
  Select-Object -First 5 | ForEach-Object { Write-Output ("{0}  {1}  {2} MB" -f $_.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'), $_.Name, [math]::Round($_.Length/1MB,1)) }

L 'java process'
Get-Process java -ErrorAction SilentlyContinue | ForEach-Object { Write-Output ("PID {0}  start {1}  WS {2} MB" -f $_.Id, $_.StartTime.ToString('yyyy-MM-dd HH:mm:ss'), [math]::Round($_.WorkingSet64/1MB,0)) }

L 'task YINJIA-MES'
schtasks /query /tn "YINJIA-MES" /fo LIST /v | Select-String -Pattern 'Last Run Time|Last Result|Status|上次运行时间|上次结果|状态'

L 'work dirs mtime'
foreach ($d in @('C:\yinjia','C:\yj-deploy','C:\yinjia\jdy-sync-server')) {
  $i = Get-Item $d
  if ($i) { Write-Output ("{0}  {1}" -f $i.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'), $d) }
}

L 'newest files under C:\yinjia (top 10, excl backup)'
Get-ChildItem 'C:\yinjia' -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notlike '*\backup\*' -and $_.FullName -notlike '*\logs\*' } |
  Sort-Object LastWriteTime -Descending | Select-Object -First 10 |
  ForEach-Object { Write-Output ("{0}  {1}" -f $_.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'), $_.FullName) }

L 'app log tail time'
Get-ChildItem 'C:\yinjia\logs\*.log' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending |
  Select-Object -First 3 | ForEach-Object { Write-Output ("{0}  {1}  {2} MB" -f $_.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'), $_.Name, [math]::Round($_.Length/1MB,2)) }
"""


def main() -> int:
    s = connect()
    print("[ok] connected", s.ping())
    rc, out, err = s.ps(PS)
    print(out)
    if err.strip():
        print("--- stderr ---")
        print(err)
    return rc


if __name__ == "__main__":
    raise SystemExit(main())

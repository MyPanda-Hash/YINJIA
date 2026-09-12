# 通用报表铺开验证(PDF + XLSX 逐面板抽查;输出可粘贴)
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File tools\_probe-report-rollout.ps1
$ErrorActionPreference = 'Continue'
$out = 'C:\INCER\DSHTemp\roll-export-log.txt'
function Log($m) { $m | Tee-Object -FilePath $out -Append }
if (Test-Path $out) { Remove-Item $out -Force }

$base = 'http://localhost:8090/api/report'
$dir = 'C:\INCER\DSHTemp\roll'
New-Item -ItemType Directory -Force -Path $dir | Out-Null

# ---- 登录(userName/password 契约见 AuthController.login) ----
Set-Content -Path "$dir\login.json" -Value '{"userName":"admin","password":"123456"}' -Encoding ASCII -NoNewline
$tok = (& curl.exe -s -X POST 'http://localhost:8090/api/auth/login' -H 'Content-Type: application/json' --data-binary "@$dir\login.json" | ConvertFrom-Json).data.token
Log "=== 0. 登录 ==="
Log ("token 长度 " + $tok.Length + " (未打印明文)")

# ---- 面板清单:面板码 | 单据号 | 形态说明 ----
$cases = @(
  @{ p='SO_ORDER';     no='XSDD-20260908-00002'; shape='精细模板(登记过 so_order)+13 明细列' },
  @{ p='PU_ORDER';     no='PO-2026-08-0002';     shape='通用模板 + 14 明细列 + 头表' },
  @{ p='PURCHASE_IN';  no='PI-2026-09-0014';     shape='通用模板 + 22 明细列(需分块)' },
  @{ p='MANU_ORDER';   no='2026-08-25';          shape='通用模板 + 21 明细列 + products 页签' },
  @{ p='SALE_OUT';     no='SO-2026-09-0010';     shape='通用模板 + 17 明细列' },
  @{ p='DAY_REPORT';   no='RB-2026-09-0008';     shape='通用模板 + 12 明细列(日报)' },
  @{ p='RKD';          no='RK2608290019';        shape='单表式(无头表)+ 7 明细列' },
  @{ p='CKD';          no='LL2608310001';        shape='单表式(无头表)+ 6 明细列' },
  @{ p='WLBOM';        no='1000024147';          shape='单表式 + 10 明细列(BOM)' },
  @{ p='WO_ORDER';     no='GD-2026-09-0017';     shape='单表式 + 2 明细列(工单)' },
  @{ p='QC_OP';        no='GJ-2026-09-0010';     shape='通用模板 + 5 明细列' },
  @{ p='QC_DISPOSAL';  no='BL-2026-09-0010';     shape='无明细列面板(只有头字段)' },
  @{ p='WO_REPORT';    no='BG-2026-09-0054';     shape='无明细列面板(只有头字段)' }
)

Log ""
Log "=== A. /api/report/templates 口径抽查 ==="
foreach ($pc in @('SO_ORDER','PU_ORDER','PURCHASE_IN','QC_OP','RD_PROGRESS','RD_ALKALINE','CUSTOMER','STOCK_STATUS')) {
  $r = & curl.exe -s "$base/templates?panelCode=$pc" -H "Authorization: Bearer $tok"
  $j = $r | ConvertFrom-Json
  $names = ($j.data | ForEach-Object { $_.code + '/' + $_.name + '(' + ($_.formats -join ',') + ')' }) -join ' ; '
  if (-not $names) { $names = '(无模板 → 前端无入口)' }
  Log ("{0,-14} → {1}" -f $pc, $names)
}

Log ""
Log "=== B. PDF / XLSX 逐面板导出 ==="
Log ("{0,-14} {1,-12} {2,-6} {3,10} {4,6} {5,-8} {6}" -f '面板','格式','HTTP','字节','页数','字体','单据号')
foreach ($c in $cases) {
  foreach ($fmt in @('pdf','xlsx')) {
    $file = "$dir\$($c.p)-$($c.no).$fmt"
    $url = "$base/export?code=" + $(if ($c.p -eq 'SO_ORDER') { 'so_order' } else { 'generic' }) + "&panelCode=$($c.p)&docNo=$($c.no)&format=$fmt"
    $r = & curl.exe -s -D "$file.hdr" -o $file -w "%{http_code}|%{size_download}|%{time_total}" $url -H "Authorization: Bearer $tok"
    $parts = $r -split '\|'
    $pages = '-'; $font = '-'
    if ($fmt -eq 'pdf' -and (Test-Path $file) -and (Get-Item $file).Length -gt 0) {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $sb = New-Object System.Text.StringBuilder
      foreach ($b in $bytes) { [void]$sb.Append([char]$b) }
      $txt = $sb.ToString()
      $pages = ([regex]::Matches($txt, '/Type\s*/Page[^s]')).Count
      $ff2 = ([regex]::Matches($txt, '/FontFile2')).Count
      $ff3 = ([regex]::Matches($txt, '/FontFile3')).Count
      $noto = ([regex]::Matches($txt, 'NotoSansSC')).Count
      $font = "FF2=$ff2/FF3=$ff3/Noto=$noto"
    } elseif ($fmt -eq 'xlsx' -and (Test-Path $file) -and (Get-Item $file).Length -gt 0) {
      $pages = '-'
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      $zip = [System.IO.Compression.ZipFile]::OpenRead($file)
      $font = "sheets=" + (($zip.Entries | Where-Object { $_.FullName -eq 'xl/workbook.xml' } | ForEach-Object {
        $sr = New-Object System.IO.StreamReader($_.Open())
        $x = $sr.ReadToEnd(); $sr.Close()
        ([regex]::Matches($x, 'name="([^"]+)"') | ForEach-Object { $_.Groups[1].Value }) -join ','
      }) -join '')
      $zip.Dispose()
    }
    Log ("{0,-14} {1,-12} {2,-6} {3,10} {4,6} {5,-8} {6}" -f $c.p, $fmt, $parts[0], $parts[1], $pages, $font, $c.no)
  }
}

Log ""
Log "=== C. 形态说明(与上面逐行对应) ==="
foreach ($c in $cases) { Log ("  {0,-14} {1}" -f $c.p, $c.shape) }
Log ""
Log "=== D. 导出文件落盘 ==="
Get-ChildItem $dir -Filter '*.*' | Where-Object { $_.Extension -in '.pdf','.xlsx' } |
  Sort-Object Name | ForEach-Object { Log ("  {0,-46} {1,10} bytes" -f $_.Name, $_.Length) }

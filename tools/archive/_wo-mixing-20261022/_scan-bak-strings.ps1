$ErrorActionPreference = 'Stop'
$path = 'D:\YINJIA-main\tools\archive\_wo-mixing-20261022\wo_mixing_bak.bak'
$bytes = [System.IO.File]::ReadAllBytes($path)
"file bytes: $($bytes.Length)"
"head: " + [System.Text.Encoding]::ASCII.GetString($bytes, 0, 16)

function Find-All([byte[]]$hay, [byte[]]$needle) {
  $res = New-Object System.Collections.ArrayList
  $limit = $hay.Length - $needle.Length
  for ($j = 0; $j -le $limit; $j++) {
    if ($hay[$j] -eq $needle[0]) {
      $ok = $true
      for ($k = 1; $k -lt $needle.Length; $k++) { if ($hay[$j + $k] -ne $needle[$k]) { $ok = $false; break } }
      if ($ok) { [void]$res.Add($j) }
    }
  }
  return $res
}

$u = Find-All $bytes ([System.Text.Encoding]::Unicode.GetBytes('wo_mixing_list'))
$a = Find-All $bytes ([System.Text.Encoding]::ASCII.GetBytes('wo_mixing_list'))
$uc = Find-All $bytes ([System.Text.Encoding]::Unicode.GetBytes('HSDZ_MES'))
"utf16 hits: $($u.Count)  ascii hits: $($a.Count)  utf16 HSDZ_MES hits: $($uc.Count)"

if ($u.Count -gt 0) {
  $h = $u[0]; $s = [Math]::Max(0, $h - 600); $len = [Math]::Min(2400, $bytes.Length - $s)
  "--- utf16 context @$h ---"
  [System.Text.Encoding]::Unicode.GetString($bytes, $s, $len)
}
if ($uc.Count -gt 0) {
  $h = $uc[0]; $s = [Math]::Max(0, $h - 200); $len = [Math]::Min(1200, $bytes.Length - $s)
  "--- utf16 HSDZ_MES context @$h ---"
  [System.Text.Encoding]::Unicode.GetString($bytes, $s, $len)
}

$ErrorActionPreference = 'Stop'
$path = 'D:\YINJIA-main\tools\archive\_wo-mixing-20261022\wo_mixing_bak.bak'
$bytes = [System.IO.File]::ReadAllBytes($path)

function Count-Needle([byte[]]$hay, [byte[]]$needle) {
  $n = 0
  $limit = $hay.Length - $needle.Length
  for ($j = 0; $j -le $limit; $j++) {
    if ($hay[$j] -eq $needle[0]) {
      $ok = $true
      for ($k = 1; $k -lt $needle.Length; $k++) { if ($hay[$j + $k] -ne $needle[$k]) { $ok = $false; break } }
      if ($ok) { $n++ }
    }
  }
  return $n
}

$utf16 = { param($s) [System.Text.Encoding]::Unicode.GetBytes($s) }
$ascii = { param($s) [System.Text.Encoding]::UTF8.GetBytes($s) }

"file: $($bytes.Length) bytes"
"MSSQLBAK header: " + [System.Text.Encoding]::ASCII.GetString($bytes, 0, 16)

# 若是未压缩备份：系统目录里的对象名/列名以 UTF-16 明文存放，必然能搜到高频词
foreach ($w in @('工单号', '物料', '生产', 'dbo', 'wo_mixing_list', 'HSDZ_MES', 'assem')) {
  "{0,-18} utf16={1,3}  utf8={2,3}" -f $w, (Count-Needle $bytes (& $utf16 $w)), (Count-Needle $bytes (& $ascii $w))
}

# MTF 头：看看有没有压缩标志块(TAPE 数据块的 MTF_XPRESS / MTF_DLE 等)
$head = $bytes[0..4095]
$hex = ($head | ForEach-Object { $_.ToString('x2') }) -join ''
"zip magic(PK) at 0: " + ($bytes[0] -eq 0x50 -and $bytes[1] -eq 0x4B)
"gzip 1f8b at 0: " + ($bytes[0] -eq 0x1F -and $bytes[1] -eq 0x8B)

param([string]$Dir = 'D:\YINJIA-main\deploy\print-agent')
$files = Get-ChildItem -LiteralPath $Dir -Filter '*.ps1' | Where-Object { $_.Name -notlike '_*' }
foreach ($fi in $files) {
    $p = $fi.FullName
    $tok = $null; $err = $null
    [System.Management.Automation.Language.Parser]::ParseFile($p, [ref]$tok, [ref]$err) | Out-Null
    if ($err.Count) {
        Write-Output ("[FAIL] " + $fi.Name)
        foreach ($e in $err[0..([Math]::Min(2, $err.Count - 1))]) {
            Write-Output ("       line " + $e.Extent.StartLineNumber + ": " + $e.Message)
        }
    } else {
        Write-Output ("[PASS] " + $fi.Name + "  (BOM=" + (([System.IO.File]::ReadAllBytes($p))[0] -eq 0xEF) + ")")
    }
}

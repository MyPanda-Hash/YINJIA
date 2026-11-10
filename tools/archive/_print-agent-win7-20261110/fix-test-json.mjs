import { readFileSync, writeFileSync } from 'node:fs'

const p = 'D:/YINJIA-main/tools/archive/_print-agent-win7-20261110/test-json.ps1'
let t = readFileSync(p, 'utf8').replace(/^\uFEFF/, '')
const from = '    Write-Output ("$label => " + $j)'
const to = '    Write-Host ($label + " => " + $j)'
if (!t.includes(from)) {
  console.log('[skip] 已经改过')
} else {
  t = t.split(from).join(to)
  writeFileSync(p, '\uFEFF' + t, 'utf8')
  console.log('[ok] Show 改为 Write-Host(不再污染返回值)')
}

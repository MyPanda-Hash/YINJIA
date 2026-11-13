<#
  一键注册两个计划任务(幂等,可重复执行):
    1) JdySalOrderSync        每5分钟:**金蝶库存现存量 + 档案/订单增量**(一个入口跑完,
                              库存部分 3~4 s 跑在前面;见 sync.mjs 头部说明)
    2) JdySalOrderSyncMonthly 每月1日02:00全量复核(兜底时间窗之外的遗漏;**不含库存**)
  用法(建议管理员 PowerShell):
    powershell -ExecutionPolicy Bypass -File .\install-tasks.ps1
  说明:
    - 任务动作 = wscript.exe run-hidden.vbs(隐藏窗口,无弹窗;vbs 传参可指定脚本)
    - Settings 已含 StartWhenAvailable(关机期间错过的运行在开机后补跑)
    - ExecutionTimeLimit 1 小时:任何卡住的实例最多挡 1 小时,不会锁死一整天
    - 本脚本改写自实测配置(PS 5.1 无 -Monthly 触发器,故用 XML 注册)
    - 2026-11-10:曾单独注册的 JdyStockSync 已合并进 ① —— 本脚本会自动删掉遗留的同名任务
#>
param(
  [string]$TaskDir = $PSScriptRoot
)
$ErrorActionPreference = 'Stop'
$vbs = Join-Path $TaskDir 'run-hidden.vbs'
if (-not (Test-Path $vbs)) { throw "未找到启动器:$vbs(请在本脚本所在目录运行)" }

function Register-FromXml([string]$name, [string]$xml) {
  if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $name -Confirm:$false
  }
  $tmp = Join-Path $env:TEMP "$name.xml"
  [IO.File]::WriteAllText($tmp, $xml, [Text.Encoding]::Unicode)
  Register-ScheduledTask -TaskName $name -Xml ([IO.File]::ReadAllText($tmp, [Text.Encoding]::Unicode)) | Out-Null
  Remove-Item $tmp -Force
  $t = Get-ScheduledTaskInfo -TaskName $name
  Write-Host ("✓ {0}  状态={1}  下次运行={2}" -f $name, (Get-ScheduledTask -TaskName $name).State, $t.NextRunTime)
}

$user = "$env:COMPUTERNAME\$env:USERNAME"
$start = (Get-Date).AddMinutes(2).ToString('yyyy-MM-ddTHH:mm:ss')
$startMonthly = (Get-Date -Day 1).AddMonths(1).ToString('yyyy-MM-ddT02:00:00')

$xmlFrequent = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>每5分钟增量同步(销售+采购,仅已审核,近31天窗口;安全规范:先备份+日志留一年)</Description></RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>$start</StartBoundary>
      <Enabled>true</Enabled>
      <Repetition><Interval>PT5M</Interval><Duration>P3650D</Duration><StopAtDurationEnd>false</StopAtDurationEnd></Repetition>
      <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
    </CalendarTrigger>
  </Triggers>
  <Principals><Principal id="Author"><UserId>$user</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <StartWhenAvailable>true</StartWhenAvailable>
    <Enabled>true</Enabled>
    <ExecutionTimeLimit>PT1H</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Author">
    <Exec><Command>wscript.exe</Command><Arguments>"$TaskDir\run-hidden.vbs"</Arguments><WorkingDirectory>$TaskDir</WorkingDirectory></Exec>
  </Actions>
</Task>
"@

$xmlMonthly = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>每月1日02:00全量复核(销售+采购,仅已审核,指纹跳过;安全规范:先备份+日志留一年)</Description></RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>$startMonthly</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByMonth>
        <DaysOfMonth><Day>1</Day></DaysOfMonth>
        <Months><January/><February/><March/><April/><May/><June/><July/><August/><September/><October/><November/><December/></Months>
      </ScheduleByMonth>
    </CalendarTrigger>
  </Triggers>
  <Principals><Principal id="Author"><UserId>$user</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <StartWhenAvailable>true</StartWhenAvailable>
    <Enabled>true</Enabled>
    <ExecutionTimeLimit>PT2H</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Author">
    <Exec><Command>wscript.exe</Command><Arguments>"$TaskDir\run-hidden.vbs" "init-sync.mjs --yes"</Arguments><WorkingDirectory>$TaskDir</WorkingDirectory></Exec>
  </Actions>
</Task>
"@

# 2026-11-10:库存同步**已并入 sync.mjs**(用户口径「库存同步能不能和商品同步脚本写在一起」)
#   ⇒ 不再单开一个 JdyStockSync 任务,一个 5 分钟任务跑完「库存 + 档案/订单」。
#   只想要库存时可以手工:node sync-stock.mjs(闸门/日志与前像都在它自己身上)。
#   若历史上注册过 JdyStockSync(旧版脚本),本脚本会把它删掉,避免两处同时改库存。
if (Get-ScheduledTask -TaskName 'JdyStockSync' -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName 'JdyStockSync' -Confirm:$false
  Write-Host '✓ 已移除旧任务 JdyStockSync(库存已并入 JdySalOrderSync → sync.mjs)'
}

Register-FromXml 'JdySalOrderSync' $xmlFrequent
Register-FromXml 'JdySalOrderSyncMonthly' $xmlMonthly
Write-Host '完成:两个计划任务已注册(库存随 JdySalOrderSync 一起跑;删除任务:Unregister-ScheduledTask -TaskName <名称> -Confirm:$false)'

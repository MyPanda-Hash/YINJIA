# 启用 SQL Server 混合认证模式并重启服务(需要管理员运行)
Set-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL15.MSSQLSERVER\MSSQLServer' -Name LoginMode -Value 2
Restart-Service MSSQLSERVER -Force
Start-Sleep -Seconds 3
New-Item -ItemType Directory -Force -Path 'C:\INCER\YINJIA-MES\tools' | Out-Null
Set-Content 'C:\INCER\YINJIA-MES\tools\mixed-auth-done.txt' "LoginMode=2, service restarted at $(Get-Date)"

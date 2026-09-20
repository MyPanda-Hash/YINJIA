# _start-docker.ps1 — 拉起 Docker Desktop(路径含空格,必须走脚本文件避免 bash 剥引号)
Start-Process -FilePath 'D:\Docker\App\Docker Desktop.exe'
Write-Output 'Docker Desktop launched'

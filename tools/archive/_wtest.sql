EXEC xp_cmdshell 'cmd /c echo hello > "C:\Program Files\Microsoft SQL Server\MSSQL15.MSSQLSERVER\MSSQL\DATA\yjtest.txt"';
EXEC xp_cmdshell 'cmd /c if exist "C:\Program Files\Microsoft SQL Server\MSSQL15.MSSQLSERVER\MSSQL\DATA\yjtest.txt" (echo WRITE_OK) else (echo WRITE_FAIL)';

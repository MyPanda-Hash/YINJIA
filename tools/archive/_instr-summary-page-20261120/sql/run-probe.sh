#!/bin/bash
cd /d/workspace/yinjia/tools || exit 1
"/c/Users/vigna/.jdks/ms-25.0.4/bin/java" -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar SqlRunner.java \
 "jdbc:sqlserver://127.0.0.1:1433;databaseName=${DB:-HSDZ_MES};encrypt=false;trustServerCertificate=true" yinjia 'Yinjia@2026' "$@"

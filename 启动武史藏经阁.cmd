@echo off
setlocal
cd /d "%~dp0"
echo.
echo 正在启动武史藏经阁……
echo 访问地址：http://127.0.0.1:44000
echo 请保持此窗口开启；关闭窗口会停止本地服务。
echo.
call npm.cmd run dev

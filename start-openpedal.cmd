@echo off
title OpenPedal - Pedaleira Digital
cd /d "%~dp0"

echo ================================================
echo   OpenPedal - Iniciando Pedaleira Digital...
echo ================================================
echo.

powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient('127.0.0.1', 5173); $c.Close(); exit 0 } catch { exit 1 }"
if %errorlevel%==0 (
    echo OpenPedal ja esta rodando! Abrindo no navegador...
    start "" "http://localhost:5173"
    timeout /t 2 >nul
    exit /b 0
)

if not exist "node_modules" (
    echo Instalando dependencias pela primeira vez...
    call npm install
)

start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for ($i = 0; $i -lt 40; $i++) { try { $c = New-Object Net.Sockets.TcpClient('127.0.0.1', 5173); $c.Close(); Start-Process 'http://localhost:5173'; break } catch { Start-Sleep -Milliseconds 400 } }"

echo Servidor rodando em: http://localhost:5173
echo Mantenha esta janela aberta enquanto toca. Feche para encerrar.
echo.
call npm run dev -- --port 5173

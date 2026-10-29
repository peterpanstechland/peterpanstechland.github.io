$ErrorActionPreference = 'Stop'
$rpRoot = Split-Path -Parent $PSScriptRoot
$rpBuild = Join-Path $rpRoot 'build\tests'
New-Item -ItemType Directory -Path $rpBuild -Force | Out-Null
$rpVswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (-not (Test-Path -LiteralPath $rpVswhere)) { throw 'Install Visual Studio Build Tools with the C++ workload, or use the g++ command in tests/core/README.md.' }
$rpVisualStudio = & $rpVswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $rpVisualStudio) { throw 'C++ build tools were not found.' }
$rpDeveloperCmd = Join-Path $rpVisualStudio 'Common7\Tools\VsDevCmd.bat'
$rpTestSource = Join-Path $rpRoot 'tests\core\controller_test.cpp'
$rpBatch = Join-Path $rpBuild 'run-controller-tests.cmd'
$rpBatchContent = @"
@echo off
call "$rpDeveloperCmd" -no_logo -arch=x64
if errorlevel 1 exit /b 1
cd /d "$rpBuild"
cl.exe /nologo /std:c++17 /EHsc /utf-8 /W4 "$rpTestSource" /Fe:controller_test.exe
if errorlevel 1 exit /b 1
controller_test.exe
if errorlevel 1 exit /b 1
cl.exe /nologo /std:c++17 /EHsc /utf-8 /O2 "$rpRoot\tests\core\daily_ticket_test.cpp" /Fe:daily_ticket_test.exe
if errorlevel 1 exit /b 1
daily_ticket_test.exe
if errorlevel 1 exit /b 1
cl.exe /nologo /std:c++17 /EHsc /utf-8 /W4 "$rpRoot\tests\core\dht20_test.cpp" /Fe:dht20_test.exe
if errorlevel 1 exit /b 1
dht20_test.exe
if errorlevel 1 exit /b 1
cl.exe /nologo /std:c++17 /EHsc /utf-8 /W4 "$rpRoot\tests\core\sen54_tank_test.cpp" /Fe:sen54_tank_test.exe
if errorlevel 1 exit /b 1
sen54_tank_test.exe
if errorlevel 1 exit /b 1
cl.exe /nologo /std:c++17 /EHsc /utf-8 /W4 "$rpRoot\tests\core\companion_test.cpp" /Fe:companion_test.exe
if errorlevel 1 exit /b 1
companion_test.exe
if errorlevel 1 exit /b 1
cl.exe /nologo /std:c++17 /EHsc /utf-8 /W4 /I"$rpRoot\firmware\xiao\.pio\libdeps\xiao_robot_board\ArduinoJson\src" "$rpRoot\tests\core\sensor_calibration_test.cpp" /Fe:sensor_calibration_test.exe
if errorlevel 1 exit /b 1
sensor_calibration_test.exe
if errorlevel 1 exit /b 1
cl.exe /nologo /std:c++17 /EHsc /utf-8 /W4 /I"$rpRoot\firmware\xiao\.pio\libdeps\xiao_robot_board\ArduinoJson\src" "$rpRoot\tests\core\auto_light_test.cpp" /Fe:auto_light_test.exe
if errorlevel 1 exit /b 1
auto_light_test.exe
"@
Set-Content -LiteralPath $rpBatch -Value $rpBatchContent -Encoding ascii
& $env:ComSpec /d /c $rpBatch
if ($LASTEXITCODE -ne 0) { throw 'Controller tests failed.' }

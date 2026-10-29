$ErrorActionPreference = 'Stop'
$rpRoot = Split-Path -Parent $PSScriptRoot
$rpOutput = Join-Path $rpRoot 'tmp\settings-tests'
New-Item -ItemType Directory -Path $rpOutput -Force | Out-Null
$rpVswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$rpVs = & $rpVswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $rpVs) { throw 'Visual Studio C++ Build Tools are required.' }
$rpDev = Join-Path $rpVs 'Common7\Tools\VsDevCmd.bat'
$rpStubs = Join-Path $rpRoot 'tests\settings\stubs'
$rpInclude = Join-Path $rpRoot 'firmware\indicator\include'
$rpSource = Join-Path $rpRoot 'tests\settings\device_settings_test.cpp'
$rpNetworkSource = Join-Path $rpRoot 'tests\settings\planter_network_test.cpp'
$rpSettingsSource = Join-Path $rpRoot 'firmware\indicator\src\device_settings.cpp'
$rpJson = Join-Path $rpRoot 'firmware\indicator\.pio\libdeps\sensecap_indicator\ArduinoJson\src'
if (-not (Test-Path -LiteralPath (Join-Path $rpJson 'ArduinoJson.h'))) {
    throw 'Install the Indicator PlatformIO dependencies first; this host regression uses its actual ArduinoJson library.'
}
$rpBatch = Join-Path $rpOutput 'run.cmd'
@"
@echo off
call "$rpDev" -no_logo -arch=x64
if errorlevel 1 exit /b 1
cd /d "$rpOutput"
cl.exe /nologo /std:c++17 /EHsc /utf-8 /W4 /D_CRT_SECURE_NO_WARNINGS /I"$rpStubs" /I"$rpInclude" "$rpSource" /Fe:device_settings_test.exe
if errorlevel 1 exit /b 1
device_settings_test.exe
if errorlevel 1 exit /b 1
cl.exe /nologo /std:c++17 /EHsc /utf-8 /W4 /D_CRT_SECURE_NO_WARNINGS /I"$rpStubs" /I"$rpInclude" /I"$rpJson" "$rpNetworkSource" "$rpSettingsSource" /Fe:planter_network_test.exe
if errorlevel 1 exit /b 1
for %%S in (settings-mutex settings-queue client-mutex commands-queue stops-queue task stop-switch print sensors companion) do (
  planter_network_test.exe %%S
  if errorlevel 1 exit /b 1
)
"@ | Set-Content -LiteralPath $rpBatch -Encoding utf8
& $env:ComSpec /d /c $rpBatch
if ($LASTEXITCODE -ne 0) { throw 'Device settings checks failed.' }

param([string]$OutputDirectory = '')
$ErrorActionPreference = 'Stop'
$rpRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $rpRoot 'build\indicator-preview-v2\settings-host' }
$rpOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
$rpBuild = Join-Path $rpRoot 'build\tests\settings-ui'
New-Item -ItemType Directory -Path $rpBuild, $rpOutput -Force | Out-Null
$rpLibrary = Join-Path $rpRoot 'firmware\indicator\.pio\libdeps\sensecap_indicator\GFX Library for Arduino\src'
$rpVswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$rpVisualStudio = & $rpVswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $rpVisualStudio) { throw 'Visual Studio C++ Build Tools are required.' }
$rpDeveloperCmd = Join-Path $rpVisualStudio 'Common7\Tools\VsDevCmd.bat'
$rpStub = Join-Path $rpRoot 'tests\render\stubs'
$rpInclude = Join-Path $rpRoot 'firmware\indicator\include'
$rpSource = Join-Path $rpRoot 'tests\render\settings_ui_test.cpp'
$rpBatch = Join-Path $rpBuild 'settings-ui-tests.cmd'
$rpBatchContent = @"
@echo off
call "$rpDeveloperCmd" -no_logo -arch=x64
if errorlevel 1 exit /b 1
cd /d "$rpBuild"
cl.exe /nologo /std:c++17 /EHsc /utf-8 /O2 /W3 /D_CRT_SECURE_NO_WARNINGS /I"$rpStub" /I"$rpInclude" /I"$rpLibrary" "$rpSource" /Fe:settings_ui_test.exe
if errorlevel 1 exit /b 1
settings_ui_test.exe "$rpOutput"
"@
Set-Content -LiteralPath $rpBatch -Value $rpBatchContent -Encoding utf8
& $env:ComSpec /d /c $rpBatch
if ($LASTEXITCODE -ne 0) { throw 'Native settings UI tests failed.' }
Write-Output "Fixture-only native PPM previews: $rpOutput"

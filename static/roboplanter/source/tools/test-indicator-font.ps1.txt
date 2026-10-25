param([string]$Python = '')
$ErrorActionPreference = 'Stop'
$rpRoot = Split-Path -Parent $PSScriptRoot
$rpBuild = Join-Path $rpRoot 'build\tests\font'
New-Item -ItemType Directory -Path $rpBuild -Force | Out-Null
$rpLibrary = Join-Path $rpRoot 'firmware\indicator\.pio\libdeps\sensecap_indicator\GFX Library for Arduino\src'
if (-not (Test-Path -LiteralPath (Join-Path $rpLibrary 'Arduino_GFX.cpp'))) {
  throw 'Build firmware/indicator once to install its pinned Arduino_GFX dependency.'
}
if (-not $Python) {
  $Python = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
  if (-not (Test-Path -LiteralPath $Python)) { $Python = 'python' }
}
& $Python (Join-Path $rpRoot 'tests\test_indicator_font.py')
if ($LASTEXITCODE -ne 0) { throw 'Font generator regression tests failed.' }
$rpVswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$rpVisualStudio = & $rpVswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $rpVisualStudio) { throw 'Visual Studio C++ Build Tools are required.' }
$rpDeveloperCmd = Join-Path $rpVisualStudio 'Common7\Tools\VsDevCmd.bat'
$rpStub = Join-Path $rpRoot 'tests\render\stubs'
$rpInclude = Join-Path $rpRoot 'firmware\indicator\include'
$rpSource = Join-Path $rpRoot 'tests\render\indicator_font_test.cpp'
$rpBatch = Join-Path $rpBuild 'font-tests.cmd'
$rpBatchContent = @"
@echo off
call "$rpDeveloperCmd" -no_logo -arch=x64
if errorlevel 1 exit /b 1
cd /d "$rpBuild"
cl.exe /nologo /std:c++17 /EHsc /utf-8 /O2 /W3 /D_CRT_SECURE_NO_WARNINGS /I"$rpStub" /I"$rpInclude" /I"$rpLibrary" "$rpSource" /Fe:indicator_font_test.exe
if errorlevel 1 exit /b 1
indicator_font_test.exe
"@
Set-Content -LiteralPath $rpBatch -Value $rpBatchContent -Encoding utf8
& $env:ComSpec /d /c $rpBatch
if ($LASTEXITCODE -ne 0) { throw 'Native font rendering tests failed.' }

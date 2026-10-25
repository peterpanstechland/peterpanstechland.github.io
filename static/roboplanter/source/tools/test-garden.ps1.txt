$ErrorActionPreference = 'Stop'
$rpRoot = Split-Path -Parent $PSScriptRoot
$rpOutput = Join-Path $rpRoot 'tmp\garden-tests'
New-Item -ItemType Directory -Path $rpOutput -Force | Out-Null
$rpVswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$rpVs = & $rpVswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $rpVs) { throw 'Visual Studio C++ Build Tools are required.' }
$rpDev = Join-Path $rpVs 'Common7\Tools\VsDevCmd.bat'
$rpStubs = Join-Path $rpRoot 'tests\settings\stubs'
$rpInclude = Join-Path $rpRoot 'firmware\indicator\include'
$rpSource = Join-Path $rpRoot 'tests\garden_model_test.cpp'
$rpStore = Join-Path $rpRoot 'firmware\indicator\src\garden_store.cpp'
$rpBatch = Join-Path $rpOutput 'run.cmd'
@"
@echo off
call "$rpDev" -no_logo -arch=x64
if errorlevel 1 exit /b 1
cd /d "$rpOutput"
cl.exe /nologo /std:c++17 /EHsc /utf-8 /W4 /D_CRT_SECURE_NO_WARNINGS /I"$rpStubs" /I"$rpInclude" "$rpSource" "$rpStore" /Fe:garden_model_test.exe
if errorlevel 1 exit /b 1
for %%S in (normal loaded corrupt unavailable) do (
  garden_model_test.exe %%S
  if errorlevel 1 exit /b 1
)
"@ | Set-Content -LiteralPath $rpBatch -Encoding utf8
& $env:ComSpec /d /c $rpBatch
if ($LASTEXITCODE -ne 0) { throw 'Garden model and persistence checks failed.' }

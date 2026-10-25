param(
  [string]$Python = '',
  [string]$OutputDirectory = '',
  [switch]$CompileOnly
)
$ErrorActionPreference = 'Stop'
$rpRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $rpRoot 'build\indicator-preview-v3' }
$rpOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
if ($rpOutput.TrimEnd('\') -ieq (Join-Path $rpRoot 'build\indicator-preview') -or
    $rpOutput.TrimEnd('\') -ieq (Join-Path $rpRoot 'build\indicator-preview-v2')) {
  throw 'The deployed v1/v2 previews are preserved; choose build/indicator-preview-v3.'
}
$rpBuild = Join-Path $rpOutput 'native-build'
$rpFrames = Join-Path $rpOutput 'frames'
New-Item -ItemType Directory -Path $rpBuild, $rpFrames -Force | Out-Null
$rpLibrary = Join-Path $rpRoot 'firmware\indicator\.pio\libdeps\sensecap_indicator\GFX Library for Arduino\src'
if (-not (Test-Path -LiteralPath (Join-Path $rpLibrary 'Arduino_GFX.cpp'))) {
  throw 'Build firmware/indicator once with PlatformIO to install its pinned Arduino_GFX dependency.'
}
$rpVswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (-not (Test-Path -LiteralPath $rpVswhere)) { throw 'Visual Studio C++ Build Tools are required.' }
$rpVisualStudio = & $rpVswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $rpVisualStudio) { throw 'C++ Build Tools were not found.' }
$rpDeveloperCmd = Join-Path $rpVisualStudio 'Common7\Tools\VsDevCmd.bat'
$rpStub = Join-Path $rpRoot 'tests\render\stubs'
$rpInclude = Join-Path $rpRoot 'firmware\indicator\include'
$rpSource = Join-Path $rpRoot 'firmware\indicator\src'
$rpHarness = Join-Path $rpRoot 'tests\render\indicator_render.cpp'
$rpInputs = @($rpHarness) + @(Get-ChildItem -LiteralPath $rpSource, $rpInclude, $rpStub -File | Where-Object { $_.Extension -in '.cpp', '.h' } | ForEach-Object { $_.FullName })
$rpBefore = @{}
foreach ($rpInput in $rpInputs) { $rpBefore[$rpInput] = (Get-FileHash -LiteralPath $rpInput -Algorithm SHA256).Hash }
$rpBatch = Join-Path $rpBuild 'render.cmd'
$rpRenderCommand = if ($CompileOnly) { '' } else { 'indicator_render.exe "' + $rpFrames + '"' }
$rpBatchContent = @"
@echo off
call "$rpDeveloperCmd" -no_logo -arch=x64
if errorlevel 1 exit /b 1
cd /d "$rpBuild"
cl.exe /nologo /std:c++17 /EHsc /utf-8 /O2 /W3 /D_CRT_SECURE_NO_WARNINGS /I"$rpStub" /I"$rpInclude" /I"$rpLibrary" "$rpHarness" /Fe:indicator_render.exe
if errorlevel 1 exit /b 1
$rpRenderCommand
"@
Set-Content -LiteralPath $rpBatch -Value $rpBatchContent -Encoding utf8
& $env:ComSpec /d /c $rpBatch
if ($LASTEXITCODE -ne 0) { throw 'Native rendering failed.' }
foreach ($rpInput in $rpInputs) {
  if ((Get-FileHash -LiteralPath $rpInput -Algorithm SHA256).Hash -ne $rpBefore[$rpInput]) {
    throw "Source changed during rendering; rerun after edits finish: $rpInput"
  }
}
if ($CompileOnly) { Write-Output "Native preview compiler check passed: $rpBuild"; return }
if (-not $Python) {
  $rpBundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
  if (Test-Path -LiteralPath $rpBundledPython) { $Python = $rpBundledPython }
  elseif (Get-Command python -ErrorAction SilentlyContinue) { $Python = 'python' }
  else { throw 'Pass -Python with a Python executable that has Pillow installed. PPM captures are already available.' }
}
& $Python (Join-Path $PSScriptRoot 'render-indicator-ui.py') --output $rpOutput
if ($LASTEXITCODE -ne 0) { throw 'PNG/GIF conversion failed; PPM captures remain available.' }
Write-Output "Actual firmware preview: $rpOutput"

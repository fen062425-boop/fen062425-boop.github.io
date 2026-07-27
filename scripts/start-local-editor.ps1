[CmdletBinding()]
param(
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDirectory = Split-Path -Parent $scriptDirectory
$editorUrl = "http://localhost:3000/editor"
$vinextCommand = Join-Path $projectDirectory "node_modules\.bin\vinext.cmd"

function Test-EditorReady {
  try {
    $response = Invoke-WebRequest `
      -UseBasicParsing `
      -Uri $editorUrl `
      -TimeoutSec 3

    return (
      $response.StatusCode -ge 200 -and
      $response.StatusCode -lt 500 -and
      $response.Content -match "Local visual editor"
    )
  }
  catch {
    return $false
  }
}

function Test-EditorPortInUse {
  $client = New-Object System.Net.Sockets.TcpClient

  try {
    $connectTask = $client.ConnectAsync("localhost", 3000)
    return $connectTask.Wait(500) -and $client.Connected
  }
  catch {
    return $false
  }
  finally {
    $client.Dispose()
  }
}

function Stop-StartedServer {
  param(
    [System.Diagnostics.Process]$Process
  )

  if ($null -ne $Process -and -not $Process.HasExited) {
    & taskkill.exe /PID $Process.Id /T /F | Out-Null
  }
}

if (-not (Test-EditorReady)) {
  if (Test-EditorPortInUse) {
    throw "Port 3000 is already used by another service."
  }

  if (-not (Test-Path -LiteralPath $vinextCommand -PathType Leaf)) {
    throw "Project dependencies are missing. Run pnpm.cmd install first."
  }

  $serverArguments = @(
    "/d"
    "/c"
    "call"
    "`"$vinextCommand`""
    "dev"
    "--port"
    "3000"
  )

  $serverProcess = $null

  try {
    $serverProcess = Start-Process `
      -FilePath $env:ComSpec `
      -ArgumentList $serverArguments `
      -WorkingDirectory $projectDirectory `
      -WindowStyle Hidden `
      -PassThru

    $startupDeadline = (Get-Date).AddSeconds(90)

    while ((Get-Date) -lt $startupDeadline) {
      Start-Sleep -Milliseconds 500

      if ($serverProcess.HasExited) {
        throw "The local editor server exited before it became ready."
      }

      if (Test-EditorReady) {
        break
      }
    }

    if (-not (Test-EditorReady)) {
      throw "Timed out waiting for the local editor at $editorUrl."
    }
  }
  catch {
    Stop-StartedServer -Process $serverProcess
    throw
  }
}

if (-not $NoBrowser) {
  Start-Process -FilePath $editorUrl
}

Write-Output "Local editor ready: $editorUrl"

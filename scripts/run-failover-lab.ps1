$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repositoryRoot
$stoppedMember = $null

try {
    & docker compose --profile tools up -d mongo1 mongo2 mongo3 app
    if ($LASTEXITCODE -ne 0) {
        throw "Could not start Docker Compose services. Is Docker Desktop running?"
    }

    & docker compose exec -T app node scripts/init-replica-set.js
    if ($LASTEXITCODE -ne 0) {
        throw "Could not initialize or verify replica set rs0."
    }

    $experimentLines = & docker compose exec -T app node scripts/experiment.js
    if ($LASTEXITCODE -ne 0) {
        throw "Could not complete the w:1 and majority write tests."
    }
    $experiment = ($experimentLines -join "`n") | ConvertFrom-Json
    $stoppedMember = ($experiment.primaryBeforeFailover -split ":")[0]
    if ($stoppedMember -notin @("mongo1", "mongo2", "mongo3")) {
        throw "Unexpected primary member hostname: $($experiment.primaryBeforeFailover)"
    }

    $electionTimer = [System.Diagnostics.Stopwatch]::StartNew()
    & docker compose stop $stoppedMember | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Could not stop the primary member $stoppedMember."
    }

    $electionLines = & docker compose exec -T app node scripts/wait-election.js $experiment.primaryBeforeFailover
    if ($LASTEXITCODE -ne 0) {
        throw "A new primary was not elected within 60 seconds."
    }
    $electionTimer.Stop()
    $election = ($electionLines -join "`n") | ConvertFrom-Json

    $result = [ordered]@{
        runId = $experiment.runId
        primaryStopped = $experiment.primaryBeforeFailover
        primaryElected = $election.primaryAfterElection
        electionTimeMs = [math]::Round($electionTimer.Elapsed.TotalMilliseconds, 2)
        writes = $experiment.writes
        observedAt = (Get-Date).ToString("o")
    }

    $resultsDirectory = Join-Path $repositoryRoot "results"
    New-Item -ItemType Directory -Path $resultsDirectory -Force | Out-Null
    $resultPath = Join-Path $resultsDirectory "latest.json"
    $result | ConvertTo-Json -Depth 8 | Set-Content -Path $resultPath -Encoding utf8
    Write-Output ($result | ConvertTo-Json -Depth 8)
    Write-Output "Saved measured results to $resultPath"
}
finally {
    if ($stoppedMember) {
        & docker compose start $stoppedMember | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Could not restart $stoppedMember. Start it with: docker compose start $stoppedMember"
        }
    }
    Pop-Location
}

param(
  [Parameter(Mandatory = $true)][string]$RequestPath,
  [Parameter(Mandatory = $true)][string]$OutputDir
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-Git {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)
  $output = & git @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed:`n$($output -join "`n")"
  }
  return (($output -join "`n").Trim())
}

function Resolve-GitRef {
  param([Parameter(Mandatory = $true)][string]$Ref)

  foreach ($candidate in @($Ref, "origin/$Ref")) {
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
      $output = & git rev-parse --verify "$candidate^{commit}" 2>$null
      $exitCode = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $previousPreference
    }

    if ($exitCode -eq 0 -and $output) {
      return ($output | Select-Object -First 1).Trim()
    }
  }

  throw "Could not resolve Git ref '$Ref'."
}

function Limit-Text {
  param([AllowNull()][string]$Text, [int]$MaxChars = 60000)
  if ($null -eq $Text) { return '' }
  if ($Text.Length -le $MaxChars) { return $Text }
  return $Text.Substring(0, $MaxChars) + "`n[TRUNCATED BY NIGHT WATCH]"
}

function Ensure-Ollama {
  try {
    return Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -Method Get -TimeoutSec 5
  } catch {
    $ollamaCommand = Get-Command ollama -ErrorAction SilentlyContinue
    $candidatePaths = @(
      $(if ($ollamaCommand) { $ollamaCommand.Source } else { $null }),
      'C:\Users\Chandler\AppData\Local\Programs\Ollama\ollama.exe',
      'C:\Program Files\Ollama\ollama.exe'
    ) | Where-Object { $_ } | Select-Object -Unique

    $ollamaPath = $candidatePaths |
      Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
      Select-Object -First 1

    if (-not $ollamaPath) {
      throw "Ollama server is not running and ollama.exe was not found. Checked: $($candidatePaths -join ', ')"
    }

    $defaultModels = 'C:\Users\Chandler\.ollama\models'
    if (-not $env:OLLAMA_MODELS -and (Test-Path -LiteralPath $defaultModels -PathType Container)) {
      $env:OLLAMA_MODELS = $defaultModels
    }

    Start-Process -FilePath $ollamaPath -ArgumentList 'serve' -WindowStyle Hidden

    $lastError = $null
    for ($attempt = 1; $attempt -le 10; $attempt += 1) {
      Start-Sleep -Seconds 2
      try {
        return Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -Method Get -TimeoutSec 5
      } catch {
        $lastError = $_
      }
    }

    throw "Ollama executable was found at '$ollamaPath' but its API did not become ready: $($lastError.Exception.Message)"
  }
}

function Invoke-OllamaChat {
  param(
    [Parameter(Mandatory = $true)][string]$Model,
    [Parameter(Mandatory = $true)][string]$SystemPrompt,
    [Parameter(Mandatory = $true)][string]$UserPrompt,
    [bool]$JsonMode = $false
  )

  $payloadObject = @{
    model = $Model
    stream = $false
    think = $false
    options = @{ temperature = 0.05; num_predict = 4096 }
    messages = @(
      @{ role = 'system'; content = $SystemPrompt },
      @{ role = 'user'; content = $UserPrompt }
    )
  }
  if ($JsonMode) {
    $payloadObject.format = 'json'
  }

  $payloadJson = $payloadObject | ConvertTo-Json -Depth 20 -Compress

  # Validate locally first, then send explicit UTF-8 bytes. Windows PowerShell
  # 5.1 can otherwise apply legacy request-body encoding semantics to strings.
  try {
    $null = $payloadJson | ConvertFrom-Json
  } catch {
    throw "Night Watch generated invalid Ollama JSON before transport: $($_.Exception.Message)"
  }
  $payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($payloadJson)

  $lastError = $null
  for ($attempt = 1; $attempt -le 2; $attempt += 1) {
    try {
      $response = Invoke-RestMethod `
        -Uri 'http://127.0.0.1:11434/api/chat' `
        -Method Post `
        -ContentType 'application/json; charset=utf-8' `
        -Body $payloadBytes `
        -TimeoutSec 900

      $content = [string]$response.message.content
      if ([string]::IsNullOrWhiteSpace($content)) {
        throw "Ollama model '$Model' returned an empty response."
      }
      return $content.Trim()
    } catch {
      $lastError = $_
      if ($attempt -lt 2) {
        Start-Sleep -Seconds 2
        continue
      }
    }
  }

  throw "Ollama model '$Model' failed after 2 attempts: $($lastError.Exception.Message)"
}

function Convert-CriticJson {
  param([Parameter(Mandatory = $true)][string]$Text)

  try {
    $parsed = $Text | ConvertFrom-Json
  } catch {
    throw "Night Watch critic returned malformed JSON: $($_.Exception.Message)"
  }

  if ($null -eq $parsed) {
    throw 'Night Watch critic returned JSON null instead of an object.'
  }

  $topLevelNames = @($parsed.PSObject.Properties.Name)
  if ($topLevelNames.Count -ne 1 -or $topLevelNames[0] -ne 'findings') {
    throw "Night Watch critic JSON must contain exactly one top-level property named 'findings'."
  }

  $required = @(
    'severity',
    'location',
    'issue',
    'invariant',
    'reachability',
    'failure_scenario',
    'evidence',
    'fix'
  )
  $allowedSeverity = @('BLOCKER', 'HIGH', 'MEDIUM', 'LOW')
  $normalized = @()

  foreach ($finding in @($parsed.findings)) {
    if ($null -eq $finding) {
      throw 'Night Watch critic returned a null finding.'
    }

    $names = @($finding.PSObject.Properties.Name)
    foreach ($field in $required) {
      if ($field -notin $names) {
        throw "Night Watch critic finding is missing required field '$field'."
      }
      $value = [string]$finding.$field
      if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Night Watch critic finding field '$field' is empty."
      }
    }

    $extras = @($names | Where-Object { $_ -notin $required })
    if ($extras.Count -gt 0) {
      throw "Night Watch critic finding contains unsupported fields: $($extras -join ', ')"
    }

    $severity = ([string]$finding.severity).ToUpperInvariant()
    if ($severity -notin $allowedSeverity) {
      throw "Night Watch critic returned invalid severity '$severity'."
    }

    $normalized += [pscustomobject][ordered]@{
      severity = $severity
      location = [string]$finding.location
      issue = [string]$finding.issue
      invariant = [string]$finding.invariant
      reachability = [string]$finding.reachability
      failure_scenario = [string]$finding.failure_scenario
      evidence = [string]$finding.evidence
      fix = [string]$finding.fix
    }
  }

  return $normalized
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
$request = Get-Content -Raw -Path $RequestPath | ConvertFrom-Json
$targetRef = [string]$request.target_ref
$baseRef = [string]$request.base_ref
$profile = if ($request.review_profile) { [string]$request.review_profile } else { 'defensive' }
$primaryModel = if ($request.model) { [string]$request.model } else { 'qwen3.5:9b' }
$requestedCritic = if ($request.critic_model) { [string]$request.critic_model } else { 'auto' }

if ([string]::IsNullOrWhiteSpace($targetRef)) { throw 'target_ref is required.' }
if ([string]::IsNullOrWhiteSpace($baseRef)) { throw 'base_ref is required.' }

git config --global --add safe.directory "$PWD" | Out-Null
$baseSha = Resolve-GitRef -Ref $baseRef
$headSha = Resolve-GitRef -Ref $targetRef
$mergeBase = Invoke-Git -Arguments @('merge-base', $baseSha, $headSha)

$changedFilesRaw = Invoke-Git -Arguments @('diff', '--name-only', "$mergeBase..$headSha", '--')
$changedFiles = @(
  $changedFilesRaw -split "`n" |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ }
)

$reviewableExtensions = @(
  '.c', '.cc', '.cpp', '.cxx', '.h', '.hh', '.hpp', '.hxx',
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.py', '.ps1', '.psm1', '.cs', '.rs', '.go', '.java', '.kt',
  '.html', '.htm', '.json', '.yml', '.yaml', '.toml', '.ini',
  '.cfg', '.cmake'
)
$reviewFiles = @(
  $changedFiles | Where-Object {
    $extension = [System.IO.Path]::GetExtension($_).ToLowerInvariant()
    $reviewableExtensions -contains $extension
  }
)

$tags = Ensure-Ollama
$availableModels = @($tags.models | ForEach-Object { [string]$_.name })
if ($primaryModel -notin $availableModels) {
  throw "Primary Night Watch model '$primaryModel' is not installed. Installed: $($availableModels -join ', ')"
}

$criticModel = $primaryModel
if ($requestedCritic -and $requestedCritic -ne 'auto') {
  if ($requestedCritic -in $availableModels) { $criticModel = $requestedCritic }
} elseif ('qwen2.5-coder:7b-instruct' -in $availableModels) {
  $criticModel = 'qwen2.5-coder:7b-instruct'
}

$systemPrompt = @"
You are InfoMancer | Night Watch, a defensive engineering code reviewer for the InfoMancer.

EVIDENCE STANDARD:
- Review only the supplied diff and current-file excerpt. Do not invent hidden code, logging, serialization, threading, API behavior, or callers.
- Report a finding only when the supplied evidence demonstrates both a concrete defect and a reachable path to that defect.
- Do not report generic language/runtime caveats unless the supplied code actually makes them reachable.
- Do not call intentional fail-closed behavior a defect.
- Do not infer credential leakage merely because a credential exists in a structure. Show the exact supplied path that copies or emits it to an untrusted boundary.
- Do not infer races without showing the competing operations and shared state from supplied evidence.
- Tests, comments, or documentation can support a finding but cannot substitute for executable evidence.
- If evidence is incomplete or you are uncertain, output NO FINDINGS.

Prioritize authentication/authorization bypasses, trust-boundary failures, credential leakage, stale or incorrectly reusable analysis artifacts, race conditions, SQLite transaction/snapshot errors, retry/idempotency failures, fail-open behavior, media-path mistakes, destructive file operations, packaging/update/uninstall regressions, FFmpeg/OCR provenance failures, worker lease errors, input validation, resource leaks, and meaningful test gaps.

InfoMancer invariants:
- Source media is read-only unless the user explicitly authorizes a concrete file operation; analysis, verification, correlation, and review paths never rename, move, delete, remux, or transcode media.
- Episode Identity confirmation and rename authority comes only from the current reviewed per-file resolver state, exact revision/decision digest, and validated candidate. Deep correlation is advisory and cannot independently grant authority.
- Persisted Fast, Normal, and Deep evidence is reusable only while every bound media snapshot, provider/source signature, algorithm/configuration version, artifact seal, and publication revision remains current.
- A stale, malformed, ambiguous, unsupported, or partially verified persisted artifact fails closed and cannot silently fall through to a stronger conclusion.
- Cross-file correlation must not inflate confidence by counting reused, derived, or correlated observations as independent evidence.
- Database migrations and semantic publication changes are transactional, versioned, and recoverable; partial writes must not become current state.
- Provider credentials, bearer tokens, encryption keys, and local secrets never cross into untrusted payloads, logs, URLs, review artifacts, or exported package metadata.
- Retried jobs, worker leases, provider requests, and publication steps must not execute destructive or state-changing work twice.
- Updaters preserve user data. Normal uninstall removes only InfoMancer-owned state and never deletes source media or user-selected recovery packages.
- Native packages must preserve the declared platform compatibility floor and must not be promoted from a weaker self-hosted preview baseline without explicit qualification.

Severity:
- BLOCKER: demonstrated path to unauthorized Program output, credential disclosure, destructive corruption, or a release-stopping security boundary failure.
- HIGH: demonstrated security/correctness defect with serious operational impact.
- MEDIUM: demonstrated defect with bounded impact or a realistic failure mode.
- LOW: demonstrated minor correctness/robustness problem. Never use LOW for style.

For every actionable finding output exactly this field order:
SEVERITY: BLOCKER | HIGH | MEDIUM | LOW
LOCATION: file and closest hunk/function
ISSUE: concise title
INVARIANT: exact InfoMancer invariant or concrete correctness property violated
REACHABILITY: ordered call/data/state path that reaches the failure
FAILURE SCENARIO: concrete reproducible failure
EVIDENCE: exact supplied code/diff evidence
FIX: specific remediation

Do not add headings, summaries, recommendations, or speculative prose outside finding blocks.
If there are no actionable findings, write exactly: NO FINDINGS
"@

$reviewSections = New-Object System.Collections.Generic.List[string]
$reviewSections.Add("# InfoMancer | Night Watch")
$reviewSections.Add("")
$reviewSections.Add("Repository: $($env:GITHUB_REPOSITORY)")
$reviewSections.Add("Profile: $profile")
$reviewSections.Add("Base: $baseSha")
$reviewSections.Add("Head: $headSha")
$reviewSections.Add("Merge base: $mergeBase")
$reviewSections.Add("Primary model: $primaryModel")
$reviewSections.Add("Critic model: $criticModel")
$reviewSections.Add("Changed files: $($changedFiles.Count)")
$reviewSections.Add("Reviewable executable/config files: $($reviewFiles.Count)")
$reviewSections.Add("")

$primaryFindings = New-Object System.Collections.Generic.List[string]
$criticJson = '{"findings":[]}'
$finalFindings = @()

if ($reviewFiles.Count -gt 0) {
  $combinedArgs = @('diff', '--no-ext-diff', '--unified=20', "$mergeBase..$headSha", '--') + $reviewFiles
  $combinedDiff = Limit-Text -Text (Invoke-Git -Arguments $combinedArgs) -MaxChars 70000
} else {
  $combinedDiff = ''
}

if ($changedFiles.Count -eq 0) {
  $reviewSections.Add("## Result")
  $reviewSections.Add("")
  $reviewSections.Add("No changed files between the requested base and head.")
} elseif ($reviewFiles.Count -eq 0) {
  $reviewSections.Add("## Result")
  $reviewSections.Add("")
  $reviewSections.Add("No executable/configuration files changed. Documentation-only changes were not sent to the defect reviewer.")
} else {
  foreach ($file in $reviewFiles) {
    $reviewSections.Add("## File: $file")
    $reviewSections.Add("")

    $diff = Limit-Text -Text (Invoke-Git -Arguments @('diff', '--no-ext-diff', '--unified=60', "$mergeBase..$headSha", '--', $file)) -MaxChars 65000
    $currentExcerpt = ''
    if (Test-Path -LiteralPath $file -PathType Leaf) {
      try {
        $currentExcerpt = Limit-Text -Text (Get-Content -Raw -LiteralPath $file -ErrorAction Stop) -MaxChars 30000
      } catch {
        $currentExcerpt = '[Current file content unavailable or non-text.]'
      }
    }

    $userPrompt = @"
Repository: $($env:GITHUB_REPOSITORY)
Base SHA: $baseSha
Head SHA: $headSha
Review profile: $profile
File: $file

DIFF:
$diff

CURRENT FILE EXCERPT:
$currentExcerpt

Review this file in the context of the InfoMancer invariants. Report only evidence-backed, reachable defects introduced or exposed by the change. If the supplied evidence does not prove a defect, output NO FINDINGS.
"@

    $finding = Invoke-OllamaChat -Model $primaryModel -SystemPrompt $systemPrompt -UserPrompt $userPrompt
    $primaryFindings.Add("### $file`n`n$finding")
    $reviewSections.Add($finding)
    $reviewSections.Add("")
  }

  $criticSystem = @"
You are the final adjudicator for InfoMancer | Night Watch.

Independently verify every first-pass claim against the supplied cross-file diff. Silently discard any claim that depends on code not shown, hypothetical logging/serialization/callers, generic language caveats, or an unproven race/reachability path.

Also look for cross-file defects the first pass missed.

Return JSON only. The root object must contain exactly one property named "findings".
"findings" must be an array. If nothing survives adjudication and there is no additional demonstrated defect, return:
{"findings":[]}

Each finding object must contain exactly these string fields:
- severity: BLOCKER, HIGH, MEDIUM, or LOW
- location: file and closest hunk/function
- issue: concise title
- invariant: exact InfoMancer invariant or concrete correctness property violated
- reachability: ordered call/data/state path that reaches the failure
- failure_scenario: concrete reproducible failure
- evidence: exact supplied code/diff evidence
- fix: specific remediation

Do not include markdown, commentary, recommendations, confidence scores, rejected findings, or any keys other than the schema above.
"@

  $criticPrompt = @"
Repository: $($env:GITHUB_REPOSITORY)
Base SHA: $baseSha
Head SHA: $headSha

CHANGED FILES:
$($changedFiles -join "`n")

FIRST-PASS FINDINGS:
$(Limit-Text -Text ($primaryFindings -join "`n`n") -MaxChars 45000)

CROSS-FILE DIFF:
$combinedDiff

Perform an adversarial second pass across the complete change.
"@

  $criticJson = Invoke-OllamaChat -Model $criticModel -SystemPrompt $criticSystem -UserPrompt $criticPrompt -JsonMode $true
  $finalFindings = @(Convert-CriticJson -Text $criticJson)

  $reviewSections.Add("## Final adjudicated findings")
  $reviewSections.Add("")
  if ($finalFindings.Count -eq 0) {
    $reviewSections.Add("NO FINDINGS")
    $reviewSections.Add("")
  } else {
    foreach ($item in $finalFindings) {
      $reviewSections.Add("### [$($item.severity)] $($item.issue)")
      $reviewSections.Add("")
      $reviewSections.Add("**Location:** $($item.location)")
      $reviewSections.Add("")
      $reviewSections.Add("**Invariant:** $($item.invariant)")
      $reviewSections.Add("")
      $reviewSections.Add("**Reachability:** $($item.reachability)")
      $reviewSections.Add("")
      $reviewSections.Add("**Failure scenario:** $($item.failure_scenario)")
      $reviewSections.Add("")
      $reviewSections.Add("**Evidence:** $($item.evidence)")
      $reviewSections.Add("")
      $reviewSections.Add("**Fix:** $($item.fix)")
      $reviewSections.Add("")
    }
  }
}

$severityCounts = [ordered]@{
  BLOCKER = @($finalFindings | Where-Object severity -eq 'BLOCKER').Count
  HIGH = @($finalFindings | Where-Object severity -eq 'HIGH').Count
  MEDIUM = @($finalFindings | Where-Object severity -eq 'MEDIUM').Count
  LOW = @($finalFindings | Where-Object severity -eq 'LOW').Count
}
$findingSummary = [ordered]@{
  repository = $env:GITHUB_REPOSITORY
  request_id = [string]$request.request_id
  base_sha = $baseSha
  head_sha = $headSha
  primary_model = $primaryModel
  critic_model = $criticModel
  total = $finalFindings.Count
  severity_counts = $severityCounts
  findings = $finalFindings
}
$findingSummary | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $OutputDir 'night-watch-findings.json') -Encoding UTF8

$reportPath = Join-Path $OutputDir 'NIGHT_WATCH_REVIEW.md'
$reviewSections -join "`n" | Set-Content -Path $reportPath -Encoding UTF8

$metadata = [ordered]@{
  repository = $env:GITHUB_REPOSITORY
  request_id = [string]$request.request_id
  review_profile = $profile
  requested_target_ref = $targetRef
  requested_base_ref = $baseRef
  base_sha = $baseSha
  head_sha = $headSha
  merge_base_sha = $mergeBase
  primary_model = $primaryModel
  critic_model = $criticModel
  changed_files = $changedFiles
  generated_at_utc = [DateTime]::UtcNow.ToString('o')
}
$metadata | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $OutputDir 'night-watch-metadata.json') -Encoding UTF8

if ($env:GITHUB_STEP_SUMMARY) {
  Get-Content -Raw -Path $reportPath | Add-Content -Path $env:GITHUB_STEP_SUMMARY -Encoding UTF8
}

Write-Host "Night Watch completed."
Write-Host "Primary model: $primaryModel"
Write-Host "Critic model: $criticModel"
Write-Host "Base: $baseSha"
Write-Host "Head: $headSha"
Write-Host "Changed files: $($changedFiles.Count)"
Write-Host "Report: $reportPath"

# PowerShell script to integrate input.js module
# This script makes all necessary changes to index.html for full input module integration

$indexPath = "C:\Users\itsju\Documents\L4-dar-prototype\docs\index.html"
$backupPath = "C:\Users\itsju\Documents\L4-dar-prototype\docs\index.html.backup-input-integration"

# Create backup
Write-Host "Creating backup..."
Copy-Item $indexPath $backupPath -Force

# Read the file
Write-Host "Reading index.html..."
$content = Get-Content $indexPath -Raw

# Count original lines
$originalLines = ($content -split "`n").Length
Write-Host "Original line count: $originalLines"

# Step 1: Replace all input variable references
Write-Host "Replacing input variable references..."

# joyVec references (careful with .x and .y)
$content = $content -replace '\bjoyVec\.x\b', 'Input.getJoyVec().x'
$content = $content -replace '\bjoyVec\.y\b', 'Input.getJoyVec().y'
$content = $content -replace '\bjoyVec\b(?!\.)', 'Input.getJoyVec()'

# darOn references
$content = $content -replace '\bdarOn\b', 'Input.getDarOn()'

# airRoll references
$content = $content -replace '\bairRoll\b', 'Input.getAirRoll()'

# lastActiveAirRoll references
$content = $content -replace '\blastActiveAirRoll\b', 'Input.getLastActiveAirRoll()'

# airRollIsToggle references
$content = $content -replace '\bairRollIsToggle\b', 'Input.getAirRollIsToggle()'

# Position references
$content = $content -replace '\bJOY_CENTER\.x\b', 'Input.getJoyCenter().x'
$content = $content -replace '\bJOY_CENTER\.y\b', 'Input.getJoyCenter().y'
$content = $content -replace '\bJOY_CENTER\b(?!\.)', 'Input.getJoyCenter()'

$content = $content -replace '\bJOY_BASE_R\b', 'Input.getJoyBaseR()'
$content = $content -replace '\bJOY_KNOB_R\b', 'Input.getJoyKnobR()'

$content = $content -replace '\bDAR_CENTER\.x\b', 'Input.getDarCenter().x'
$content = $content -replace '\bDAR_CENTER\.y\b', 'Input.getDarCenter().y'
$content = $content -replace '\bDAR_CENTER\b(?!\.)', 'Input.getDarCenter()'
$content = $content -replace '\bDAR_R\b', 'Input.getDarR()'

$content = $content -replace '\bBOOST_CENTER\.x\b', 'Input.getBoostCenter().x'
$content = $content -replace '\bBOOST_CENTER\.y\b', 'Input.getBoostCenter().y'
$content = $content -replace '\bBOOST_CENTER\b(?!\.)', 'Input.getBoostCenter()'
$content = $content -replace '\bBOOST_R\b', 'Input.getBoostR()'

# Boolean flags
$content = $content -replace '\bshowBoostButton\b', 'Input.getShowBoostButton()'
$content = $content -replace '\bringModeBoostActive\b', 'Input.getRingModeBoostActive()'

# Device detection
$content = $content -replace '\bisMobile\b', 'Input.getIsMobile()'

# Gamepad references
$content = $content -replace '\bgpEnabled\b', 'Input.getGpEnabled()'
$content = $content -replace '\bgpBindings\b', 'Input.getGpBindings()'

# chromeShown - needs special handling, will keep for now

# smJoy references
$content = $content -replace '\bsmJoy\.x\b', 'Input.getJoyVec().x'
$content = $content -replace '\bsmJoy\.y\b', 'Input.getJoyVec().y'
$content = $content -replace '\bsmJoy\b(?!\.)', 'Input.getJoyVec()'

# STICK_TAU_MS, STICK_MIN, STICK_DEADZONE
$content = $content -replace '\bSTICK_TAU_MS\b', 'Input.STICK_DEADZONE'
$content = $content -replace '\bSTICK_MIN\b', '0.02'
$content = $content -replace '\bSTICK_DEADZONE\b', 'Input.STICK_DEADZONE'

# Write the modified content
Write-Host "Writing changes..."
$content | Set-Content $indexPath -NoNewline

# Count new lines
$newContent = Get-Content $indexPath -Raw
$newLines = ($newContent -split "`n").Length
$removed = $originalLines - $newLines

Write-Host "==================================="
Write-Host "Integration complete!"
Write-Host "Original lines: $originalLines"
Write-Host "New lines: $newLines"
Write-Host "Lines changed/replaced: references updated"
Write-Host "Backup saved to: $backupPath"
Write-Host "==================================="
Write-Host ""
Write-Host "NEXT STEPS (manual):"
Write-Host "1. Remove gamepad code section (lines ~2081-2700)"
Write-Host "2. Remove air roll helper functions"
Write-Host "3. Remove keyboard state variables and event listeners"
Write-Host "4. Add Input.initInput() call"
Write-Host "5. Add Input.updateInput(dt) in tick() function"
Write-Host "6. Update resize handler to call Input.handleResize()"
Write-Host "7. Test the application"

param(
  [switch]$Remove
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Write-Output "Scanning $root for non-backend items..."

$keep = @('backend', '.git', '.github', 'README.md', 'LICENSE')
$items = Get-ChildItem -Force -LiteralPath $root

foreach ($item in $items) {
  if ($keep -contains $item.Name) { continue }
  if (-not $Remove) {
    Write-Output "Would remove: $($item.FullName)"
  } else {
    try {
      Remove-Item -LiteralPath $item.FullName -Recurse -Force -ErrorAction Stop
      Write-Output "Removed: $($item.FullName)"
    } catch {
      Write-Error "Failed to remove $($item.FullName): $_"
    }
  }
}

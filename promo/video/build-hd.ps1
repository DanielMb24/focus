# Genere promo/focus-promo-hd.mp4 (1920x1080, ~30s, muet) — pendant horizontal de build.ps1.
# Textes pre-rendus en PNG via .NET puis composes avec fondus dans ffmpeg.
$FF = "$env:LOCALAPPDATA\Programs\ffmpeg\ffmpeg.exe"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent (Split-Path -Parent $here)
$tmp = Join-Path $env:TEMP "focus-video-hd"
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
Add-Type -AssemblyName System.Drawing

$W = 1920; $H = 1080; $DUR = 5

function Render-Text($name, $lines, $size, $bold, $colorHex) {
  $style = if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
  $font = New-Object System.Drawing.Font("Segoe UI", $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
  $probe = New-Object System.Drawing.Bitmap(10, 10)
  $g = [System.Drawing.Graphics]::FromImage($probe)
  $widths = @()
  $lh = $font.Height * 1.28
  foreach ($ln in $lines) { $widths += $g.MeasureString($ln, $font).Width }
  $g.Dispose(); $probe.Dispose()
  $w = [Math]::Min(1700, [Math]::Ceiling(($widths | Measure-Object -Maximum).Maximum) + 30)
  $h = [Math]::Ceiling($lh * $lines.Count) + 20
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $gg = [System.Drawing.Graphics]::FromImage($bmp)
  $gg.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $br = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($colorHex))
  $y = 10
  foreach ($ln in $lines) {
    $sw = $gg.MeasureString($ln, $font).Width
    $gg.DrawString($ln, $font, $br, ($w - $sw) / 2, $y)
    $y += $lh
  }
  $gg.Dispose(); $br.Dispose(); $font.Dispose()
  $out = Join-Path $tmp ($name + ".png")
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  return @{ file = $out; w = $w }
}

function Scene($n, $bg1, $bg2, $logoPath, $logoY, $logoSize, $texts) {
  # Virgule décimale : ffmpeg exige le point même en locale FR.
  $fout = [string]::Format([Globalization.CultureInfo]::InvariantCulture, "{0:0.0}", ($DUR - 0.5))
  $inputs = @("-f", "lavfi", "-i", "color=c=0x000000:s=${W}x${H}:r=30:d=0.01")
  $i = 1
  $chain = "gradients=s=${W}x${H}:speed=0:c0=${bg1}:c1=${bg2}:x0=0:y0=0:x1=${W}:y1=${H},format=yuv420p[bg]"
  $prev = "[bg]"
  $overlays = @()
  if ($logoPath) {
    $inputs += @("-loop", "1", "-framerate", "30", "-t", $DUR, "-i", $logoPath)
    $logoXc = [int](($W - $logoSize) / 2)
    $overlays += @{ idx = $i; x = $logoXc; y = $logoY; start = 0.1; size = $logoSize; logo = $true }; $i++
  }
  foreach ($t in $texts) {
    $inputs += @("-loop", "1", "-framerate", "30", "-t", $DUR, "-i", $t.png)
    $overlays += @{ idx = $i; x = $t.x; y = $t.y; start = $t.start }; $i++
  }
  $fc = $chain
  $k = 0
  foreach ($o in $overlays) {
    $lbl = "o$k"
    if ($o.logo) {
      $fc += ";[$($o.idx):v]scale=$($o.size):-1,format=rgba,fade=t=in:st=$($o.start):d=0.5:alpha=1,fade=t=out:st=${fout}:d=0.5:alpha=1[tx$k]"
    } else {
      $fc += ";[$($o.idx):v]format=rgba,fade=t=in:st=$($o.start):d=0.4:alpha=1,fade=t=out:st=${fout}:d=0.4:alpha=1[tx$k]"
    }
    $fc += ";$prev[tx$k]overlay=$($o.x):$($o.y):format=yuv420[o$k]"
    $prev = "[o$k]"
    $k++
  }
  $fc += ";${prev}fade=t=in:st=0:d=0.5,fade=t=out:st=${fout}:d=0.5,format=yuv420p[v]"
  $out = Join-Path $tmp ("seg$($n).mp4")
  & $FF -y -v error @inputs -filter_complex $fc -map "[v]" -t $DUR -r 30 -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p $out
  if ($LASTEXITCODE -ne 0) { throw "scene $n failed" }
}

function Txt($name, $lines, $size, $bold, $color, $y, $start) {
  $r = Render-Text $name $lines $size $bold $color
  return @{ png = $r.file; x = [Math]::Max(0, [int](($W - $r.w) / 2)); y = $y; start = $start }
}

$WT = "#FFFFFF"; $LB = "#BCD0FF"; $KB = "#8FB0FF"
$logoPng = Join-Path $root "client\assets\icon.png"
$logoX = [int](($W - 280) / 2)

# Scene 0 : logo + titre
Scene 0 "0x1d4ed8" "0x0f1e5b" $logoPng 180 280 @(
  (Txt "h0a" @("Focus") 120 $true $WT 500 0.3),
  (Txt "h0b" @("Votre journée, enfin lisible.") 52 $false $LB 690 0.9)
)
# Scenes 1..4 : promesses v0.1.13
Scene 1 "0x101c4e" "0x0f1e5b" "" 0 0 @(
  (Txt "hk1" @("01 - ORGANISER") 36 $true $KB 300 0.2),
  (Txt "hh1" @("Toujours savoir quoi faire") 96 $true $WT 380 0.5),
  (Txt "hb1" @("Tâches, Kanban, calendrier et priorités.") 50 $false $LB 640 1.1)
)
Scene 2 "0x101c4e" "0x0f1e5b" "" 0 0 @(
  (Txt "hk2" @("02 - DOCUMENTER") 36 $true $KB 300 0.2),
  (Txt "hh2" @("Des notes qui travaillent") 96 $true $WT 380 0.5),
  (Txt "hb2" @("Éditeur riche, assistant, export Word et PDF.") 50 $false $LB 640 1.1)
)
Scene 3 "0x101c4e" "0x0f1e5b" "" 0 0 @(
  (Txt "hk3" @("03 - ÉCHANGER") 36 $true $KB 300 0.2),
  (Txt "hh3" @("Restez connectés") 96 $true $WT 380 0.5),
  (Txt "hb3" @("Messagerie d'équipe et invitations.") 50 $false $LB 640 1.1)
)
Scene 4 "0x101c4e" "0x0f1e5b" "" 0 0 @(
  (Txt "hk4" @("04 - PARTOUT, MÊME HORS-LIGNE") 36 $true $KB 300 0.2),
  (Txt "hh4" @("Web, Android, Windows") 96 $true $WT 380 0.5),
  (Txt "hb4" @("Vos données vous suivent partout.") 50 $false $LB 640 1.1)
)
# Scene 5 : final
Scene 5 "0x1d4ed8" "0x0f1e5b" $logoPng 200 240 @(
  (Txt "h5" @("Focus") 110 $true $WT 520 0.3),
  (Txt "hb5" @("github.com/DanielMb24/focus") 44 $false $LB 720 0.9)
)

$list = Join-Path $tmp "list.txt"
0..5 | ForEach-Object { "file 'seg$($_).mp4'" } | Set-Content -LiteralPath $list -Encoding ascii
Set-Location $tmp
& $FF -y -v error -f concat -safe 0 -i "list.txt" -c copy (Join-Path $root "promo\focus-promo-hd.mp4")
Set-Location $root
Write-Output "VIDEO OK"

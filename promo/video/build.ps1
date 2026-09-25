# Genere promo/focus-promo.mp4 (1080x1920, ~24s, muet) — reproductible.
# Textes pre-rendus en PNG via .NET (le filtre drawtext de ce build ffmpeg
# ne rend aucun glyphe) puis composes avec fondus dans ffmpeg.
$FF = "$env:LOCALAPPDATA\Programs\ffmpeg\ffmpeg.exe"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent (Split-Path -Parent $here)
$tmp = Join-Path $env:TEMP "focus-video"
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
Add-Type -AssemblyName System.Drawing

function Render-Text($name, $lines, $size, $bold, $colorHex) {
  $style = if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
  $font = New-Object System.Drawing.Font("Segoe UI", $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
  $probe = New-Object System.Drawing.Bitmap(10, 10)
  $g = [System.Drawing.Graphics]::FromImage($probe)
  $widths = @()
  $lh = $font.Height * 1.28
  foreach ($ln in $lines) { $widths += $g.MeasureString($ln, $font).Width }
  $g.Dispose(); $probe.Dispose()
  $w = [Math]::Min(1000, [Math]::Ceiling(($widths | Measure-Object -Maximum).Maximum) + 30)
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
  return @{ file = $out; w = $w; y0 = 0 }
}

function Scene($n, $bg1, $bg2, $logoPath, $logoY, $logoSize, $texts) {
  # $texts: @(@{png=; x=; y=; start=})
  $inputs = @("-f", "lavfi", "-i", "color=c=0x000000:s=1080x1920:r=30:d=0.01")
  $i = 1
  $chain = "gradients=s=1080x1920:speed=0:c0=${bg1}:c1=${bg2}:x0=0:y0=0:x1=1080:y1=1920,format=yuv420p[bg]"
  $prev = "[bg]"
  $overlays = @()
  if ($logoPath) {
    $inputs += @("-loop", "1", "-framerate", "30", "-t", "4", "-i", $logoPath)
    $overlays += @{ idx = $i; x = 0; y = $logoY; start = 0.1; size = $logoSize; logo = $true }; $i++
  }
  foreach ($t in $texts) {
    $inputs += @("-loop", "1", "-framerate", "30", "-t", "4", "-i", $t.png)
    $overlays += @{ idx = $i; x = $t.x; y = $t.y; start = $t.start }; $i++
  }
  $fc = $chain
  $k = 0
  foreach ($o in $overlays) {
    $lbl = "o$k"
    if ($o.logo) {
      $fc += ";[$($o.idx):v]scale=$($o.size):-1,format=rgba,fade=t=in:st=$($o.start):d=0.5:alpha=1,fade=t=out:st=3.5:d=0.5:alpha=1[tx$k]"
    } else {
      $fc += ";[$($o.idx):v]format=rgba,fade=t=in:st=$($o.start):d=0.4:alpha=1,fade=t=out:st=3.5:d=0.4:alpha=1[tx$k]"
    }
    $fc += ";$prev[tx$k]overlay=$($o.x):$($o.y):format=yuv420[o$k]"
    $prev = "[o$k]"
    $k++
  }
  $fc += ";${prev}fade=t=in:st=0:d=0.5,fade=t=out:st=3.5:d=0.5,format=yuv420p[v]"
  $out = Join-Path $tmp ("seg$($n).mp4")
  & $FF -y -v error @inputs -filter_complex $fc -map "[v]" -t 4 -r 30 -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p $out
  if ($LASTEXITCODE -ne 0) { throw "scene $n failed" }
}

function Txt($name, $lines, $size, $bold, $color, $y, $start) {
  $r = Render-Text $name $lines $size $bold $color
  return @{ png = $r.file; x = [Math]::Max(0, [int]((1080 - $r.w) / 2)); y = $y; start = $start }
}

$W = "#FFFFFF"; $LB = "#BCD0FF"; $KB = "#8FB0FF"
$logoPng = Join-Path $root "client\public\pwa-512x512.png"

# Scene 0 : logo + titre
Scene 0 "0x1d4ed8" "0x0f1e5b" $logoPng 480 400 @(
  (Txt "t0a" @("Focus") 110 $true $W 1020 0.3),
  (Txt "t0b" @("Votre journée,", "enfin lisible.") 42 $false $LB 1190 0.9)
)
# Scenes 1..3 : promesses
Scene 1 "0x101c4e" "0x0f1e5b" "" 0 0 @(
  (Txt "k1" @("01 - ORGANISER") 34 $true $KB 560 0.2),
  (Txt "h1" @("Toujours savoir", "quoi faire") 84 $true $W 660 0.5),
  (Txt "b1" @("Tâches, Kanban, calendrier", "et priorités.") 42 $false $LB 990 1.1)
)
Scene 2 "0x101c4e" "0x0f1e5b" "" 0 0 @(
  (Txt "k2" @("02 - CENTRALISER") 34 $true $KB 560 0.2),
  (Txt "h2" @("Tous vos fichiers", "au même endroit") 84 $true $W 660 0.5),
  (Txt "b2" @("Documents, scans PDF,", "hors-ligne.") 42 $false $LB 990 1.1)
)
Scene 3 "0x101c4e" "0x0f1e5b" "" 0 0 @(
  (Txt "k3" @("03 - AVANCER") 34 $true $KB 560 0.2),
  (Txt "h3" @("Concentration", "et objectifs") 84 $true $W 660 0.5),
  (Txt "b3" @("Minuteur Focus,", "progression auto.") 42 $false $LB 990 1.1)
)
# Scene 4 : plateformes
Scene 4 "0x101c4e" "0x0f1e5b" "" 0 0 @(
  (Txt "k4" @("PARTOUT AVEC VOUS") 34 $true $KB 560 0.2),
  (Txt "h4" @("Web - Android", "- Windows") 84 $true $W 660 0.5),
  (Txt "b4" @("focus.vercel.app") 44 $false $LB 990 1.1)
)
# Scene 5 : final
Scene 5 "0x1d4ed8" "0x0f1e5b" $logoPng 560 300 @(
  (Txt "t5" @("Focus") 100 $true $W 1040 0.3),
  (Txt "b5" @("github.com/DanielMb24/focus") 38 $false $LB 1190 0.9)
)

$list = Join-Path $tmp "list.txt"
0..5 | ForEach-Object { "file 'seg$($_).mp4'" } | Set-Content -LiteralPath $list -Encoding ascii
Set-Location $tmp
& $FF -y -v error -f concat -safe 0 -i "list.txt" -c copy (Join-Path $root "promo\focus-promo.mp4")
Set-Location $root
Write-Output "VIDEO OK"

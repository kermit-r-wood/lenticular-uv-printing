# Lenticular Raster

Python CLI for generating lenticular interlaced images and standalone 16-bit
UV gloss depth maps. The defaults target the eufyMake E1 preset:

- 1440 PPI output resolution
- 330 mm x 420 mm flatbed printable area check
- vertical lenticular lenses for left-right view changes
- 16-bit grayscale PNG depth map output

The eufyMake E1 preset is based on the official published spec page, which
lists 1440 DPI print resolution, 330 mm x 420 mm printing surface area, and
5 mm max embossed print height.

## Install and Test

```powershell
uv run pytest
```

## Run the Web App

```powershell
uv run lenticular-raster-web --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000` in a browser. The web app provides:

- an operation page for uploading source images and setting eufyMake E1 print parameters
- a preview page for checking the generated interlaced image and depth map
- download links for `interlaced.png` and `depth.png`

Generated jobs are saved under `outputs/jobs/<job-id>/`.

## Create a 2-Image Flip

```powershell
uv run lenticular-raster make `
  --input .\image-a.png `
  --input .\image-b.png `
  --out-interlaced .\out\flip-interlaced.png `
  --out-depth .\out\flip-depth.png `
  --width-mm 42 `
  --height-mm 42 `
  --lpi 60
```

The command writes:

- `flip-interlaced.png`: the bottom color image layer
- `flip-depth.png`: the 16-bit grayscale UV gloss/depth layer

Generated PNG files include DPI metadata matching `--ppi`. This helps UV
software that infers physical size from image resolution import the file at the
intended millimeter size instead of defaulting to 72 DPI.

## Output Only the Depth Map

```powershell
uv run lenticular-raster depth `
  --out-depth .\out\depth-42mm-60lpi.png `
  --width-mm 42 `
  --height-mm 42 `
  --lpi 60
```

## Useful Parameters

- `--lpi`: lenticular pitch, lines per inch. Start with `60` or `75`.
- `--ppi`: output pixels per inch. Defaults to `1440` for eufyMake E1.
- `--phase`: phase offset in lens pitches, for example `-0.125`, `0`, `0.25`.
- `--profile`: `sine` or `arc` lens height profile.
- `--orientation`: `vertical` for left-right view changes, `horizontal` for up-down.
- `--max-depth-value`: cap the 16-bit height value, for example `32768` for 50%.

For first physical calibration, print small 42 mm or 100 mm test pieces and
compare LPI, phase, depth value, and clear gloss base thickness.

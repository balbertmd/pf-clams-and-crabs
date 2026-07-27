# PF Clams and Crabs — logo source of truth

The master is **`logo-master-4x.png`, 5016×5016 RGBA**, in
`OneDrive\Desktop\PF Clams and Crabs\00-BRAND`. Everything else is generated
from it. Nothing is ever generated from a derivative.

| file | what it is | use it for |
|---|---|---|
| `pf-logo-master-2048.png` | 2048², transparent | print, large format |
| `pf-logo-master-1080.png` | 1080², transparent | the general-purpose master |
| `pf-logo-master-512.png` / `-256.png` | smaller, transparent | web, email signatures, favicons |
| `pf-logo-on-white.png` | 1080² square, white field | light backgrounds, print, Google Business Profile |
| `pf-logo-on-navy.png` | 1080² square, navy `#081a26` | the website, dark collateral |
| `pf-logo-square-gbp.png` | copy of the white version | the exact file uploaded to Google |

## Rules

- The badge runs edge to edge in every square file. **No padding.** Google
  crops logos to a circle, so padding shows up as a dead ring around the mark.
- Square-file corners are background, never artwork — the mark is a circle and
  cannot reach them. Geometry, not a defect.
- Never scale the badge past the frame edge. It clips
  "FRESH – CAPE MAY COUNTY – LOCAL / NEW JERSEY" off the rope.
- Never re-save as a palette (mode `P`) PNG. Google rejected a palette-with-
  alpha version of this logo twice.
- Backgrounds are white `#ffffff` or navy `#081a26`. Nothing else.

## History

The first build of this set came from `site/public/images/logo.png` at 600×600
and was visibly soft at 1080. The 5016×5016 master turned up in the OneDrive
asset library on 2026-07-27; everything was regenerated from it. If a logo file
ever looks mushy, it was built from the old 600px art — rebuild from the 4x.

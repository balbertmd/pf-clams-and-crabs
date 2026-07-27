# PF Clams and Crabs — logo source of truth

`pf-logo-master.png` is the logo. Everything else is generated from it.

| file | what it is | use it for |
|---|---|---|
| `pf-logo-master.png` | 1080×1080, transparent outside the circle | the master. anything new starts here |
| `pf-logo-master-512.png` / `-256.png` | same, smaller | web, email signatures, favicons |
| `pf-logo-on-white.png` | 1080 square, white field | light backgrounds, print, Google Business Profile |
| `pf-logo-on-navy.png` | 1080 square, site navy `#081a26` | the website, dark collateral |
| `pf-logo-square-gbp.png` | copy of the white version | the file uploaded to Google Business Profile |

## Rules

- The badge runs edge to edge in every square file. **No padding.** Google
  crops logos to a circle, so any padding shows up as a dead ring around the
  mark.
- The corners of a square file are background, never artwork — the mark is a
  circle and cannot reach them. That is geometry, not a defect.
- Never scale the badge past the frame edge. It clips
  "FRESH – CAPE MAY COUNTY – LOCAL / NEW JERSEY" off the rope.
- Never re-save the master as a palette (mode `P`) PNG. Google rejected an
  earlier palette-with-alpha version of this logo twice.
- Backgrounds are white `#ffffff` or navy `#081a26`. Nothing else.

Original art: `site/public/images/logo.png` (600×600, transparent). Low
resolution — if the logo is ever needed above 1080, the art has to be redrawn
or upscaled, not stretched from here.

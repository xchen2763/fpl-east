# FPL Custom FDR

Build your own Premier League Fixture Difficulty Rating table instead of relying on a single official rating model.

## Features

- Rate every team from `1.0` to `5.0` in `0.1` steps
- Optionally rate attack and defence separately, with linked overall ratings
- Switch between Overall, Attack, and Defence FDR views
- Generate fixture ratings with a fixed home-advantage factor of `g = 0.5`
- Choose the starting Gameweek and display window
- Sort alphabetically or by cumulative Ease Score
- Display Double Gameweeks in one stacked cell and Blank Gameweeks as `-`
- Download Overall, Attack, or Defence FDR as a PNG image using the selected Gameweeks and sort order
- Load official FPL teams and fixtures, with bundled data as a fallback

## Separate attack and defence ratings

Enable **Enable attack / defense ratings** in the Team ratings panel to show attack and defence sliders alongside the overall rating. All three use the same `1.0`–`5.0` range in `0.1` steps; higher values mean stronger teams.

- Changing the overall rating sets both attack and defence to that value.
- Changing attack or defence updates the overall rating to their average, rounded to one decimal place.
- Hiding the extra sliders preserves their values. Click **Generate FDR table** to apply rating changes to the tables and image downloads.

## FDR model

For a fixture involving the selected team and its opponent:

```text
FDR = clamp(3 + 2 / (4 + g) * (opponent rating - team rating + venue adjustment), 1, 5)
```

The venue adjustment is `-g` at home and `+g` away. The result is rounded to one decimal place.

Each view uses the same formula and home-advantage factor, with these inputs:

| FDR view | Team rating | Opponent rating |
| --- | --- | --- |
| Overall | Overall | Overall |
| Attack | Attack | Defence |
| Defence | Defence | Attack |

Fixture sorting uses `Ease Score = sum(6 - FDR)`. This naturally rewards Double Gameweeks and gives Blank Gameweeks no contribution. Each view calculates its own Ease Scores, so difficulty-based ordering can differ between views. Each PNG uses its selected FDR type and follows the chosen sort order.

## Local development

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:3000`.

## Production build

```bash
pnpm build
```

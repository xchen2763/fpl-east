# FPL Custom FDR

Build your own Premier League Fixture Difficulty Rating table instead of relying on a single official rating model.

## Features

- Rate every team from `1.0` to `5.0` in `0.1` steps
- Generate fixture ratings with a fixed home-advantage factor of `g = 0.5`
- Choose the starting Gameweek and display window
- Sort alphabetically or by cumulative Ease Score
- Display Double Gameweeks in one stacked cell and Blank Gameweeks as `-`
- Export the ratings and current fixture table as a PNG image
- Load official FPL teams and fixtures, with bundled data as a fallback

## FDR model

For a fixture involving the selected team and its opponent:

```text
FDR = clamp(3 + 2 / (4 + g) * (opponent rating - team rating + venue adjustment), 1, 5)
```

The venue adjustment is `-g` at home and `+g` away. The result is rounded to one decimal place.

Fixture sorting uses `Ease Score = sum(6 - FDR)`. This naturally rewards Double Gameweeks and gives Blank Gameweeks no contribution.

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

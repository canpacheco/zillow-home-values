# Metro home values: where has the pandemic housing boom held, and where has it reversed?

A two-page website on Zillow's Home Value Index for 894 US metro areas, January 2015 to August 2026,
built for the head of mortgage lending at a regional bank. The report page states the findings; the
dashboard page lets the reader filter the same data and watch the numbers change. Both pages load the
data file in the browser and do every calculation there.

## Files

| File | What it is |
|---|---|
| `index.html` | The report page: the question, the answer and a recommendation, four summary numbers, three findings with a chart each, and a section about the data. |
| `dashboard.html` | The dashboard page: filters on region, metro size, state, and a month range; the same four summary numbers; four charts; and a table of the metros in view. |
| `site.js` | The code both pages share: reading the CSV, computing each metro's change over the range and distance from its peak, and drawing the charts. |
| `style.css` | The look both pages share. |
| `zillow_metro_home_values.csv` | The data: one row per metro per month, 124,619 rows, 8 columns. |
| `README.md` | This file. |

## Where the data came from

Zillow Research, zillow.com/research/data: the Zillow Home Value Index (ZHVI) for metro areas, all
homes, middle tier, smoothed and seasonally adjusted. Zillow publishes it as one wide file with a
column per month. The file here was reshaped in Python so that one row is one metro in one month,
the United States total row and months before January 2015 were dropped, and three columns were
added: `census_region` from the state, `size_tier` from Zillow's size rank (Top 50, 51 to 200, 201 and
up), and `change_12m_pct`, the 12-month change in the home value.

## Columns

`metro`, `state`, `census_region`, `size_rank`, `size_tier`, `month` (first day of the month),
`home_value` (dollars), `change_12m_pct` (percent, blank for the first twelve months).

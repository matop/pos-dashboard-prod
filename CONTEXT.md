# POS Dashboard — Domain Glossary

## Batch de cierre

A scheduled ETL script that runs nightly at 23:00. It loads all of the day's sales transactions into the `dwpreporte` fact table. Until this batch runs, today's sales data does not exist in the database.

## Anchor

A reference point in time used by the Sales Comparison chart. Each anchor is a specific day (Hoy, Ayer, Hace 1 semana, Hace 1 mes, Hace 1 año) whose total sales are fetched and compared against the primary reference.

## refDate

An optional query parameter (format: YYYYMMDD) that overrides the default reference date for the Sales Comparison chart. When absent, the chart uses today as the reference unless the auto-shift rule applies.

## Auto-shift

A backend rule applied to the Sales Comparison chart when `refDate` is not explicitly provided: if today has no sales data (i.e., the batch de cierre has not yet run), the backend automatically shifts the reference to yesterday. The anchor labels shift accordingly ("Ayer", "Hace 2 días", "Hace 1 semana", "Hace 1 mes", "Hace 1 año").

## currentHour

A value returned by the Sales Comparison endpoint indicating up to which hour intra-day data was filtered. Null when the reference day is a complete closed day (auto-shifted or explicit refDate in the past); a number (0–23) when the reference is the actual current day.

## empkey

Enterprise identifier used to scope every database query. Ensures multi-tenant isolation across all endpoints.

## ubicod

Branch location code used to filter data to a specific point-of-sale location.

## topMode

A configuration value fetched from the GeneXus sidecar (`:3002`) via `GET /api/params`. Controls whether the Top chart renders by product (`'1'`) or by category (`'2'`).

## DayKey

An integer representation of a calendar date in the format YYYYMMDD, used as the primary date key in `dwpreporte` (`dwphorakey / 100`).

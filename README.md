# Walker Streets

A lightweight web prototype for mapping where you have walked.

## Features

- Uses the browser GPS API on mobile or desktop.
- Shows your live walk with a red path.
- Saves completed walks in local storage so they are visible the next time the app is reopened.
- Draws public OpenStreetMap street data and colors roads green when matched to your tracked path, gray otherwise.
- Lets users review a selected municipality/city and display the streets available from OpenStreetMap, sorted by coverage percentage.

## Run locally

From the project folder, start a static server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Notes

- The map uses OpenStreetMap tiles.
- Public road coverage comes from the Overpass API.
- Matching is a proximity-based heuristic, so it is a good prototype rather than a production street-accuracy system.
- The municipality review feature loads roads from OpenStreetMap and ranks them by the percentage of matching saved walk segments.

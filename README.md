# WIP

# Install

Install dependencies:

  `npm install`

Bundle assets:

  `npm run bundle`

Start server:

  `npm run start`

Plotter accessible at http://localhost:4999/

To see actual data, you should have a [signalk-server-node](https://github.com/SignalK/signalk-server-node)
running and maybe some [charts](https://github.com/vokkim/tuktuk-chart-plotter#charts).

## Environment variables

- `PORT` = server port, default 4999
- `CHARTS_PATH` = location for chart files (`.mbtiles`), default `charts/`
- `CLIENT_CONFIG_FILE` = client config file, default `client-config.json`

# Data providers

## SignalK

Chart plotter is designed to work with [SignalK](http://signalk.org/):

- Install and run [signalk-server-node](https://github.com/SignalK/signalk-server-node)
- Add `signalk` data provider to `client-config.json`:
``` javascript
"data": [
  {
    "type": "signalk",
    "address": "localhost:3000"
  }
]
...
```

## Browser Geolocation API

To use the [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation), add `geolocation` provider:
``` javascript
"data": [
  {
    "type": "geolocation"
  }
]
...
```


# Charts

## Local charts

Put charts in [MBTiles](https://github.com/mapbox/mbtiles-spec) format to your `CHARTS_PATH`.
Files must end with `.mbtiles` postfix. Charts found by the chart plotter are listed in `http://localhost:4999/charts/`.

Local charts are configured in `client-config.json` by adding `local` chart provider:
``` javascript
...
"charts": [
  {
    "index": 0,
    "type": "local"
  }
]
...
```

Some example MBTiles charts:

- Finnish nautical charts: https://github.com/vokkim/rannikkokartat-mbtiles
- NOAA charts are also provided in MBTiles format: http://tileservice.charts.noaa.gov/

## SignalK charts

Map tiles hosted by SignalK server are configured in `client-config.json` by adding `signalk` chart provider:
``` javascript
...
"charts": [
  {
    "index": 2,
    "type": "signalk",
    "address": ":3000"
  }
]
...
```

## Online charts

Other charts in `client-config.json` are of type `tilelayer`:
``` javascript
"charts": [
  {
    "index": 1,
    "type": "tilelayer",
    "maxzoom": 15,
    "minzoom": 1,
    "name": "OpenStreetMap",
    "description": "OSM charts."
    "path": "http://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
  }
]
```

# Client config

Example config:
``` javascript
{
  "data": [
    {
      "type": "signalk",
      "address": "localhost:3000"
    }
  ],
  "course": "COG",
  "follow": true,
  "showInstruments": true,
  "zoom": 13,
  "charts": [
    {
      "index": 0,
      "type": "tilelayer",
      "maxzoom": 15,
      "minzoom": 4,
      "name": "liikennevirasto_rannikkokartat_public_15_4",
      "description": "Lähde: Liikennevirasto. Ei navigointikäyttöön. Ei täytä virallisen merikartan vaatimuksia.",
      "tilemapUrl": "/charts/liikennevirasto_rannikkokartat_public_15_4/{z}/{x}/{y}",
      "bounds": [19.105224609375, 59.645540251443215, 27.88330078125, 65.84776766596988],
      "center": [24.805, 60.0888]
    }
  ]
}
```

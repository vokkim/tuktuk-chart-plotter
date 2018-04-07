
# Tuktuk Chart plotter

Chart plotter for [Signal K](https://github.com/SignalK/signalk-server-node) with the support for raster chart providers.

Very much _WIP_.


<img src="https://github.com/vokkim/tuktuk-chart-plotter/raw/master/preview-1.jpg" alt="Tuktuk plotter with Finnish charts" width="300" />|<img src="https://github.com/vokkim/tuktuk-chart-plotter/raw/master/preview-2.jpg" alt="Tuktuk plotter with NOAA charts" width="300" />

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

# Developement 

Install dependencies:

  `npm install`
  
Start server:

  `npm run watch`
  
## Environment variables

- `PORT` = server port, default 4999
- `CHARTS_PATH` = location for chart files (`.mbtiles`), default `charts/`
- `CLIENT_CONFIG_FILE` = client config file, default `client-config.json`

# Client config

- When the plotter is ran with a local server using `npm run start` or `npm run watch`, the browser will receive a configuration file defined by the `CLIENT_CONFIG_FILE` environment variable.

- When the plotter is accessed through Signal K server plugin, the browser will use default Signal K configration defined in `public/index.html`

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


# Data providers

## Signal K

Chart plotter is designed to work with [Signal K](http://signalk.org/):

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

Some example MBTiles charts can be found from:
- Finnish nautical charts: https://github.com/vokkim/rannikkokartat-mbtiles
- NOAA charts: https://github.com/vokkim/noaa-nautical-charts

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

## Signal K charts

Map tiles hosted by Signal K server are configured in `client-config.json` by adding `signalk` chart provider:
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
    "description": "OSM charts.",
    "tilemapUrl": "http://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
  }
]
```

## License

MIT

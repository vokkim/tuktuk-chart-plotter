# WIP

# Install

Install dependencies:

  `npm install`

Bundle assets:

  `npm run bundle`

Start server:

  `npm run start`

Plotter accessible at http://localhost:4999/

You should also have a [signalk-server-node](https://github.com/SignalK/signalk-server-node) running.

## Environment variables

- `PORT` = server port, default 4999
- `CHARTS_PATH` = location for chart files (`.mbtiles`), default `charts/`
- `CLIENT_CONFIG_FILE` = client config file, default `client-config.json`

# Charts

Local chart providers can be found from `http://localhost:4999/charts/`

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
    },
    {
      "index": 1,
      "type": "tilelayer",
      "maxzoom": 15,
      "minzoom": 1,
      "name": "osm",
      "path": "http://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
    },
    {
      "index": 2,
      "type": "signalk",
      "address": "http://localhost:3000"
    }
  ]
}
```

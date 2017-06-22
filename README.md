# WIP

# Install

Install dependencies:

  `npm install`

Bundle assets:

  `npm run bundle`

Start server:

  `npm run start`

Plotter accessible at http://localhost:4999/


## Environment variables

- `PORT` = server port, default 4999
- `CHARTS_PATH` = location for chart files (`.mbtiles`), default `charts/`
- `CLIENT_CONFIG_FILE` = client config file, default `client-config.json`

# Charts

Local chart providers can be found from `http://localhost:4999/charts/`

# Client config

Exaple config:
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
      "path": "/charts/liikennevirasto_rannikkokartat_public_15_4/{z}/{x}/{y}",
      "center": [23.4942626953125, 62.746653958706545, 9]
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
  ],
  "tracks": [
    {
      "type": "daily-trackserver",
      "address": "<url to track server>",
      "vesselId": "<vessel id on track server>",
      "username": "basic auth user",
      "password": "basic auth passwd"
    },
    {  // Or for testing purposes
      "type": "dummy-trackserver"
    }
  ]
}
```

import express from 'express'
import _ from 'lodash'
import Bacon from 'baconjs'
import path from 'path'
import settings from './settings'
import MBTiles from '@mapbox/mbtiles'
import url from 'url'

const api = express.Router()

let chartProviders = {}
refreshChartProviders().onValue(providers => console.log(`Initial chart providers: ${_.keys(providers).length}`))

api.get('/charts/', (req, res) => {
  const providers = refreshChartProviders()
  providers.onError(err => {
    console.error('Error refreshing chart providers:', err)
    res.sendStatus(500)
  })

  providers.onValue(providers => {
    const sanitized = _.map(_.values(providers), provider => {
      return _.merge(_.omit(provider, ['db']), {
        tilemapUrl: `/charts/${provider.name}/{z}/{x}/{y}`,
        type: 'tilelayer'
      })
    })
    res.send(sanitized)
  })
})

api.get('/charts/:map/:z/:x/:y', (req, res) => {
  const {map, z, x, y} = req.params
  const provider = chartProviders[map]
  if (!provider) {
    res.sendStatus(404)
    return
  }
  provider.db.getTile(z, x, y, (err, tile, headers) => {
    if (err && err.message && err.message === 'Tile does not exist') {
      res.sendStatus(404)
    } else if (err) {
      console.error(`Error fetching tile ${map}/${z}/${x}/${y}:`, err)
      res.sendStatus(500)
    } else {
      headers['Cache-Control'] = 'public, max-age=7776000' // 90 days
      res.writeHead(200, headers)
      res.end(tile)
    }
  })
})

function refreshChartProviders() {
  const providers = Bacon.fromNodeCallback(MBTiles.list, settings.chartsPath)
    .flatMap(files => Bacon.combineAsArray(_.map(files, chartFileToProvider)))
    .map(providers => {
      return _.reduce(
        providers,
        (sum, p) => {
          sum[p.name] = p
          return sum
        },
        {}
      )
    })
    .doAction(providers => {
      chartProviders = providers
    })

  return providers
}

function chartFileToProvider(uri) {
  const {pathname} = url.parse(uri)
  const name = sanitizeMapName(path.parse(pathname).name)
  const bus = new Bacon.Bus() // Must use Bus for now, since `new MBTiles` is not so easily Baconized
  new MBTiles(pathname, (err, db) => {
    if (err) {
      bus.push(new Bacon.Error(err))
    } else {
      bus.push(db)
    }
    bus.end()
  })
  return bus.flatMap(db => {
    return Bacon.fromNodeCallback(db, 'getInfo').map(metadata => {
      const fromMetadata = _.pick(metadata, [
        'bounds',
        'minzoom',
        'maxzoom',
        'type',
        'format',
        'attribution',
        'center',
        'description',
        'scheme'
      ])
      return _.merge({name, file: pathname, db}, fromMetadata)
    })
  })
}

function sanitizeMapName(name) {
  return _.snakeCase(_.deburr(name))
}

module.exports = api

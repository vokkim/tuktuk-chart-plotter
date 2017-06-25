import Atom from 'bacon.atom'
import Bacon from 'baconjs'
import _ from 'lodash'
import api from './api'
import * as L from 'partial.lenses'
import {COG, EXTENSION_LINE_5_MIN, MIN_ZOOM, MAX_ZOOM} from './enums'

const defaultSettings = {
  zoom: 13,
  fullscreen: false,
  drawMode: false,
  course: COG,
  follow: true,
  showMenu: false,
  extensionLine: EXTENSION_LINE_5_MIN,
  showInstruments: true,
  ais: {
    enabled: false
  },
  worldBaseChart: true,
  chartProviders: [],
  loadingChartProviders: true,
  data: [],
}

const charts = _.get(window.INITIAL_SETTINGS, 'charts', [])
const settings = Atom(_.assign(defaultSettings, _.omit(window.INITIAL_SETTINGS, ['charts']) || {}))

function fetchSignalKCharts(provider) {
  const url = `${provider.address}/signalk/v1/api/resources/charts`
  return api.get({url}).flatMap(charts => {
    return Bacon.fromArray(_.map(_.values(charts), chart => {
      const tilemapUrl = provider.address + chart.tilemapUrl
      const from = _.pick(chart, ['type', 'name', 'minzoon', 'maxzoom', 'center', 'description'])
      return _.merge({id: provider.identifier, tilemapUrl, minzoom: MIN_ZOOM, maxzoom: MAX_ZOOM, index: provider.index || 0}, from)
    }))
  })
}

const chartProviders = Bacon.fromArray(charts)
  .flatMap(provider => {
    return provider.type === 'signalk' ? fetchSignalKCharts(provider) : Bacon.once(provider)
  })
  .fold([], _.concat)

chartProviders.onValue(charts => {
  settings.view(L.prop('chartProviders')).set(charts)
  settings.view(L.prop('loadingChartProviders')).set(false)
})

chartProviders.onError(e => {
  console.error(`Error fetching chart providers`)
  console.error(e)
})

module.exports = {
  settings
}
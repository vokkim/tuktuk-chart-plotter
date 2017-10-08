import Bacon from 'baconjs'

import api from './api'

function initialize ({ address }) {
  const unitCache = {}
  return {
    queryTracks,
    getUnits
  }

  function queryTracks (bbox, paths) {
    return api.get({
      url: `${address}/signalk/v1/api/vessels/self/tracks?bbox=${bbox.toBBoxString()}&paths=${paths.join(',')}`
    })
  }

  function getUnits(path) {
    const fromCache = unitCache[path]
    if (fromCache === 'not_available') {
      return Bacon.once(new Bacon.Error("Unit not available for" + path))
    }
    return fromCache ? Bacon.once(fromCache) : getUnitsFromServer(path)
  }

  function getUnitsFromServer(path) {
    const result = api.get({url: `${address}/signalk/v1/api/vessels/self/${path.replace('.','/')}/meta`}).map(json => json.units)
    result.onError(() => {
      unitCache[path] = "not_available"
    })
    result.onValue(unit => {
      unitCache[path] = typeof unit != "undefined" ? unit : "not_available"
    })
    return result
  }
}

module.exports = initialize

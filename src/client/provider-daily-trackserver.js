import api from './api'

function initialize({address, vesselId, username, password}) {
  return {
    queryTracks
  }

  function queryTracks(bbox) {
    return api.get({
      url: `${address}/${vesselId}/daily-tracks?bbox=${bbox.toBBoxString()}`,
      basicAuth: !!username && !!password ? {username, password} : undefined
    })
  }
}


module.exports = initialize

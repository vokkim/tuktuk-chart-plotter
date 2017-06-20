import api from './api'

function initialize({address, vesselId}) {
  return {
    queryTracks
  }

  function queryTracks(bbox) {
    return api.get({url: `${address}/${vesselId}/daily-tracks/?bbox=${bbox.toBBoxString()}`})
  }
}


module.exports = initialize

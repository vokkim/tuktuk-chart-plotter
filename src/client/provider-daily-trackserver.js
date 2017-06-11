import api from './api'

function initialize(trackServerAddress, vesselId) {
  return {
    queryTracks
  }

  function queryTracks(bbox) {
    return api.get({url: `${trackServerAddress}/${vesselId}/daily-tracks/?bbox=${bbox.toBBoxString()}`})
  }
}


module.exports = initialize

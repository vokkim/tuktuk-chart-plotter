import api from './api'

function initialize(trackServerAddress) {
  return {
    queryTracks
  }

  function queryTracks(bbox) {
    return api.get({url: `${trackServerAddress}/daily-tracks?bbox=${bbox.toBBoxString()}`})
  }
}


module.exports = initialize

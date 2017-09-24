import api from './api'

function initialize({address}) {
  return {
    queryTracks
  }

  function queryTracks(bbox) {
    return api.get({
      url: `${address}/signalk/v1/api/vessels/self/tracks?bbox=${bbox.toBBoxString()}&paths=navigation.speedOverGround,environmentWindSpeedTrue`
    })
  }
}


module.exports = initialize

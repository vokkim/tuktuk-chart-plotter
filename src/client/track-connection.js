import Bacon from 'baconjs'
import DailyTrackServerProvider from './provider-daily-trackserver'
import DummyTrackServerProvider from './provider-dummy-trackserver'
import SignalKTrackServerProvider from './provider-signalk-trackserver'

function connect(providers) {
  if (!providers || providers.length === 0) {
    return EmptyTrackServerProvider()
  }
  if (providers.length > 1) {
    throw `Only 1 track provider supported for now`
  }
  const providerConfig = providers[0]
  if (providerConfig.type === 'daily-trackserver') {
    return DailyTrackServerProvider(providerConfig)
  } else if (providerConfig.type === 'signalk') {
    return SignalKTrackServerProvider(providerConfig)
  } else if (providerConfig.type === 'dummy-trackserver') {
    return DummyTrackServerProvider()
  } else {
    throw `Unsupported provider ${providerConfig}`
  }
}

function EmptyTrackServerProvider() {
  return {
    queryTracks: () => Bacon.once([])
  }
}

module.exports = connect

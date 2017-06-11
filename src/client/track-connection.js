import Bacon from 'baconjs'
import DailyTrackServerProvider from './provider-daily-trackserver'
import DummyTrackServerProvider from './provider-dummy-trackserver'

function connect(providers) {
  if (providers.length > 1) {
    throw `Only 1 track provider supported for now`
  }
  if (providers.length === 0) {
    return EmptyTrackServerProvider()
  }
  const provider = providers[0]
  if (provider.type === 'daily-trackserver') {
    return DailyTrackServerProvider(provider.address, provider.vesselId)
  } else if (provider.type === 'dummy-trackserver') {
    return DummyTrackServerProvider()
  } else {
    throw `Unsupported provider ${provider}`
  }
}

function EmptyTrackServerProvider() {
  return {
    queryTracks: () => Bacon.once([])
  }
}

module.exports = connect

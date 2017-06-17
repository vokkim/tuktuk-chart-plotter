import Bacon from 'baconjs'
import SignalkProvider from './provider-signalk'
import GeolocationProvider from './provider-geolocation'

function connect({providers, settings}) {
  if (providers.length > 1) {
    throw `Only 1 data provider supported for now`
  }
  if (providers.length === 0) {
    return {
      selfData: Bacon.constant({}),
      aisData: Bacon.constant({})
    }
  }
  const provider = providers[0]
  if (provider.type === 'signalk') {
    return SignalkProvider({address: provider.address, settings})
  } else if (provider.type === 'geolocation') {
    return GeolocationProvider({settings})
  } else {
    throw `Unsupported provider ${provider}`
  }
}
module.exports = connect
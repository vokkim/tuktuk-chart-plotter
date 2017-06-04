import Bacon from 'baconjs'
import SignalkProvider from './provider-signalk'

function connect(providers) {
  if (providers.length > 1) {
    throw `Only 1 data provider supported for now`
  }
  if (providers.length === 0) {
    return {
      data: Bacon.constant({})
    }
  }
  const provider = providers[0]
  if (provider.type === 'signalk') {
    return SignalkProvider(provider.address)
  } else {
    throw `Unsupported provider ${provider}`
  }
}
module.exports = connect
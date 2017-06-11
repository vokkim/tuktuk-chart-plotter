import * as L from 'partial.lenses'
import Bacon from 'baconjs'
import _ from 'lodash'
import SignalK from 'signalk-client'

function parseAddress(address) {
  if (_.isEmpty(address)) {
    throw `Empty SignalK address!`
  }
  if (_.isEmpty(address.split(':')[0])) {
    // Relative address such as ':80'
    return `${window.location.hostname}:${address.split(':')[1]}`
  } else {
    return address
  }
}

function connect(address) {

  const rawStream = new Bacon.Bus()
  let selfId

  const onMessage = (msg) => {
    if (!selfId && msg && msg.self && _.isString(msg.self)) {
      selfId = msg.self
    }
    rawStream.push(msg)
  }
  const onConnect = (c) => {
    c.send({
      context: 'vessels.self',
      subscribe: [
        {
          path: '*',
          period: 2000,
          format: 'delta',
          policy: 'ideal',
          minPeriod: 1000
        }
      ]
    })
    console.log('CONNECTED')
  }
  const onDisconnect = (c) => {
    c && c.close && c.close()
    rawStream.end()
    console.log('DISCONNECTED')
  }
  const onError = (e) => {
    rawStream.push(new Bacon.Error(e))
  }
  const signalk = new SignalK.Client()
  const connection = signalk.connectDelta(parseAddress(address), onMessage, onConnect, onDisconnect, onError, onDisconnect, 'none')

  const selfStream = rawStream.filter(msg => msg.context === 'vessels.'+selfId)

  const updates = selfStream.map(msg => {
    return _(msg.updates)
      .map(u => _.map(u.values, v => {
        return {
          timestamp: u.timestamp,
          path: v.path,
          value: v.value
        }
      }))
      .flatten()
      .value()
  })

  const data = updates
    .filter(values => !_.isEmpty(values))
    .scan({}, (sum, values) => {
      const pairs = _.map(values, v => [v.path, v.value])
      return _.assign({}, sum, _.fromPairs(pairs))
    })

  return {
    rawStream,
    data
  }
}
module.exports = connect
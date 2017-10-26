import * as L from 'partial.lenses'
import Bacon from 'baconjs'
import _ from 'lodash'
import api from './api'
import SignalK from '@signalk/client'

function connect({address, settings}) {
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
          format: 'delta',
          policy: 'ideal',
          minPeriod: 3000
        }
      ]
    })

    c.send({
      context: 'vessels.*',
      subscribe: [
        {path: '*', period: 10000}
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

  const selfData = updates
    .filter(values => !_.isEmpty(values))
    .scan({}, (sum, values) => {
      const pairs = _.map(values, v => [v.path, v.value])
      return _.assign({}, sum, _.fromPairs(pairs))
    })
    .debounceImmediate(1000)

  const aisData = selfStream
    .take(1)
    .flatMap(() => {
      const {aisData} = parseAISData({selfId, connection, address, rawStream, settings})
      return aisData
    })

  return {
    rawStream,
    selfData,
    aisData
  }
}

function parseAISData({selfId, connection, address, rawStream, settings}) {
  const aisEnabled = settings.map(s => _.get(s, 'ais.enabled', false)).skipDuplicates()
  //TODO: Subscribe / unsubscribe for AIS vessels
  const aisStream = rawStream
    .filter(msg => msg.context !== 'vessels.'+selfId)
    .map(singleDeltaMessageToAisData)

  const fullAisData = aisEnabled
    .flatMapLatest(enabled => {
      return enabled ? getInitialAISData(address) : Bacon.once()
    })
    .merge(aisStream)
    .scan({delta: [], full: {}}, (previous, vesselData) => {
      const delta = _.reduce(vesselData, (sum, row) => {
        sum[row.vessel] = _.merge(previous.full[row.vessel], row.data)
        return sum
      }, {})
      return {delta, full: _.merge(previous.full, delta)}
    })

  const deltaAisData = fullAisData
    .map('.delta')
    .filter(d => !_.isEmpty(d))

  return {
    aisData: deltaAisData
  }
}

function singleDeltaMessageToAisData(msg) {
  return _(msg.updates)
    .map(u => _.map(u.values, v => {
      const isName = v.value && v.value.name
      const path = isName ? 'name' : v.path
      const data = {
        timestamp: u.timestamp,
        path,
        value: isName ? v.value.name : v.value
      }
      return {vessel: msg.context.substring(8), data: {[path]: data}}
    }))
    .flatten()
    .value()
}

function getInitialAISData(address) {
  const protocol = window.location.protocol
  const url = `${protocol}//${parseAddress(address)}/signalk/v1/api/`
  return api.get({url})
    .map(data => {
      const selfId = data.self
      return _.reduce(data.vessels, (sum, vessel, key) => {
        if (key === selfId) {
          return sum
        }
        const navigationData = _.reduce(vessel.navigation, (sum, v, key) => {
          const path = `navigation.${key}`
          const value = v.value ? v.value : _.omit(v, ['$source', 'timestamp', 'pgn'])
          const timestamp = v.timestamp
          sum[path] = {path, timestamp, value}
          return sum
        }, {})

        const data = _.merge({name: vessel.name}, navigationData)
        sum.push({vessel: key, data})
        return sum
      }, [])
    })
}


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

module.exports = connect
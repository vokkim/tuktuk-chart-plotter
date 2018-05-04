import Bacon from 'baconjs'
import _ from 'lodash'
import api from './api'
import SignalK from '@signalk/client'

let selfId // TODO: Nasty, get rid of this mutate

const isSelf = id => {
  return selfId && (selfId === id || selfId === `vessels.${id}`)
}

function connect({address, settings}) {
  const rawStream = new Bacon.Bus()
  const connectionStateBus = new Bacon.Bus()
  const connectionState = connectionStateBus.toProperty('connecting')

  const onMessage = msg => {
    if (!selfId && msg && msg.self && _.isString(msg.self)) {
      selfId = msg.self
    }
    rawStream.push(msg)
  }
  const onConnect = c => {
    connectionStateBus.push('connected')
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
      subscribe: [{path: '*', period: 10000}]
    })
    console.log(`SignalK connected to ${parseAddress(address)}`)
  }
  const onDisconnect = c => {
    c && c.close && c.close()
    rawStream.end()
    connectionStateBus.push('disconnected')
    console.log('SignalK disconnected')
  }
  const onError = e => {
    rawStream.push(new Bacon.Error(e))
    onDisconnect()
  }

  const signalk = new SignalK.Client()
  signalk.connectDelta(parseAddress(address), onMessage, onConnect, onDisconnect, onError, onDisconnect, 'none')
  const selfStream = rawStream.filter(msg => isSelf(msg.context))

  const updates = selfStream.map(msg => {
    return _(msg.updates)
      .map(u =>
        _.map(u.values, v => {
          return {
            timestamp: u.timestamp,
            path: v.path,
            value: v.value
          }
        })
      )
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

  const {aisData, getVesselAisData} = parseAISData({selfStream, address, rawStream, settings})

  return {
    connectionState: connectionState,
    rawStream,
    selfData,
    aisData,
    getVesselAisData
  }
}

function parseAISData({selfStream, address, rawStream, settings}) {
  const hasSelf = selfStream
    .take(1)
    .map(true)
    .toProperty(false)
  const aisEnabled = settings.map(s => _.get(s, 'ais.enabled', false)).skipDuplicates()
  //TODO: Subscribe / unsubscribe for AIS vessels
  const aisStream = rawStream
    .filter(aisEnabled)
    .map(singleDeltaMessageToAisData)
    .bufferWithTimeOrCount(1000, 100)
    .map(deltas => _.reduce(deltas, _.merge, {}))
  const fullAisData = Bacon.combineTemplate({
    hasSelf,
    aisEnabled
  })
    .flatMapLatest(({hasSelf, aisEnabled}) => {
      return hasSelf && aisEnabled ? getInitialAISData(address).concat(aisStream) : Bacon.once()
    })
    .scan({delta: {}, full: {}}, (previous, data) => {
      const full = _.merge({}, previous.full, _.omitBy(data, (value, key) => isSelf(key)))
      const delta = _.pick(full, _.keys(data))
      return {delta, full}
    })

  const deltaAisData = fullAisData.map('.delta').filter(d => !_.isEmpty(d))

  function getVesselAisData(vesselId) {
    return fullAisData
      .map(data => data.full[vesselId])
      .filter(_.identity)
      .skipDuplicates(_.isEqual)
  }

  return {
    aisData: deltaAisData,
    getVesselAisData
  }
}

function singleDeltaMessageToAisData(msg) {
  if (!msg.context) {
    return {} // Not a proper SK delta message
  }
  const data = _.reduce(
    msg.updates,
    (sum, update) => {
      const {timestamp} = update
      _.each(update.values, value => {
        _.set(sum, value.path + '.value', value.value)
        _.set(sum, value.path + '.timestamp', timestamp)
      })
      return sum
    },
    {}
  )
  return {[msg.context.substring(8)]: data}
}

function getInitialAISData(address) {
  const protocol = window.location.protocol
  const url = `${protocol}//${parseAddress(address)}/signalk/v1/api/`
  return api.get({url}).map('.vessels')
}

function parseAddress(address) {
  if (_.isEmpty(address)) {
    throw 'Empty SignalK address!'
  }
  if (_.isEmpty(address.split(':')[0])) {
    // Relative address such as ':80'
    return `${window.location.hostname}:${address.split(':')[1]}`
  } else {
    return address
  }
}

module.exports = connect

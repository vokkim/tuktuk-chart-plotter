import React from 'baret'
import Bacon from 'baconjs'
import _ from 'lodash'
import numeral from 'numeral'
import * as Leaf from 'leaflet'
// eslint-disable-next-line no-unused-vars
import LeafletRotatedMarker from 'leaflet-rotatedmarker'
import {toDegrees, toKnots} from './utils'

const aisTargetMarker = Leaf.icon({
  iconUrl: 'ais-target-medium.png',
  iconSize: [20, 30],
  iconAnchor: [10, 15]
})

class Ais extends React.Component {
  componentDidMount() {
    initAisData(this.props.connection.aisData, this.props.settings)
  }
  render() {
    return <div />
  }
}

function initAisData(aisData, settings) {
  if (!window.map && window.map) {
    throw new Error('Unable to init AIS data, window.map does not exist')
  }
  const {map} = window
  let aisMarkers = {}

  const aisEnabled = settings.map(s => _.get(s, 'ais.enabled', false)).skipDuplicates()
  aisEnabled
    .not()
    .filter(_.identity)
    .onValue(() => {
      _.each(aisMarkers, marker => marker.remove()) // Remove all markers
      aisMarkers = {}
    })

  Bacon.interval(60 * 1000, true) // Check for expired AIS targets every 60s
    .filter(aisEnabled)
    .onValue(() => {
      aisMarkers = removeOldVesselMarkers(aisMarkers)
    })

  aisData
    .filter(aisEnabled)
    .skipDuplicates()
    .onValue(vessels => {
      _.each(vessels, (data, vesselId) => {
        const position = _.get(data, 'navigation.position')
        const course = toDegrees(_.get(data, 'navigation.courseOverGroundTrue.value'))
        if (aisMarkers[vesselId]) {
          updateVesselMarker(aisMarkers[vesselId], {position, course})
        } else if (position && course) {
          aisMarkers[vesselId] = addVesselMarker(map, {position, course})
        }
        if (aisMarkers[vesselId]) {
          setMarkerTooltip(aisMarkers[vesselId], data)
        }
      })
    })
}

function updateVesselMarker(marker, {position, course}) {
  course && marker.setRotationAngle(course)
  position && marker.setLatLng([position.value.latitude, position.value.longitude])
}

function addVesselMarker(map, {position, course}) {
  const latlng = [position.value.latitude, position.value.longitude]
  const vesselMarker = Leaf.marker(latlng, {
    icon: aisTargetMarker,
    draggable: false,
    zIndexOffset: 980,
    rotationOrigin: 'center center',
    rotationAngle: course
  })
  vesselMarker.addTo(map)
  return vesselMarker
}

function setMarkerTooltip(marker, data) {
  const name = _.get(data, 'name.value') || data.name || 'Unknown'
  const sog = toKnots(_.get(data, 'navigation.speedOverGround.value'))
  const course = toDegrees(_.get(data, 'navigation.courseOverGroundTrue.value'))
  const formattedSog = numeral(sog).format('0.0')
  const formattedCog = numeral(course).format('0')
  const tooltip = `<div class='name'>${name}</div><div>SOG: ${formattedSog} kn</div><div>COG: ${formattedCog}</div>`
  marker.bindTooltip(tooltip, {className: 'aisTooltip'})
  marker._updatedAt = Date.now()
}

function removeOldVesselMarkers(currentMarkers) {
  const now = Date.now()
  const expired = _(currentMarkers)
    .toPairs()
    .filter(v => now - v[1]._updatedAt > 180 * 1000) // Remove markers if not updated in 3 minutes
    .value()
  _.each(expired, v => v[1].remove()) // Call Leaflet.Marker.remove()
  return _.omit(currentMarkers, _.map(expired, '0'))
}

module.exports = Ais

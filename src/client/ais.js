import React from 'baret'
import Bacon from 'baconjs'
import Atom from 'bacon.atom'
import * as L from 'partial.lenses'
import classNames from 'classnames'
import _ from 'lodash'
import numeral from 'numeral'
import * as Leaf from 'leaflet'
// eslint-disable-next-line no-unused-vars
import LeafletRotatedMarker from 'leaflet-rotatedmarker'
import {toDegrees, toKnots} from './utils'

const aisTargetMarker = Leaf.icon({
  iconUrl: 'ais-target.png',
  iconSize: [40, 54],
  iconAnchor: [20, 23]
})

const selectedAisTargetMarker = Leaf.icon({
  iconUrl: 'ais-target-selected.png',
  iconSize: [40, 54],
  iconAnchor: [20, 23]
})

class Ais extends React.Component {
  constructor() {
    super()
    this.aisSettings = Atom({selectedVessel: undefined, data: undefined})
  }
  componentDidMount() {
    initAisData(this.props.connection.aisData, this.props.settings, this.aisSettings)
  }

  render() {
    const selectedVessel = this.aisSettings.map('.selectedVessel').skipDuplicates()
    return <div>{selectedVessel.map(vesselId => (vesselId ? this.renderContent(vesselId) : null))}</div>
  }

  renderContent(vesselId) {
    const {aisSettings} = this
    const {settings} = this.props
    const {getVesselAisData} = this.props.connection
    const vesselData = getVesselAisData(vesselId)
    const classes = settings.map(v => classNames('ais-details', {'menu-visible': v.showMenu}))
    return <div className={classes}>{vesselData.map(data => renderVesselData(data, aisSettings))}</div>
  }
}

function renderVesselData(data, aisSettings) {
  function renderDataRow(label, value) {
    return (
      <div className="ais-details-row">
        <div className="ais-details-label">{label}</div>
        <div className="ais-details-value">{value || 'N/A'}</div>
      </div>
    )
  }
  function renderFormattedDataRow(label, selector, unit, numberFormat, valueFormatter) {
    const value = _.get(data, selector)
    const formattedValue = valueFormatter ? valueFormatter(value) : value
    const valueWithUnit = value !== undefined ? `${numeral(formattedValue).format(numberFormat)} ${unit}` : undefined
    return renderDataRow(label, valueWithUnit)
  }

  return (
    <div>
      <div className="ais-details-header">
        <div className="ais-details-name">{_.get(data, 'name', 'Unknown')}</div>
        <div className="ais-details-mmsi">MMSI: {_.get(data, 'mmsi', 'Unknown')}</div>
        <button
          className="button ais-details-close"
          onClick={() => aisSettings.view(L.prop('selectedVessel')).set(undefined)}>
          <i className="icon-cross" />
        </button>
      </div>
      <div className="ais-details-data">
        {renderDataRow('Vessel type:', _.get(data, 'design.aisShipType.value.name'))}
        {renderDataRow('State:', _.get(data, 'navigation.state.value', 'Unknown'))}
        <div className="ais-details-separator" />
        {renderFormattedDataRow('SOG:', 'navigation.speedOverGround.value', 'kn', '0.0', toKnots)}
        {renderFormattedDataRow('COG:', 'navigation.courseOverGroundTrue.value', '°', '0', toDegrees)}
        <div className="ais-details-separator" />
        {renderFormattedDataRow('Length:', 'design.length.value.overall', 'm', '0.0')}
        {renderFormattedDataRow('Beam:', 'design.beam.value', 'm', '0.0')}
        {renderFormattedDataRow('Draft:', 'design.draft.value.maximum', 'm', '0.0')}
      </div>
    </div>
  )
}

function initAisData(aisData, settings, aisSettings) {
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

  aisSettings
    .view(L.prop('selectedVessel'))
    .skipDuplicates()
    .filter(aisEnabled)
    .onValue(selectedVessel => {
      highlightSelectedVessel(aisMarkers, selectedVessel)
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
          aisMarkers[vesselId] = addVesselMarker(map, vesselId, {position, course}, aisSettings)
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

function addVesselMarker(map, vesselId, {position, course}, aisSettings) {
  const latlng = [position.value.latitude, position.value.longitude]
  const vesselMarker = Leaf.marker(latlng, {
    icon: aisTargetMarker,
    draggable: false,
    zIndexOffset: 980,
    rotationOrigin: 'center center',
    rotationAngle: course
  })
  vesselMarker.id = vesselId
  vesselMarker.on('click', () => {
    aisSettings.view(L.prop('selectedVessel')).set(vesselId)
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

function highlightSelectedVessel(markers, selectedVessel) {
  _.each(markers, marker => {
    if (marker.id === selectedVessel) {
      marker.setIcon(selectedAisTargetMarker)
      setTimeout(() => marker.closeTooltip(), 1)
    } else {
      marker.setIcon(aisTargetMarker)
    }
  })
}

module.exports = Ais

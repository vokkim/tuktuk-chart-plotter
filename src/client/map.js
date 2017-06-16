import React from 'baret'
import * as L from 'partial.lenses'
import Bacon from 'baconjs'
import classNames from 'classnames'
import _ from 'lodash'
import numeral from 'numeral'
import * as Leaf from 'leaflet'
import {computeDestinationPoint} from 'geolib'
import LeafletRotatedMarker from 'leaflet-rotatedmarker'
import api from './api'
import {toDegrees, toKnots} from './utils'
import {COG, HEADING, MAX_ZOOM, MIN_ZOOM, KNOTS_TO_MS} from './enums'

class Map extends React.Component {
  componentDidMount() {
    initMap(this.props.connection, this.props.settings, this.props.drawObject)
  }
  render() {
    const {settings} = this.props
    return (
      <div className={settings.map(v => classNames('map-wrapper', {'instruments-visible': v.showInstruments}))}>
        <div id='map'></div>
      </div>
    )
  }
}

function initMap(connection, settings, drawObject) {
  console.log('Init map')
  const initialSettings = settings.get()
  const map = Leaf.map('map', {
    scrollWheelZoom: initialSettings.follow ? 'center' : true,
    zoom: initialSettings.zoom,
    zoomControl: false,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    center: [0, 0],
  })
  window.map = map
  addBasemap(map)
  addCharts(map, initialSettings.charts)
  if (initialSettings.signalKChartHost) {
    fetchSignalKCharts(map, initialSettings.signalKChartHost)
  }
  const vesselIcons = createVesselIcons()

  const myVessel = Leaf.marker([0, 0], {icon: resolveIcon(vesselIcons, initialSettings.zoom), draggable: false, zIndexOffset: 990, rotationOrigin: 'center center', rotationAngle: 0})
  myVessel.addTo(map)
  const pointerEnd = Leaf.circle([0, 0], {radius: 20, color: 'red', fillOpacity: 0})
  pointerEnd.addTo(map)
  const pointer = Leaf.polyline([], {color: 'red'})
  pointer.addTo(map)

  const vesselData = Bacon.combineTemplate({
    vesselData: connection.selfData,
    settings
  })
  vesselData.onValue(({vesselData, settings}) => {
    const position = vesselData['navigation.position']
    if (position) {
      const newPos = [position.latitude, position.longitude]
      myVessel.setLatLng(newPos)
    }

    const course = settings.course === COG ? vesselData['navigation.courseOverGroundTrue'] : vesselData['navigation.headingTrue']
    if (course) {
      myVessel.setRotationAngle(toDegrees(course))
    } else {
      myVessel.setRotationAngle(0)
    }

    const speed =  vesselData['navigation.speedOverGround']
    const pointerCoordinates = calculatePointer(position, course, speed)
    if (pointerCoordinates) {
      pointer.setLatLngs(pointerCoordinates)
      pointerEnd.setLatLng(pointerCoordinates[1])
    } else {
      pointer.setLatLngs([[0, 0], [0,0]])
      pointerEnd.setLatLng([0, 0])
    }
    if (settings.follow && (pointerCoordinates || position)) {
      const to = pointerCoordinates ? pointerCoordinates[1] : [position.latitude, position.longitude]
      if (map.getCenter().distanceTo(to) > 100) {
        map.panTo(to)
      }
    }
  })

  handleAisTargets({map, aisData: connection.aisData, settings})
  handleDrawPath({map, settings, drawObject})
  handleMapZoom()
  handleDragAndFollow()
  handleInstrumentsToggle()
  function handleMapZoom() {
    settings.map('.zoom').skipDuplicates().onValue(zoom => {
      map.setZoom(zoom)
      myVessel.setIcon(resolveIcon(vesselIcons, zoom))
      if (zoom < 12) {
        pointer.setStyle({opacity: 0})
        pointerEnd.setStyle({opacity: 0})
      } else {
        pointer.setStyle({opacity: 1})
        pointerEnd.setStyle({opacity: 1})
      }
    })

    const zoomEnd = Bacon.fromEvent(map, 'zoomend')
    zoomEnd.onValue(() => {
      settings.view(L.prop('zoom')).set(map.getZoom())
    })
  }

  function handleDragAndFollow() {
    const follow = settings.map('.follow').skipDuplicates()
    follow.onValue(f => {
      map.options.scrollWheelZoom = f ? 'center' : true
    })

    const dragStart = Bacon.fromEvent(map, 'dragstart')
    //TODO: How to combine lenses and streams?
    dragStart.filter(follow).onValue(() => {
      settings.view(L.prop('follow')).modify(v => !v)
    })
  }

  function handleInstrumentsToggle() {
    settings.map('.showInstruments')
      .skipDuplicates()
      .delay(250)
      .onValue(() => {
        map.invalidateSize(true)
      })
  }
}

function handleAisTargets({map, aisData, settings}) {
  let aisMarkers = {}
  const aisTargetMarker = Leaf.icon({
    iconUrl: 'public/ais-target-medium.png',
    iconSize: [20, 30],
    iconAnchor: [10, 15]
  })
  const aisEnabled = settings.map(s => _.get(s, 'ais.enabled', false)).skipDuplicates()
  aisEnabled.not().filter(_.identity).onValue(() => {
    _.each(aisMarkers, marker => marker.remove())
    aisMarkers = {}
  })
  Bacon.interval(60*1000, true).filter(aisEnabled).onValue(() => {
    const now = Date.now()
    const expired = _(aisMarkers)
      .toPairs()
      .filter(v => now - v[1]._updatedAt > 180*1000) // Remove markers if not updated in 3 minutes
      .value()
    aisMarkers = _.omit(aisMarkers, _.map(expired, '0'))
    _.each(expired, v => v[1].remove())
  })
  aisData.filter(aisEnabled).skipDuplicates().onValue(vessels => {
    _.each(vessels, (v, k) => {
      const position = v['navigation.position']
      const course = toDegrees(_.get(v, ['navigation.courseOverGroundTrue', 'value']))
      const sog = toKnots(_.get(v, ['navigation.speedOverGround', 'value']))

      if (aisMarkers[k]) {
        course && aisMarkers[k].setRotationAngle(course)
        position && aisMarkers[k].setLatLng([position.value.latitude, position.value.longitude])
      } else if (position && course) {
        const latlng = [position.value.latitude, position.value.longitude]
        const vesselMarker = Leaf.marker(latlng, {icon: aisTargetMarker, draggable: false, zIndexOffset: 980, rotationOrigin: 'center center', rotationAngle: course})
        vesselMarker.addTo(map)
        aisMarkers[k] = vesselMarker
      }
      if (aisMarkers[k]) {
        const name = _.get(v, 'name.value', 'Unknown')
        const formattedSog = numeral(sog).format('0.0')
        const formattedCog = numeral(course).format('0')
        const tooltip = `<div class='name'>${name}</div><div>SOG: ${formattedSog} kn</div><div>COG: ${formattedCog}</div>`
        aisMarkers[k].bindTooltip(tooltip, {className: 'aisTooltip'})
        aisMarkers[k]._updatedAt = Date.now()
      }
    })
  })
}

function handleDrawPath({map, settings, drawObject}) {
  const pathMarker = Leaf.icon({
    iconUrl: 'public/path-marker.png',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  })
  let path = []
  let lastMoveAt = undefined
  const del = drawObject.view(L.prop('del'))
  const pathPolyline = Leaf.polyline([], {color: '#3e3e86', weight: 5})
  pathPolyline.addTo(map)

  Bacon.fromEvent(map, 'click')
    .filter(settings.map('.drawMode'))
    .filter(e => _.every(path, marker => e.latlng.distanceTo(marker._latlng) > 30))
    .filter(() => lastMoveAt === undefined || Date.now() - lastMoveAt > 50) // Do not add new marker if one was just dragged
    .map(e => {
      const {latlng} = e
      return Leaf.marker(latlng, {icon: pathMarker, draggable: true, zIndexOffset: 900})
    })
    .onValue(marker => {
      marker.addTo(map)
      path.push(marker)
      marker.on('move', redrawPathAndChangeDistance)
      redrawPathAndChangeDistance()
    })

  function redrawPathAndChangeDistance() {
    lastMoveAt = Date.now()
    const latlngs = _.map(path, marker => marker._latlng)
    pathPolyline.setLatLngs(latlngs)
    const distance = _.reduce(path, (sum, marker, i) => {
      if (i > 0) {
        return sum + path[i-1]._latlng.distanceTo(marker._latlng)
      } else {
        return 0
      }
      return
    }, 0)
    drawObject.view(L.prop('distance')).set(distance)
  }

  del.filter(_.identity).changes()
    .merge(settings.map('.drawMode').skipDuplicates().changes())
    .onValue(() => {
      _.each(path, marker => marker.remove())
      path = []
      redrawPathAndChangeDistance()
      drawObject.view(L.prop('del')).set(false)
    })
}

function addCharts(map, charts) {
  _.each(charts, provider => {
    if (!_.includes(['png', 'jpg', 'jpeg'], provider.format)) {
      console.error(`Unsupported chart format ${provider.format} for chart ${provider.name}`)
      return
    }
    const pane = `chart-${provider.index}`
    map.createPane(pane)
    Leaf.tileLayer(provider.path, {maxNativeZoom: provider.maxzoom, minNativeZoom: provider.minzoom, pane}).addTo(map)
  })

  if (!_.isEmpty(charts)) {
    const {center} = _.first(charts)
    if (center && _.isArray(center) && center.length >= 2) {
      map.panTo([center[1], center[0]])
    }
  }
}

function fetchSignalKCharts(map, address) {
  fetch(address + "/signalk/v1/api/resources/charts")
  .then(response => {
    response.json().then(charts => {
      _.values(charts).filter(chart => chart.tilemapUrl).forEach(chart => {
        Leaf.tileLayer(chart.tilemapUrl).addTo(map)
      })
    })
  })
  .catch(err => {
    console.error(err)
  })
}

function addBasemap(map) {
  map.createPane('basemap')
  const basemapStyle = {
    stroke: false,
    fill: true,
    fillColor: '#fafafa',
    fillOpacity: 1
  }
  const baseMap = api.get({url: 'public/world-base.geo.json'})
  baseMap.onError(e => console.log(`Unable to fetch base map`, e))
  baseMap.onValue(worldBaseGeoJSON => Leaf.geoJson(worldBaseGeoJSON, {clickable: false, style: basemapStyle, pane: 'basemap'}).addTo(map))
}

function calculatePointer(position, course, speed) {
  if (position && position.latitude && position.longitude && course && speed > 0.5) {
    const distance = speed * 60*2 // Speed in m/s
    const start = [position.latitude, position.longitude]
    const destination = computeDestinationPoint({lat: position.latitude, lon: position.longitude}, distance, toDegrees(course))
    const end = [destination.latitude, destination.longitude]
    return [start, end]
  }
  return undefined
}


function createVesselIcons() {
  const large = Leaf.icon({
    iconUrl: 'public/vessel-large.png',
    iconSize: [20, 50],
    iconAnchor: [10, 25]
  })

  const medium = Leaf.icon({
    iconUrl: 'public/vessel-medium.png',
    iconSize: [16, 40],
    iconAnchor: [8, 20]
  })

  const small = Leaf.icon({
    iconUrl: 'public/vessel-small.png',
    iconSize: [12, 30],
    iconAnchor: [6, 15]
  })
  return {large, medium, small}
}

function resolveIcon(icons, zoom) {
  if (zoom < 7) {
    return icons.small
  } else if (zoom < 12) {
    return icons.medium
  } else {
    return icons.large
  }
}

module.exports = Map

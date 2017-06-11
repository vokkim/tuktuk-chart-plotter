import React from 'baret'
import * as L from 'partial.lenses'
import Bacon from 'baconjs'
import classNames from 'classnames'
import _ from 'lodash'
import * as Leaf from 'leaflet'
import {computeDestinationPoint} from 'geolib'
import LeafletRotatedMarker from 'leaflet-rotatedmarker'
import api from './api'
import {toDegrees} from './utils'
import {COG, HEADING, MAX_ZOOM, MIN_ZOOM, KNOTS_TO_MS} from './enums'

class Map extends React.Component {
  componentDidMount() {
    initMap(this.props.connection, this.props.settings)
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

function initMap(connection, settings) {
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
  console.log('CHARTS', initialSettings.charts)
  addCharts(map, initialSettings.charts)
  const vesselIcons = createVesselIcons()

  const myVessel = Leaf.marker([0, 0], {icon: resolveIcon(vesselIcons, initialSettings.zoom), draggable: false, zIndexOffset: 1000, rotationOrigin: 'center center', rotationAngle: 0})
  myVessel.addTo(map)
  const pointerEnd = Leaf.circle([0, 0], {radius: 20, color: 'red', fillOpacity: 0})
  pointerEnd.addTo(map)
  const pointer = Leaf.polyline([], {color: 'red'})
  pointer.addTo(map)

  const vesselData = Bacon.combineTemplate({
    vesselData: connection.data,
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
    if (settings.follow && pointerCoordinates) {
      map.panTo(pointerCoordinates[1])
    } else if (settings.follow && position) {
      map.panTo([position.latitude, position.longitude])
    }
  })

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
  if (position && position.latitude && position.longitude && course && 0.2) {
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

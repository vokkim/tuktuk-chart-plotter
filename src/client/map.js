import React from 'baret'
import * as L from 'partial.lenses'
import Bacon from 'baconjs'
import classNames from 'classnames'
import _ from 'lodash'
import * as Leaf from 'leaflet'
import {computeDestinationPoint} from 'geolib'
// eslint-disable-next-line no-unused-vars
import LeafletRotatedMarker from 'leaflet-rotatedmarker'
import api from './api'
import {toDegrees} from './utils'
import {COG, MAX_ZOOM, MIN_ZOOM, EXTENSION_LINE_OFF} from './enums'

class Map extends React.Component {
  componentDidMount() {
    initMap(this.props.connection, this.props.settings, this.props.drawObject)
  }
  render() {
    const {settings} = this.props
    const classes = settings.map(v =>
      classNames('map-wrapper', {'instruments-visible': v.showInstruments, 'menu-visible': v.showMenu})
    )
    return (
      <div className={classes}>
        <div id="map" />
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
    attributionControl: false
  })
  window.map = map
  initialSettings.worldBaseChart && addBasemap(map)

  addCharts(map, initialSettings.chartProviders, settings.map('.chartProviders'))
  const vesselIcons = createVesselIcons(_.get(initialSettings.data, ['0', 'type']) === 'geolocation')

  const myVessel = Leaf.marker([0, 0], {
    icon: resolveIcon(vesselIcons, initialSettings.zoom),
    draggable: false,
    zIndexOffset: 990,
    rotationOrigin: 'center center',
    rotationAngle: 0
  })
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

    const course =
      settings.course === COG ? vesselData['navigation.courseOverGroundTrue'] : vesselData['navigation.headingTrue']
    if (course) {
      myVessel.setRotationAngle(toDegrees(course))
    } else {
      myVessel.setRotationAngle(0)
    }

    const speed = vesselData['navigation.speedOverGround']
    const extensionLineCoordinates = calculateExtensionLine(position, course, speed, settings.extensionLine)
    if (extensionLineCoordinates) {
      pointer.setLatLngs([extensionLineCoordinates.start, extensionLineCoordinates.end])
      pointerEnd.setLatLng(extensionLineCoordinates.end)
    } else {
      pointer.setLatLngs([[0, 0], [0, 0]])
      pointerEnd.setLatLng([0, 0])
    }
    if (settings.follow && (extensionLineCoordinates || position)) {
      const to = extensionLineCoordinates ? extensionLineCoordinates.middle : [position.latitude, position.longitude]
      if (map.getCenter().distanceTo(to) > 100) {
        map.panTo(to)
      }
    }
  })
  settings.leafletWaypoint = false
  settings.view(L.prop('waypoint')).set(false)
  handleDrawPath({map, settings, drawObject})
  handleMapZoom()
  handleDragAndFollow()
  handleInstrumentsToggle()
  handleDrawWaypoint({map, settings})
  function handleDrawWaypoint({map, settings}) {
    const waypointMarker = Leaf.icon({
      iconUrl: 'path-marker.png',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    })

    /**
     * Initiate behaviour or the waypoint button.
     */
    Bacon.fromEvent(map, 'click')
      .filter(settings.view(L.prop('waypoint')))
      .map(e => {
        if (settings.leafletWaypoint !== false) {
          map.removeLayer(settings.leafletWaypoint)
        }

        const {latlng} = e
        settings.leafletWaypoint = Leaf.marker(latlng, {icon: waypointMarker})
        settings.view('waypoint').set(false)
        return settings.leafletWaypoint
      })
      .onValue(marker => {
        marker.addTo(map)
      })
  }

  function handleMapZoom() {
    settings
      .map('.zoom')
      .skipDuplicates()
      .onValue(zoom => {
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
    settings
      .map('.showInstruments')
      .changes()
      .merge(settings.map('.showMenu').changes())
      .skipDuplicates()
      .delay(250)
      .onValue(() => {
        map.invalidateSize(true)
      })
  }
}

function handleDrawPath({map, settings, drawObject}) {
  const pathMarker = Leaf.icon({
    iconUrl: 'path-marker.png',
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
    const distance = _.reduce(
      path,
      (sum, marker, i) => {
        if (i > 0) {
          return sum + path[i - 1]._latlng.distanceTo(marker._latlng)
        } else {
          return 0
        }
      },
      0
    )
    drawObject.view(L.prop('distance')).set(distance)
  }

  del
    .filter(_.identity)
    .changes()
    .merge(
      settings
        .map('.drawMode')
        .skipDuplicates()
        .changes()
    )
    .onValue(() => {
      _.each(path, marker => marker.remove())
      path = []
      redrawPathAndChangeDistance()
      drawObject.view(L.prop('del')).set(false)
    })
}

function addCharts(map, providers, providersP) {
  // Initialize charts based on initial providers
  const mapLayers = _.map(providers, provider => {
    const {index, name, maxzoom, minzoom, tilemapUrl, enabled, type, center} = provider

    if (!_.includes(['tilelayer'], type)) {
      console.error(`Unsupported chart type ${type} for chart ${name}`)
      return
    }
    if (!tilemapUrl) {
      console.error(`Missing tilemapUrl for chart ${name}`)
      return
    }
    const pane = `chart-${index}`
    map.createPane(pane)
    const bounds = parseChartBounds(provider)
    // 'detectRetina' messes up Leaflet maxNativeZoom, fix with a hack:
    const maxNativeZoom = maxzoom ? maxzoom - (Leaf.Browser.retina ? 1 : 0) : undefined
    const minNativeZoom = minzoom ? minzoom + (Leaf.Browser.retina ? 1 : 0) : undefined
    const layer = Leaf.tileLayer(tilemapUrl, {detectRetina: true, bounds, maxNativeZoom, minNativeZoom, pane})

    if (enabled) {
      layer.addTo(map)
      if (_.isArray(center) && center.length === 2) {
        map.panTo([center[1], center[0]])
      } else if (bounds) {
        map.fitBounds(bounds)
      }
    }
    return {provider, layer}
  })

  // Toggle chart layers on/off based on enabled providers
  providersP
    .skipDuplicates()
    .skip(1)
    .onValue(providers => {
      _.each(providers, ({enabled, id}) => {
        const mapLayer = _.find(mapLayers, ({provider}) => provider.id === id)
        if (enabled) {
          mapLayer.layer.addTo(map)
        } else {
          mapLayer.layer.removeFrom(map)
        }
      })
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
  const baseMap = api.get({url: 'world-base.geo.json'})
  baseMap.onError(e => console.log('Unable to fetch base map', e))
  baseMap.onValue(worldBaseGeoJSON =>
    Leaf.geoJson(worldBaseGeoJSON, {clickable: false, style: basemapStyle, pane: 'basemap'}).addTo(map)
  )
}

function calculateExtensionLine(position, course, speed, extensionLineSetting) {
  if (extensionLineSetting === EXTENSION_LINE_OFF) {
    return undefined
  }
  const time = 60 * parseInt(extensionLineSetting)
  if (position && position.latitude && position.longitude && course && speed > 0.5) {
    const distance = speed * time // Speed in m/s
    const start = [position.latitude, position.longitude]
    const destination = computeDestinationPoint(
      {lat: position.latitude, lon: position.longitude},
      distance,
      toDegrees(course)
    )
    const middle = computeDestinationPoint(
      {lat: position.latitude, lon: position.longitude},
      distance / 2,
      toDegrees(course)
    )
    return {
      start,
      middle: [middle.latitude, middle.longitude],
      end: [destination.latitude, destination.longitude]
    }
  }
  return undefined
}

function createVesselIcons(shouldUseRoundIcon) {
  if (shouldUseRoundIcon) {
    const icon = Leaf.icon({
      iconUrl: 'vessel-marker-round.png',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    })
    return {large: icon, medium: icon, small: icon}
  }
  const large = Leaf.icon({
    iconUrl: 'vessel-large.png',
    iconSize: [20, 50],
    iconAnchor: [10, 25]
  })

  const medium = Leaf.icon({
    iconUrl: 'vessel-medium.png',
    iconSize: [16, 40],
    iconAnchor: [8, 20]
  })

  const small = Leaf.icon({
    iconUrl: 'vessel-small.png',
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

function parseChartBounds(provider) {
  if (!provider.bounds) {
    return undefined
  }
  if (!_.isArray(provider.bounds) || provider.bounds.length !== 4) {
    throw new Error('Unrecognized bounds format: ' + JSON.stringify(provider.bounds))
  }

  const corner1 = Leaf.latLng(provider.bounds[1], provider.bounds[0])
  const corner2 = Leaf.latLng(provider.bounds[3], provider.bounds[2])
  const bounds = Leaf.latLngBounds(corner1, corner2)
  if (!bounds.isValid()) {
    throw new Error('Invalid bounds: ' + JSON.stringify(provider.bounds))
  }
  return bounds
}

module.exports = Map

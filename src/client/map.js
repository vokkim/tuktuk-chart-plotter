import React from 'baret'
import * as L from 'partial.lenses'
import Bacon from 'baconjs'
import classNames from 'classnames'
import _ from 'lodash'
import numeral from 'numeral'
import * as Leaf from 'leaflet'
import {scaleLinear} from 'd3-scale'
import {computeDestinationPoint} from 'geolib'
import LeafletRotatedMarker from 'leaflet-rotatedmarker'
import api from './api'
import {toDegrees, toKnots} from './utils'
import {COG, HDG, MAX_ZOOM, MIN_ZOOM, KNOTS_TO_MS, EXTENSION_LINE_OFF, EXTENSION_LINE_2_MIN, EXTENSION_LINE_5_MIN, EXTENSION_LINE_10_MIN} from './enums'

class Map extends React.Component {
  componentDidMount() {
    initMap(this.props.dataConnection, this.props.trackConnection, this.props.settings, this.props.drawObject)
  }
  render() {
    const {settings} = this.props
    const classes = settings.map(v => classNames('map-wrapper', {'instruments-visible': v.showInstruments, 'menu-visible': v.showMenu}))
    return (
      <div className={classes}>
        <div id='map'></div>
      </div>
    )
  }
}

function initMap(dataConnection, trackConnection, settings, drawObject) {
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

  addCharts(map, initialSettings.chartProviders)
  const vesselIcons = createVesselIcons(_.get(initialSettings.data, ['0', 'type']) === 'geolocation')

  const myVessel = Leaf.marker([0, 0], {icon: resolveIcon(vesselIcons, initialSettings.zoom), draggable: false, zIndexOffset: 990, rotationOrigin: 'center center', rotationAngle: 0})
  myVessel.addTo(map)
  const pointerEnd = Leaf.circle([0, 0], {radius: 20, color: 'red', fillOpacity: 0})
  pointerEnd.addTo(map)
  const pointer = Leaf.polyline([], {color: 'red'})
  pointer.addTo(map)

  const vesselData = Bacon.combineTemplate({
    vesselData: dataConnection.selfData,
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
    const extensionLineCoordinates = calculateExtensionLine(position, course, speed, settings.extensionLine)
    if (extensionLineCoordinates) {
      pointer.setLatLngs([extensionLineCoordinates.start, extensionLineCoordinates.end])
      pointerEnd.setLatLng(extensionLineCoordinates.end)
    } else {
      pointer.setLatLngs([[0, 0], [0,0]])
      pointerEnd.setLatLng([0, 0])
    }
    if (settings.follow && (extensionLineCoordinates || position)) {
      const to = extensionLineCoordinates ? extensionLineCoordinates.middle : [position.latitude, position.longitude]
      if (map.getCenter().distanceTo(to) > 100) {
        map.panTo(to)
      }
    }
  })

  handleAisTargets({map, aisData: dataConnection.aisData, settings})
  handleDrawPath({map, settings, drawObject})
  handleMapZoom()
  handleDragAndFollow()
  handleInstrumentsToggle()
  showTracksOnMapMove()
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
      .changes()
      .merge(settings.map('.showMenu').changes())
      .skipDuplicates()
      .delay(250)
      .onValue(() => {
        map.invalidateSize(true)
      })
  }


  function showTracksOnMapMove () {
    const paths = ['navigation.speedOverGround', 'environment.depth.belowTransducer']
    Bacon.fromEvent(map, 'moveend')
      .map(() => map.getBounds())
      .skipDuplicates(_.isEqual)
      .flatMapLatest(bounds => {
        return trackConnection.queryTracks(bounds, paths)
      })
      .onValue(tracks => {
        const units = Bacon.combineAsArray(
          paths.map(path => trackConnection.getUnits(path).mapError((err) => "n/a"))
        )
        units.onValue(units => {
          renderTracks(map, tracks, paths, units)
        })
        units.onError((err) => {
          console.log(err)
        })
      })
  }
}

function handleAisTargets({map, aisData, settings}) {
  let aisMarkers = {}
  const aisTargetMarker = Leaf.icon({
    iconUrl: 'ais-target-medium.png',
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

function addCharts(map, providers) {
  _.each(providers, provider => {
    if (!_.includes(['tilelayer'], provider.type)) {
      console.error(`Unsupported chart type ${provider.type} for chart ${provider.name}`)
      return
    }
    if (!provider.tilemapUrl) {
      console.error(`Missing tilemapUrl for chart ${provider.name}`)
      return
    }
    const pane = `chart-${provider.index}`
    map.createPane(pane)
    const bounds = parseChartBounds(provider)
    Leaf.tileLayer(provider.tilemapUrl, {detectRetina: true, bounds, maxNativeZoom: provider.maxzoom, minNativeZoom: provider.minzoom, pane}).addTo(map)
    if (_.isArray(provider.center) && provider.center.length == 2) {
      map.panTo([provider.center[1], provider.center[0]])
    } else if (bounds) {
      map.fitBounds(bounds)
    }
  })
}

let trackLayers = []
const trackColors = [
  "#4c79a6",
  "#46a65b",
  "#a262a6",
]

function renderTracks (map, featureCollection, paths, units) {
  trackLayers.forEach(layer => map.removeLayer(layer))
  trackLayers = featureCollection.features.reduce((acc, feature, i) => {
    const dayIndex = feature.properties.starttime
      ? (new Date(feature.properties.starttime).getTime() / 86400000).toFixed()
      : 0
    const basicStyle = {
      color: trackColors[dayIndex % trackColors.length],
      stroke: 8
    }
    const geoJSONLayer = Leaf.geoJSON(feature, { style: basicStyle })
    geoJSONLayer.on('click', e =>
      geoJSONLayer.setStyle(_.assign({}, basicStyle, { weight: 6 }))
    )
    acc.push(geoJSONLayer)

    featureCollection.properties.dataPaths && featureCollection.properties.dataPaths.forEach((path, i) => {
      acc.push(toDataLayer(feature, path, units[i], i, featureCollection.properties.dataPaths.length))
    })
    return acc
  }, [])
  trackLayers.forEach(layer => layer.addTo(map))
}




function toDataLayer (feature, path, unit, pathIndex, pathsCount) {
  const valueColor = scaleLinear()
    .domain([2, 5, 10, 25])
    .range(['red', 'yellow', 'green', 'blue'])
  const circleStyles = [
    {
      radius: 4,
      fillOpacity: 1,
      fillColor: valueColor,
      color: () => '#000',
      opacity: 0
    },
    {
      radius: 8,
      fillOpacity: 0,
      fillColor: () => '#000',
      color: valueColor,
      opacity: 0.6
    }
  ]

  const points = []

  const circleStyle =
    circleStyles[(pathIndex + pathsCount - 1) % circleStyles.length]
  // [lat, lon, elev, timestamp, ...]
  const dataIndex = pathIndex + 4
  feature.geometry.coordinates.forEach(line => {
    line.forEach(coordinates => {
      if (coordinates.length >= dataIndex) {
        const circleMarker = Leaf.circleMarker(
          Leaf.latLng(coordinates[1], coordinates[0]),
          {
            radius: circleStyle.radius,
            weight: 5,
            fillOpacity: circleStyle.fillOpacity,
            fillColor: circleStyle.fillColor(coordinates[dataIndex]),
            color: circleStyle.color(coordinates[dataIndex]),
            opacity: circleStyle.opacity
          }
        )
        const displayValue = coordinates[dataIndex] ? coordinates[dataIndex].toFixed(2) : ""
        circleMarker.bindPopup(
          `<dl><dt>${path}</dt><dd>${displayValue} ${unit}</dd></dl><i>${new Date(coordinates[3])}</i>`
        )
        circleMarker.on('mouseover', e => {
          circleMarker.openPopup()
        })

        points.push(circleMarker)
      }
    })
  })
  return Leaf.layerGroup(points)
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
  baseMap.onError(e => console.log(`Unable to fetch base map`, e))
  baseMap.onValue(worldBaseGeoJSON => Leaf.geoJson(worldBaseGeoJSON, {clickable: false, style: basemapStyle, pane: 'basemap'}).addTo(map))
}

function calculateExtensionLine(position, course, speed, extensionLineSetting) {
  if (extensionLineSetting === EXTENSION_LINE_OFF) {
    return undefined
  }
  const time = 60 * parseInt(extensionLineSetting)
  if (position && position.latitude && position.longitude && course && speed > 0.5) {
    const distance = speed * time // Speed in m/s
    const start = [position.latitude, position.longitude]
    const destination = computeDestinationPoint({lat: position.latitude, lon: position.longitude}, distance, toDegrees(course))
    const middle = computeDestinationPoint({lat: position.latitude, lon: position.longitude}, distance / 2, toDegrees(course))
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
    throw new Error(`Unrecognized bounds format: ` + JSON.stringify(provider.bounds))
  }

  const corner1 = Leaf.latLng(provider.bounds[1], provider.bounds[0])
  const corner2 = Leaf.latLng(provider.bounds[3], provider.bounds[2])
  const bounds = Leaf.latLngBounds(corner1, corner2)
  if (!bounds.isValid()) {
    throw new Error(`Invalid bounds: ` + JSON.stringify(provider.bounds))
  }
  return bounds
}

module.exports = Map

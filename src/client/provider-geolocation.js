import Bacon from 'baconjs'
import _ from 'lodash'
import {toRadians} from './utils'

function connect({settings}) {
  const rawStream = new Bacon.Bus()

  if (!navigator.geolocation || !navigator.geolocation.watchPosition) {
    throw 'Missing geolocation API'
  }
  const success = (event) => {
    const position = {
      path: 'navigation.position',
      latitude: event.coords.latitude,
      longitude: event.coords.longitude
    }
    const sog = {
      path: 'navigation.speedOverGround',
      value: event.coords.speed
    }
    const heading = {
      path: 'navigation.headingTrue',
      value: toRadians(event.coords.heading)
    }
    const vesselData = {
      'navigation.position': position,
      'navigation.speedOverGround': sog,
      'navigation.headingTrue': heading,
    }
    rawStream.push(vesselData)
  }
  const error = (err) => {
    console.log('Geolocation error', err)
  }

  const options = {
    enableHighAccuracy: true,
    maximumAge: 5000
  }

  const watchID = navigator.geolocation.watchPosition(success, error, options)

  return {
    selfData: rawStream,
    aisData: Bacon.constant({})
  }
}

module.exports = connect



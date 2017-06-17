import _ from 'lodash'
import {MS_TO_KNOTS, M_TO_NM} from './enums'

function toDegrees(angle) {
  if (_.isFinite(angle)) {
    return angle * (180 / Math.PI)
  } else {
    return null
  }
}

function toRadians(angle) {
  if (_.isFinite(angle)) {
    return angle * Math.PI / 180
  } else {
    return null
  }
}

function toKnots(speed) {
  if (_.isFinite(speed)) {
    return speed * MS_TO_KNOTS
  } else {
    return null
  }
}

function toNauticalMiles(distance) {
  if (_.isFinite(distance)) {
    return distance * M_TO_NM
  } else {
    return null
  }
}

module.exports = {
  toDegrees,
  toRadians,
  toKnots,
  toNauticalMiles
}
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
    return (angle * Math.PI) / 180
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

/**
 * Convert hours to minutes and set negative values to zero
 * @param {Number} decimalHours - decimal value of hours
 * @return {Number} The amount of minutes.
 */
function toHhmm(decimalHours){
    let min = (decimalHours - Math.floor(decimalHours))*60;
    return Math.floor(decimalHours)+':'+Math.floor(min);
}


module.exports = {
  toDegrees,
  toRadians,
  toKnots,
  toNauticalMiles,
  toHhmm
}



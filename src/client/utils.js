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

/**
 * Find the distance between 2 location
 * @param {Number} - lat1 latitude of the source
 * @param {Number} - lon1 longitude of the source
 * @param {Number} - lat2 latitude of the target
 * @param {Number} - lon2 longitude of the target
 * @return {Number} The distance in Kilometers .
 */
function distanceBetweenCoordinates(lat1, lon1, lat2, lon2) {
  var earthRadiusKm = 6371;
  var dLat = toRadians(lat2-lat1);
  var dLon = toRadians(lon2-lon1);
  lat1 = toRadians(lat1);
  lat2 = toRadians(lat2);
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return earthRadiusKm * c;
}

/**
 * Find the bering of a target location form a source(mainly ship) location
 * @param {Number} - lat1 latitude of the source
 * @param {Number} - lon1 longitude of the source
 * @param {Number} - lat2 latitude of the target
 * @param {Number} - lon2 longitude of the target
 * @return {Number} The amount of degree offset .
 */
function beringBetweenCoordinates(lat1, lon1, lat2, lon2) {
  var y = Math.sin(lon2-lon1) * Math.cos(lat2);
  var x = Math.cos(lat1)*Math.sin(lat2) -
      Math.sin(lat1)*Math.cos(lat2)*Math.cos(lon2-lon1);
  var deg = toDegrees(Math.atan2(y, x))
  if( deg < 0 ){ // fixing strange result going out of the formula.
    deg = -deg
  }else{
    deg = ( 180 - deg ) + 180
  }
return deg
}

/**
 * Convert hours to minutes and set negative values to zero
 * @param {Number} decimalHours - decimal value of hours
 * @return {Number} The amount of minutes.
 */
function toHhmm(decimalHours){
  if (_.isFinite(decimalHours)) {
    if (decimalHours < 0) {
      decimalHours = 0;
    }
    return decimalHours*60
  }
}


module.exports = {
  beringBetweenCoordinates,
  distanceBetweenCoordinates,
  toDegrees,
  toRadians,
  toKnots,
  toNauticalMiles,
  toHhmm
}



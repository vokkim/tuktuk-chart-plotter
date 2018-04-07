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

function toHhmm(decimalHours){
  if (_.isFinite(decimalHours)) {
    if (decimalHours < 0) {
      decimalHours = 0;
    }
    var hh = Math.floor(decimalHours)
    var mm = Math.round(60 * (decimalHours - hh))
    if (mm < 10) {
      mm = '0' + mm;
    }
    console.log(hh + ':' + mm)

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



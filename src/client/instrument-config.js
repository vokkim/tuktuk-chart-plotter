import _ from 'lodash'
import {toDegrees, toKnots, toNauticalMiles, toHhmm} from './utils'

const InstrumentConfigs = {
  sog: {
    dataKey: 'navigation.speedOverGround',
    transformFn: toKnots,
    className: 'sog',
    title: 'SOG',
    unit: 'kn'
  },
  stw: {
    dataKey: 'navigation.speedThroughWater',
    transformFn: toKnots,
    className: 'stw',
    title: 'STW',
    unit: 'kn'
  },
  heading: {
    dataKey: 'navigation.headingTrue',
    transformFn: toDegrees,
    className: 'heading',
    title: 'HDG',
    format: '00',
    unit: '°'
  },
  cog: {
    dataKey: 'navigation.courseOverGroundTrue',
    transformFn: toDegrees,
    className: 'cog',
    title: 'COG',
    format: '00',
    unit: '°'
  },
  dbt: {
    dataKey: 'environment.depth.belowTransducer',
    transformFn: _.identity,
    className: 'dbt',
    title: 'Depth',
    format: '0.0',
    unit: 'm'
  },
  tws: {
    dataKey: 'environment.wind.speedTrue',
    transformFn: _.identity,
    className: 'tws',
    title: 'TWS',
    format: '0.0',
    unit: 'm'
  },
  aws: {
    dataKey: 'environment.wind.speedApparent',
    transformFn: _.identity,
    className: 'aws',
    title: 'AWS',
    format: '0.0',
    unit: 'm'
  },
  awaSog: {
    dataKey: 'environment.wind.angleApparent',
    transformFn: toDegrees,
    className: 'awa',
    title: 'AWA',
    format: '0',
    unit: '°'
  },
  awaWater: {
    dataKey: 'environment.wind.angleTrueWater',
    transformFn: toDegrees,
    className: 'awa',
    title: 'AWA (STW)',
    format: '0',
    unit: '°'
  },
  vmg: {
    dataKey: 'performance.vmg',
    transformFn: toKnots,
    className: 'vmg',
    title: 'VMG',
    format: '0.00',
    unit: 'kn'
  },
  eta: {
    dataKey: 'performance.eta',
    transformFn: toHhmm,
    className: 'eta',
    title: 'ETA',
    format: '0:00',
    unit: 'h'
  },
  dtw:{
    dataKey: 'performance.dtw',
    transformFn: toNauticalMiles,
    className: 'dtw',
    title: 'DTW',
    format: '0.00',
    unit: 'Nm'
  },
  btw:{
    dataKey: 'performance.btw',
    transformFn: toDegrees,
    className: 'btw',
    title: 'BTW',
    format: '0',
    unit: '°'
  }
}

module.exports = InstrumentConfigs

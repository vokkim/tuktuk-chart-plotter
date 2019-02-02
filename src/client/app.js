import React from 'baret'
import * as L from 'partial.lenses'
import Atom from 'bacon.atom'
import {render} from 'react-dom'
import numeral from 'numeral'
import classNames from 'classnames'
import DragSortableList from 'react-drag-sortable'
import Bacon from 'baconjs'
import _ from 'lodash'
import {
  COG,
  HDG,
  MAX_ZOOM,
  MIN_ZOOM,
  EXTENSION_LINE_OFF,
  EXTENSION_LINE_2_MIN,
  EXTENSION_LINE_5_MIN,
  EXTENSION_LINE_10_MIN
} from './enums'
import Map from './map'
import {getBearing} from 'geolib'
import Ais from './ais'
import Connection from './data-connection'
import { toRadians, toNauticalMiles, toKnots } from './utils'
import InstrumentConfig from './instrument-config'
import fullscreen from './fullscreen'
import {settings, clearSettingsFromLocalStorage} from './settings'
numeral.nullFormat('N/A')
fullscreen(settings)

const drawObject = Atom({distance: 0, del: false})
const connection = Connection({providers: settings.get().data, settings})

const Controls = ({settings, connectionState}) => {
  return (
    <div className="top-bar-controls">
      <div className="top-bar-controls-left">
        <TopBarButton
          className="menu"
          enabled={settings.view(L.prop('showMenu'))}
          iconClass="icon-menu"
          onClick={() => settings.view(L.prop('showMenu')).modify(v => !v)}
        />
      </div>
      <div className="top-bar-controls-center">
        {connectionState.map(state => {
          if (state === 'disconnected') {
            return <div className="connection-state disconnected">Signal K disconnected</div>
          } else {
            return null
          }
        })}
      </div>
      <div className="top-bar-controls-right">
        {<PathDrawControls settings={settings} />}
        <TopBarButton
            className='waypoint'
            enabled={settings.view(L.prop('waypoint'))}
            iconClass='icon-flag'
            onClick={onClickWaypoint} />
        <TopBarButton
          className='instruments'
          enabled={settings.view(L.prop('showInstruments'))}
          iconClass="icon-meter"
          onClick={() => settings.view(L.prop('showInstruments')).modify(v => !v)}
        />
        <TopBarButton
          className="follow"
          enabled={settings.view(L.prop('follow'))}
          iconClass="icon-target"
          onClick={() => settings.view(L.prop('follow')).modify(v => !v)}
        />
        <div className="zoom-buttons">
          <TopBarButton
            className="zoom-in"
            enabled={Bacon.constant(false)}
            iconClass="icon-plus"
            onClick={() => settings.view(L.prop('zoom')).modify(zoom => Math.min(zoom + 1, MAX_ZOOM))}
          />
          <TopBarButton
            className="zoom-out"
            enabled={Bacon.constant(false)}
            iconClass="icon-minus"
            onClick={() => settings.view(L.prop('zoom')).modify(zoom => Math.max(zoom - 1, MIN_ZOOM))}
          />
        </div>
        <TopBarButton
          className="fullscreen"
          enabled={settings.view(L.prop('fullscreen'))}
          iconClass="icon-fullscreen"
          onClick={() => settings.view(L.prop('fullscreen')).modify(v => !v)}
        />
      </div>
    </div>
  )
}

const Instruments = ({settings, data}) => {
  const classes = settings.map(v =>
    classNames('right-bar-instruments', {visible: v.showInstruments, hidden: !v.showInstruments})
  )
  const renderSingleInstrument = key => {
    const config = InstrumentConfig[key]
    if (!config) {
      return null
    }
    return (
      <Instrument
        key={key}
        value={data
          .map(v => v[config.dataKey])
          .skipDuplicates()
          .map(config.transformFn)}
        className={config.className}
        format={config.format}
        title={config.title}
        unit={config.unit}
      />
    )
  }
  return (
    <div className={classes}>
      <div className="wrapper">
        {settings
          .map('.instruments')
          .skipDuplicates()
          .map(instruments => _.map(instruments, renderSingleInstrument))}
      </div>
    </div>
  )
}

const PathDrawControls = ({settings}) => {
  const distance = drawObject
    .view(L.prop('distance'))
    .map(toNauticalMiles)
    .map(v => numeral(v).format('0.0'))
  return (
    <div className="path-draw-controls-wrapper">
      <div className={settings.map('.drawMode').map(v => classNames('path-draw-controls', {enabled: v, disabled: !v}))}>
        <button className="deletePath" onClick={() => drawObject.view(L.prop('del')).set(true)}>
          <i className="icon-bin" />
        </button>
        <div className="distance">{distance} nm</div>
      </div>
      <TopBarButton
        className="drawMode"
        enabled={settings.view(L.prop('drawMode'))}
        iconClass='icon-pencil2'
        onClick={onClickDraw}/>
    </div>
  )
}

const onClickDraw = function(){
  settings.view(L.prop('drawMode')).modify(v => !v)
  settings.view(L.prop('waypoint')).set(false)
}

const onClickWaypoint = function(){
  settings.view(L.prop('waypoint')).modify(v => !v)
  settings.view(L.prop('drawMode')).set(false)
}

const Instrument = ({value, format = '0.00', className, title, unit}) => {
  return (
    <div className={classNames('instrument', className)}>
      <div className="top-row">
        <div className="title">{title}</div>
        <div className="unit">{unit}</div>
      </div>
      <div className="value">{value.map(v => numeral(v).format(format))}</div>
    </div>
  )
}

const TopBarButton = ({enabled, className, iconClass, onClick}) => {
  return (
    <button
      className={enabled.map(v => classNames('top-bar-button', className, {enabled: v, disabled: !v}))}
      onClick={onClick}>
      <i className={iconClass} />
    </button>
  )
}

const MenuCheckbox = ({checked, label, className, onClick}) => {
  const classname = checked.subscribe
    ? checked.map(v => (v ? 'icon-checkbox-checked' : 'icon-checkbox-unchecked'))
    : checked
      ? 'icon-checkbox-checked'
      : 'icon-checkbox-unchecked'
  return (
    <button className={classNames('menu-checkbox', className)} onClick={onClick}>
      <span>{label}</span>
      <i className={classname} />
    </button>
  )
}

const MenuSwitch = ({label, valueLabel, className, onClick}) => {
  return (
    <button className={classNames('menu-switch', className)} onClick={onClick}>
      <span>{label}</span>
      <span>{valueLabel}</span>
    </button>
  )
}

const Menu = ({settings}) => {
  function toggleExtensionLine() {
    settings.view(L.prop('extensionLine')).modify(v => {
      const order = [EXTENSION_LINE_OFF, EXTENSION_LINE_2_MIN, EXTENSION_LINE_5_MIN, EXTENSION_LINE_10_MIN]
      return order[(order.indexOf(v) + 1) % 4]
    })
  }

  return (
    <div className={settings.map(v => classNames('left-bar-menu', {visible: v.showMenu, hidden: !v.showMenu}))}>
      <div className="wrapper">
        <div className="settings">
          <Accordion header="Options" openByDefault={true}>
            <MenuCheckbox
              className="ais"
              label="AIS Targets"
              checked={settings.view(
                L.compose(
                  L.prop('ais'),
                  L.prop('enabled')
                )
              )}
              onClick={() =>
                settings
                  .view(
                    L.compose(
                      L.prop('ais'),
                      L.prop('enabled')
                    )
                  )
                  .modify(v => !v)
              }
            />
            <MenuSwitch
              className="heading"
              label="Heading"
              valueLabel={settings.view(L.prop('course'))}
              onClick={() => settings.view(L.prop('course')).modify(v => (v === COG ? HDG : COG))}
            />
            <MenuSwitch
              label="Extension line"
              valueLabel={settings.view(L.prop('extensionLine'))}
              onClick={toggleExtensionLine}
            />
          </Accordion>
          <Accordion header="Instruments">
            <InstrumentSettings instrumentSettings={settings.view(L.prop('instruments'))} />
          </Accordion>
          <Accordion header="Charts">
            <ChartSettings chartProviders={settings.view(L.prop('chartProviders'))} />
          </Accordion>
          <button
            className="button reset-settings"
            onClick={() => {
              clearSettingsFromLocalStorage()
              window.location.reload()
            }}>
            Reset settings
          </button>
        </div>
        <div className="credits">
          <div className="github-link">
            <img src="GitHub-Mark-64px.png" />
            <a href="https://github.com/vokkim/tuktuk-chart-plotter">https://github.com/vokkim/tuktuk-chart-plotter</a>
          </div>
        </div>
      </div>
    </div>
  )
}

const ChartRow = ({provider, onClick}) => {
  const {id, name, enabled, description, minzoom, maxzoom} = provider
  return (
    <div
      className={classNames('charts-provider', {enabled: enabled, disabled: !enabled})}
      key={id || name}
      onClick={onClick}>
      <div>
        <p className="name">{name}</p>
        {description && <p className="description">{description}</p>}
        {minzoom &&
          maxzoom && (
            <p className="levels">
              Levels: {minzoom} - {maxzoom}
            </p>
          )}
      </div>
      <div>
        <i className={enabled ? 'icon-checkbox-checked' : 'icon-checkbox-unchecked'} />
      </div>
    </div>
  )
}

const ChartSettings = ({chartProviders}) => {
  const renderProviderRow = provider => {
    const onClick = () =>
      chartProviders
        .view(
          L.compose(
            L.find(p => p.id === provider.id),
            L.prop('enabled')
          )
        )
        .modify(v => !v)
    return <ChartRow provider={provider} onClick={onClick} />
  }

  return (
    <div className="charts">
      {chartProviders.map(providers => {
        if (_.isEmpty(providers)) {
          return <li>No charts</li>
        }
        return _.map(_.sortBy(providers, 'index'), renderProviderRow)
      })}
    </div>
  )
}

class InstrumentSettings extends React.Component {
  constructor(props) {
    super(props)
    const allConfigs = _.keys(InstrumentConfig)
    const initialInstruments = props.instrumentSettings.get()
    const initialSortOrder = _.sortBy(allConfigs, key => {
      const i = _.indexOf(initialInstruments, key)
      return i === -1 ? Number.MAX_VALUE : i
    })
    this._internalSort = Atom(initialSortOrder)
    this.unsub = this._internalSort.onValue(sortOrder => {
      this.props.instrumentSettings.modify(instruments => _.sortBy(instruments, key => _.indexOf(sortOrder, key)))
    })
  }

  componentWillUnmount() {
    this.unsub && this.unsub()
  }

  render() {
    const {_internalSort} = this
    const {instrumentSettings} = this.props
    const instruments = instrumentSettings.map(instruments => {
      const sortOrder = _internalSort.get()
      return _.map(sortOrder, key => {
        const config = InstrumentConfig[key]
        const selected = _.includes(instruments, key)
        const content = (
          <MenuCheckbox
            key={key}
            label={config.title}
            checked={selected}
            onClick={() =>
              instrumentSettings.modify(instruments => {
                if (selected) {
                  return _.filter(instruments, k => k !== key)
                } else {
                  return _.filter(sortOrder, k => k === key || _.includes(instruments, k))
                }
              })
            }
          />
        )
        return {content}
      })
    })

    function onSort(sortedElements) {
      const sortOrder = _(sortedElements)
        .sortBy(e => e.rank)
        .map(e => e.content.key)
        .value()
      _internalSort.set(sortOrder)
    }
    return (
      <div className="instrument-settings">
        {instruments.map(list => (
          // eslint-disable-next-line react/jsx-key
          <DragSortableList items={list} onSort={onSort} type="vertical" />
        ))}
      </div>
    )
  }
}

class Accordion extends React.Component {
  constructor(props) {
    super(props)
    this.state = {open: props.openByDefault || false}
  }
  render() {
    const {open} = this.state
    const {header, children, className} = this.props
    return (
      <div className={classNames('accordion', className, {open, closed: !open})}>
        <div className="accordion-header" onClick={this.toggleOpen.bind(this)}>
          <span>{header}</span>
          <i className="icon-circle-down" />
        </div>
        {open && <div className="accordion-content">{children}</div>}
      </div>
    )
  }
  toggleOpen() {
    this.setState({open: !this.state.open})
  }
}

const waypointInstrument = Bacon.combineTemplate({
  waypointInstrument : connection.selfData,
})

/**
 * This is calculation for 4 Instruments related to waypoint.
 * Dispite others instrument that display data from the signalK server.
 * Those four are generated inside upon new location, speed and course received from server.
 */
waypointInstrument.onValue(({waypointInstrument}) => {
  if (typeof waypointInstrument['navigation.position'] === 'object' && settings.leafletWaypoint !== false) {
    const wpPos = settings.leafletWaypoint._latlng

    var vesselPos = {}
    vesselPos.lat = waypointInstrument['navigation.position'].latitude
    vesselPos.lon = waypointInstrument['navigation.position'].longitude
    var dtw = wpPos.distanceTo(vesselPos)
    waypointInstrument['performance.dtw'] = dtw

    var diffBearing = getBearing(wpPos, vesselPos)
    if(diffBearing > 180 ){
      diffBearing = 180-(diffBearing-180) // make it display as the amount of offset degrees for both side
    }
    var vmgPercentage = 1-(diffBearing/90)
    var vmg = (waypointInstrument['navigation.speedOverGround']*vmgPercentage)

    waypointInstrument['performance.btw'] = toRadians(diffBearing)
    waypointInstrument['performance.vmg'] = vmg
    waypointInstrument['performance.eta'] =  toNauticalMiles(dtw)/toKnots(vmg);
  }
})




const App = (
  <div>
    <Controls settings={settings} connectionState={connection.connectionState} />
    <Menu settings={settings} />
    <Instruments settings={settings} data={connection.selfData} />
    {settings
      .view(L.prop('loadingChartProviders'))
      .skipDuplicates()
      .map(loading => {
        if (loading) {
          return (
            <div className="charts-loading map-wrapper">
              <h2>Loading ...</h2>
            </div>
          )
        } else {
          return (
            <div>
              <Map connection={connection} settings={settings} drawObject={drawObject} />
              <Ais connection={connection} settings={settings} />
            </div>
          )
        }
      })}
  </div>
)

render(App, document.getElementById('app'))

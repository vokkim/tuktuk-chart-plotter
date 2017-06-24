import React from 'baret'
import * as L from 'partial.lenses'
import Atom from 'bacon.atom'
import {render} from 'react-dom'
import numeral from 'numeral'
import classNames from 'classnames'
import Bacon from 'baconjs'
import _ from 'lodash'
import {COG, HDG, MAX_ZOOM, MIN_ZOOM, EXTENSION_LINE_OFF, EXTENSION_LINE_2_MIN, EXTENSION_LINE_5_MIN, EXTENSION_LINE_10_MIN} from './enums'
import Map from './map'
import Connection from './data-connection'
import {toDegrees, toNauticalMiles} from './utils'
import InstrumentConfig from './instrument-config'
import fullscreen from './fullscreen'
numeral.nullFormat('N/A')

const defaultSettings = {
  zoom: 13,
  fullscreen: false,
  drawMode: false,
  course: COG,
  follow: true,
  showMenu: false,
  extensionLine: EXTENSION_LINE_5_MIN,
  showInstruments: true,
  ais: {
    enabled: false
  },
  worldBaseChart: true,
  charts: [],
  data: []
}
const settings = Atom(_.assign(defaultSettings, window.INITIAL_SETTINGS || {}))
const drawObject = Atom({distance: 0, del: false})

const connection = Connection({providers: settings.get().data, settings})

fullscreen(settings)

const Controls = ({settings}) => {
  return (
    <div className='top-bar-controls'>
      <div className='top-bar-controls-left'>
        <TopBarButton
          className='menu'
          enabled={settings.view(L.prop('showMenu'))}
          iconClass='icon-menu'
          onClick={() => settings.view(L.prop('showMenu')).modify(v => !v)} />
      </div>
      <div className='top-bar-controls-center'></div>
      <div className='top-bar-controls-right'>
        {<PathDrawControls settings={settings} />}
        <TopBarButton
          className='instruments'
          enabled={settings.view(L.prop('showInstruments'))}
          iconClass='icon-meter'
          onClick={() => settings.view(L.prop('showInstruments')).modify(v => !v)} />
        <TopBarButton
          className='follow'
          enabled={settings.view(L.prop('follow'))}
          iconClass='icon-target'
          onClick={() => settings.view(L.prop('follow')).modify(v => !v)} />
        <div className='zoom-buttons'>
          <TopBarButton
            className='zoom-in'
            enabled={Bacon.constant(false)}
            iconClass='icon-plus'
            onClick={() => settings.view(L.prop('zoom')).modify(zoom => Math.min(zoom + 1, MAX_ZOOM))} />
          <TopBarButton
            className='zoom-out'
            enabled={Bacon.constant(false)}
            iconClass='icon-minus'
            onClick={() => settings.view(L.prop('zoom')).modify(zoom => Math.max(zoom - 1, MIN_ZOOM))} />
        </div>
        <TopBarButton
          className='fullscreen'
          enabled={settings.view(L.prop('fullscreen'))}
          iconClass='icon-fullscreen'
          onClick={() => settings.view(L.prop('fullscreen')).modify(v => !v)} />
      </div>
    </div>
  )
}

const Instruments = ({settings, data}) => {
  return (
    <div className={settings.map(v => classNames('right-bar-instruments', {visible: v.showInstruments, hidden: !v.showInstruments}))}>
      <div className='wrapper'>
        {_.map(InstrumentConfig, (config, key) =>
          <Instrument
          key={key}
          value={data.map(v => v[config.dataKey]).skipDuplicates().map(config.transformFn)}
          className={config.className}
          format={config.format}
          title={config.title}
          unit={config.unit} />
        )}
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
    <div className='path-draw-controls-wrapper'>
      <div className={settings.map('.drawMode').map(v => classNames('path-draw-controls', {enabled: v, disabled: !v}))}>
        <button className='deletePath' onClick={() => drawObject.view(L.prop('del')).set(true)}>
          <i className='icon-bin'/>
        </button>
        <div className='distance'>{distance} nm</div>
      </div>
      <TopBarButton
        className='drawMode'
        enabled={settings.view(L.prop('drawMode'))}
        iconClass='icon-pencil2'
        onClick={() => settings.view(L.prop('drawMode')).modify(v => !v)} />
    </div>
  )
}

const Instrument = ({value, format = '0.00', className, title, unit}) => {
  return (
    <div className={classNames('instrument', className)}>
      <div className='top-row'>
        <div className='title'>{title}</div>
        <div className='unit'>{unit}</div>
      </div>
      <div className='value'>{value.map(v => numeral(v).format(format))}</div>
    </div>
  )
}

const TopBarButton = ({enabled, className, iconClass, onClick}) => {
  return (
    <button className={enabled.map(v => classNames('top-bar-button', className, {enabled: v, disabled: !v}))}
      onClick={onClick}>
      <i className={iconClass} />
    </button>
  )
}

const MenuCheckbox = ({checked, label, className, onClick}) => {
  return (
    <button className={classNames('menu-checkbox', className)} onClick={onClick}>
      <span>{label}</span>
      <i className={checked.map(v => v ? 'icon-checkbox-checked' : 'icon-checkbox-unchecked')} />
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
      <div className='wrapper'>
        <div className='settings'>
          <Accordion header='Options' openByDefault={true}>
            <MenuCheckbox
              className='ais'
              label='AIS Targets'
              checked={settings.view(L.compose(L.prop('ais'), L.prop('enabled')))}
              onClick={() => settings.view(L.compose(L.prop('ais'), L.prop('enabled'))).modify(v => !v)} />
            <MenuSwitch
              className='heading'
              label='Heading'
              valueLabel={settings.view(L.prop('course'))}
              onClick={() => settings.view(L.prop('course')).modify(v => v === COG ? HDG : COG)} />
            <MenuSwitch
              label='Extension line'
              valueLabel={settings.view(L.prop('extensionLine'))}
              onClick={toggleExtensionLine} />
          </Accordion>
        </div>
        <div className='credits'>
          <div className='github-link'>
            <img src='/public/GitHub-Mark-64px.png' />
            <a href='https://github.com/vokkim/tuktuk-chart-plotter'>https://github.com/vokkim/tuktuk-chart-plotter</a>
          </div>
        </div>
      </div>
    </div>
  )
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
        <div className='accordion-header' onClick={this.toggleOpen.bind(this)}>
          <span>{header}</span>
          <i className='icon-circle-down'/>
        </div>
        {open && <div className='accordion-content'>{children}</div>}
      </div>
    )
  }
  toggleOpen() {
    this.setState({open: !this.state.open})
  }
}

const App = (
  <div>
    <Controls settings={settings}/>
    <Menu settings={settings}/>
    <Instruments settings={settings} data={connection.selfData}/>
    <Map connection={connection} settings={settings} drawObject={drawObject} />
  </div>
)

render(App, document.getElementById('app'))

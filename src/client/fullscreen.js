import screenfull from 'screenfull'
import * as L from 'partial.lenses'

module.exports = function(settings) {
  if (!screenfull.enabled) {
    return
  }

  settings
    .map('.fullscreen')
    .skip(1)
    .skipDuplicates()
    .onValue(val => {
      if (val && !screenfull.isFullscreen) {
        screenfull.request()
      }
      if (!val && screenfull.isFullscreen) {
        screenfull.exit()
      }
    })
  screenfull.onchange(() => {
    settings.view(L.prop('fullscreen')).set(screenfull.isFullscreen)
  })
}

import express from 'express'
import Bacon from 'baconjs'
import fs from 'fs'
import path from 'path'
import settings from './settings'
import chartRoutes from './chart-routes'

const app = express()

app.get('/', function(req, res) {
  const clientConfig = Bacon.fromNodeCallback(fs, 'readFile', settings.clientConfigFile)
    .flatMap(config => {
      try {
        return Bacon.once(JSON.parse(config))
      } catch (e) {
        return Bacon.once(new Bacon.Error(e))
      }
    })
    .flatMapError(err => {
      if (err.code === 'ENOENT') {
        console.log('No client config file found')
        return Bacon.once({})
      } else {
        console.error('Error loading client config file: ', err)
        return Bacon.once({})
      }
    })
  clientConfig.onValue(config => {
    res.send(createIndexHtml({config}))
  })
})

app.use('/', express.static(path.join(__dirname, '../../public')))

app.listen(settings.port, function() {
  console.log(`Listening ${settings.port}`)
})

app.use(chartRoutes)

function createIndexHtml({config}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Tuktuk Plotter</title>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="bundle.css"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, minimal-ui">
  <meta name="apple-mobile-web-app-capable" content="yes">
</head>
<body>
  <script type="text/javascript">
    window.INITIAL_SETTINGS = ${JSON.stringify(config)};
  </script>
  <div id="app"></div>
  <script src="bundle.js"></script>
</body>
</html>`
}

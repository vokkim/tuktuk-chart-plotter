import _ from 'lodash'
import path from 'path'

const environmentVariables = {
  port: process.env.PORT,
  production: process.env.NODE_ENV === 'production',
  chartsPath: process.env.CHARTS_PATH,
  clientConfigFile: process.env.CLIENT_CONFIG_FILE
}

const defaultSettings = {
  port: 4999,
  production: false,
  chartsPath: path.join(__dirname, '../../charts'),
  clientConfigFile: path.join(__dirname, '../../client-config.json')
}

const settings = _.merge(defaultSettings, environmentVariables)

console.log(`settings: ${JSON.stringify(settings, null, 2)}`)

module.exports = settings

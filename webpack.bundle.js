const path = require('path')
const webpack = require("webpack")

const production = process.env.NODE_ENV === 'production'

console.log('Webpack production mode: ', production)

module.exports = {
  bail: true,
  mode: production ? 'production' : 'development',
  entry: path.resolve(__dirname, 'src/client/app.js'),
  resolve: {
    modules: ["node_modules"],
  },
  module: {
    rules: [{
      test: /.js$/,
      loader: 'babel-loader',
      include: path.resolve(__dirname, "src")
    }]
  },
  plugins: production ? [new webpack.optimize.ModuleConcatenationPlugin()] : [],
  devtool: production ? 'none' : 'eval-source-map',
  output: {
    path: path.resolve(__dirname, 'public/'),
    filename: 'bundle.js'
  },
  externals: ['mdns']
}

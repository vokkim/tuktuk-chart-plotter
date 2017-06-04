const path = require('path')
const webpack = require("webpack")

module.exports = {
  bail: true,
  entry: path.resolve(__dirname, 'src/client/app.js'),
  resolve: {
    modules: ["node_modules"],
  },
  module: {
    loaders: [{
      test: /.js$/,
      loader: 'babel-loader'
    }]
  },
  devtool: 'nosources-source-map',
  output: {
    path: path.resolve(__dirname, 'public/'),
    filename: 'bundle.js'
  },
  externals: ['mdns']
}

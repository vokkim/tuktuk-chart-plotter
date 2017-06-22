import 'whatwg-fetch'
import Bacon from 'baconjs'

function checkStatus(response) {
  if (response.status >= 200 && response.status < 300) {
    return response
  } else {
    const error = new Error(response.statusText)
    error.response = response
    throw error
  }
}

function parseJSON(response) {
  return response.json()
}

function get({url, basicAuth}) {
  const request = fetch(url, basicAuth ? basicAuthHeaders(basicAuth) : undefined)
    .then(checkStatus)
    .then(parseJSON)
  return Bacon.fromPromise(request)
}

function basicAuthHeaders({username, password}) {
  return {
    headers: {
      'Authorization': 'Basic '+ btoa(`${username}:${password}`),
    }
  }
}

module.exports = {
  get
}

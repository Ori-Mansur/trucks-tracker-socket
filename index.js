import WebSocket from 'ws'
import express from 'express';
import * as http from 'http';

import MockDeviceLogger from './MockDeviceLogger.js'

const DEFAULT_PORT = 3000

const STARTING_LOCATIONS = [[40.104294, -116.427831],
                           [40.086186, -116.462942],
                           [40.120986, -116.356206],
                           [40.139038, -116.449662],
                           [40.001838, -116.350304]]

let PORT = process.argv.slice(2)[0] || DEFAULT_PORT

if (PORT) {
  PORT = parseInt(PORT, 10)
  if (!PORT) {
    PORT = DEFAULT_PORT
    console.log(`Port argument must be numeric! Defaulting to port ${DEFAULT_PORT}.`)
  }
}
const app = express();
const server = http.createServer(app);

const wss = new WebSocket.Server({
  server
})

const trucks = STARTING_LOCATIONS.map((location, index) => new MockDeviceLogger(100000000 + index, location[0], location[1]))

trucks.forEach(truck => { truck.startCollectingData() })

wss.on('connection', ws => {
  ws.on('message', message => {
    if (message === 'GOOGLE_KEY') {
      console.log('GOOGLE_KEY',process.env.GOOGLE_API_KEY)

      ws.send(process.env.GOOGLE_API_KEY);
    }
    if (message === 'START') {
      console.log('Received start signal, funneling device data to client')

      trucks.forEach(truck => { truck.startTransmitting(ws) })
    }
    if (message === 'STOP') {
      console.log('Received start signal, funneling device data to client')

      trucks.forEach(truck => { truck.stopTransmitting() })
    }
  })

  ws.on('error', error => {
    console.log(error)
  })

  ws.on('close', () => {
    console.log('Client closed connection')
    trucks.forEach(truck => { truck.stopTransmitting() })
  })
})


server.listen(PORT, () => {
  console.log(`Server started on port ${server.address().port} :)`);
});

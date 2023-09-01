/*
 * @FileDescription: ***
 * @Author: wu0304
 * @Date: 2023-08-29 17:53:23
 * @LastEditors: wu0304
 * @LastEditTime: 2023-08-30 18:07:27
 */
const http = require('http')
const videoServer = require('./signal_server')

const server = http.createServer()

videoServer.listen(server)

server.listen(3000, function () {
  console.log('Server listening on port 3000.')
})

const http = require('http')
const videoServer = require('./lib/video_server')

const server = http.createServer(function (request, response) {
    console.log(request, response)
})

videoServer.listen(server)

server.listen(3000, function () {
    console.log('Server listening on port 3000.')
})



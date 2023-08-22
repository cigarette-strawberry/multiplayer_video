const {Server} = require("socket.io");

let io = null
const nickNames = {}
const currentRoom = {}

exports.listen = function (server) {
    io = new Server(server)
    io.on('connection', (socket) => {
        handleRoomJoining(socket)
        joinRoom(socket)
        handleClientDisconnection(socket, nickNames) // 定义用户断开连接后的清除逻辑
    })
}

function handleRoomJoining(socket) {
    socket.on('join', function (room) {
        socket.leave(currentRoom[socket.id]) // 加入新房间前先离开房间
        joinRoom(socket, room.newRoom)
    })
}

function joinRoom(socket, room) {
    socket.join(room) // 让用户进入房间
    currentRoom[socket.id] = room // 记录用户的当前房间
    nickNames[socket.id] = name // 把用户昵称跟客户端连接 ID 关联上
    socket.emit('joinResult', {room: room}) // 让用户知道他们进入了新的房间

    // 让房间里的其他用户知道有新用户进入了房间
    socket.broadcast.to(room).emit('message', {
        text: nickNames[socket.id] + ' has joined ' + room + '.'
    })

    let usersInRoom = io.sockets.sockets // 确定有哪些用户在这个房间里
    if (usersInRoom.size > 1) { // 如果不止一个用户在这个房间里，汇总下都是谁
        socket.emit('message', {roomList: usersInRoom}) // 将房间里其他用户的汇总发送给这个用户
    }
}

function handleClientDisconnection(socket) {
    socket.on('disconnect', function () {
        let nameIndex = namesUsed.indexOf(nickNames[socket.id])
        delete nickNames[socket.id]
    })
}

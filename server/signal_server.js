/*
 * @FileDescription: ***
 * @Author: wu0304
 * @Date: 2023-08-31 22:45:57
 * @LastEditors: wu0304
 * @LastEditTime: 2023-09-02 00:13:14
 */
const { WebSocketServer } = require('ws')

// join 主动加入房间
// leave 主动离开房间
// new-peer 有人加入房间，通知已经在房间的人
// peer-leave 有人离开房间，通知已经在房间的人
// offer 发送offer给对端peer
// answer 发送offer给对端peer
// candidate 发送candidate给对端peer
const SIGNAL_TYPE_JOIN = 'join'
const SIGNAL_TYPE_RESP_JOIN = 'resp-join' // 告知加入者对方是谁
const SIGNAL_TYPE_LEAVE = 'leave'
const SIGNAL_TYPE_NEW_PEER = 'new-peer'
const SIGNAL_TYPE_PEER_LEAVE = 'peer-leave'
const SIGNAL_TYPE_OFFER = 'offer'
const SIGNAL_TYPE_ANSWER = 'answer'
const SIGNAL_TYPE_CANDIDATE = 'candidate'

exports.listen = function (server) {
  const websocket = new WebSocketServer({ server })
  websocket.on('connection', socket => {
    socket.on('message', function (message) {
      let jsonMsg = JSON.parse(message)
      console.log(jsonMsg)
      switch (jsonMsg.cmd) {
        case SIGNAL_TYPE_JOIN:
          socket.client = handleJoin(jsonMsg, socket) // 加入房间
          break
        case SIGNAL_TYPE_LEAVE:
          handleLeave(jsonMsg)
          break
        case SIGNAL_TYPE_OFFER:
          handleOffer(jsonMsg)
          break
        case SIGNAL_TYPE_ANSWER:
          handleAnswer(jsonMsg)
          break
        case SIGNAL_TYPE_CANDIDATE:
          handleCandidate(jsonMsg)
          break
      }
    })

    socket.on('close', function (code, reason) {
      if (socket.client != null) {
        handleLeave(socket.client)
      }
    })

    socket.on('error', function (err) {
      console.log('监听到错误:' + err)
    })
  })
}

/**
 * @description: 房间表
 * @return {*}
 */
class ZeroRTCMap {
  constructor() {
    this.entrys = [] // 定义一个空的map
  }

  // 定义一个add方法，用于添加键值对
  add(key, value) {
    // 获取key的索引
    let index = this._getIndex(key)
    // 如果索引为-1，则添加键值对
    if (index === -1) {
      let entry = {}
      entry.key = key
      entry.value = value
      this.entrys.push(entry)
    } else {
      // 如果索引不为-1，则更新键值对的值
      this.entrys[index].value = value
    }
  }
  // 定义一个get方法，用于获取指定键的值
  get(key) {
    // 获取key的索引
    let index = this._getIndex(key)
    // 返回索引不为-1，则返回键值对的值，否则返回null
    return index !== -1 ? this.entrys[index].value : null
  }
  // 定义一个remove方法，用于移除指定键的值
  remove(key) {
    // 获取key的索引
    let index = this._getIndex(key)
    // 如果索引不为-1，则移除键值对
    if (index !== -1) this.entrys.splice(index, 1)
  }
  // 定义一个clear方法，用于清空map
  clear() {
    this.entrys.length = 0
  }
  // 定义一个contains方法，用于检查map是否包含指定键
  contains(key) {
    // 获取key的索引
    let index = this._getIndex(key)
    // 返回索引不为-1
    return index !== -1
  }
  // 定义一个size方法，用于获取map的大小
  size() {
    // 返回map的长度
    return this.entrys.length
  }
  // 定义一个getEntrys方法，用于获取map的所有键值对
  getEntrys() {
    // 返回map的所有键值对
    return this.entrys
  }
  // 定义一个_getIndex方法，用于获取指定键的索引
  _getIndex(key) {
    // 如果key为空，则返回
    if (key == null) return
    // 获取map的长度
    let _length = this.entrys.length
    // 遍历map
    for (let i = 0; i < _length; i++) {
      let entry = this.entrys[i]
      // 如果entry为空，则跳过
      if (entry == null) continue
      // 如果entry的key和传入的key相等，则返回entry的索引
      if (entry.key === key) return i
    }
    return -1
  }
}

let roomTableMap = new ZeroRTCMap()

class Client {
  constructor(uid, socket, roomId) {
    this.uid = uid // 用户所属的id
    this.socket = socket // uid对应的websocket连接
    this.roomId = roomId
  }
}

/**
 * @description: 加入房间
 * @param {*} message
 * @param {*} socket
 * @return {*}
 */
function handleJoin(message, socket) {
  let roomId = message.roomId
  let uid = message.uid

  let roomMap = roomTableMap.get(roomId) // 查询是否存在当前的房间号
  // 如果房间没有创建，则新创建一个房间
  if (roomMap == null) {
    roomMap = new ZeroRTCMap() // 用来添加用户
    roomTableMap.add(roomId, roomMap) // 添加房间号
  }

  if (roomMap.size() >= 2) {
    console.log('roomId:' + roomId + ' 已经有两人存在，请使用其他房间')
    // 加信令通知客户端，房间已满
    return
  }

  let client = new Client(uid, socket, roomId)
  roomMap.add(uid, client) // 添加成员
  // 房间里面已经有人了，加上新进来的人，那就是>=2了，所以要通知对方
  if (roomMap.size() > 1) {
    let clients = roomMap.getEntrys()
    for (let i in clients) {
      let remoteUid = clients[i].key
      if (remoteUid !== uid) {
        // 通知房间中另一个人
        let jsonMsg = {
          cmd: SIGNAL_TYPE_NEW_PEER,
          remoteUid: uid
        }
        let msg = JSON.stringify(jsonMsg)
        let remoteClient = roomMap.get(remoteUid)
        remoteClient.socket.send(msg) // 发送给他人

        // 通知自己
        jsonMsg = {
          cmd: SIGNAL_TYPE_RESP_JOIN,
          remoteUid: remoteUid
        }
        msg = JSON.stringify(jsonMsg)
        socket.send(msg) // 发送给自己
      }
    }
  }

  return client
}

/**
 * @description: 离开房间
 * @param {*} message
 * @return {*}
 */
function handleLeave(message) {
  let roomId = message.roomId
  let uid = message.uid

  // 1. 先查找房间号
  let roomMap = roomTableMap.get(roomId)
  if (roomMap == null) return // 不存在当前房间号

  // 2. 判别uid是否在房间
  if (!roomMap.contains(uid)) return

  // 3.走到这一步，说明客户端没有正常离开，所以我们要执行离开程序
  roomMap.remove(uid) // 删除发送者
  if (roomMap.size() >= 1) {
    let clients = roomMap.getEntrys()
    for (let i in clients) {
      let jsonMsg = {
        cmd: SIGNAL_TYPE_PEER_LEAVE,
        remoteUid: uid // 谁离开就填写谁
      }
      let msg = JSON.stringify(jsonMsg)
      let remoteUid = clients[i].key
      let remoteClient = roomMap.get(remoteUid)
      if (remoteClient) remoteClient.socket.send(msg) // 通知离开房间
    }
  }
}

function handleOffer(message) {
  let roomId = message.roomId
  let uid = message.uid
  let remoteUid = message.remoteUid

  console.log('handleOffer uid: ' + uid + 'transfer  offer  to remoteUid' + remoteUid)

  let roomMap = roomTableMap.get(roomId)
  if (roomMap == null) {
    console.log("handleOffer can't find then roomId " + roomId)
    return
  }

  if (roomMap.get(uid) == null) {
    console.log("handleOffer can't find then uid " + uid)
    return
  }

  let remoteClient = roomMap.get(remoteUid)
  if (remoteClient) {
    let msg = JSON.stringify(message)
    remoteClient.socket.send(msg) //把数据发送给对方
  } else {
    console.log("can't find remoteUid： " + remoteUid)
  }
}

function handleAnswer(message) {
  let roomId = message.roomId
  let uid = message.uid
  let remoteUid = message.remoteUid

  console.log('handleAnswer uid: ' + uid + 'transfer answer  to remoteUid' + remoteUid)

  let roomMap = roomTableMap.get(roomId)
  if (roomMap == null) {
    console.log("handleAnswer can't find then roomId " + roomId)
    return
  }

  if (roomMap.get(uid) == null) {
    console.log("handleAnswer can't find then uid " + uid)
    return
  }

  let remoteClient = roomMap.get(remoteUid)
  if (remoteClient) {
    let msg = JSON.stringify(message)
    remoteClient.socket.send(msg)
  } else {
    console.log("can't find remoteUid： " + remoteUid)
  }
}

function handleCandidate(message) {
  let roomId = message.roomId
  let uid = message.uid
  let remoteUid = message.remoteUid

  console.log('handleCandidate uid: ' + uid + 'transfer candidate  to remoteUid' + remoteUid)

  let roomMap = roomTableMap.get(roomId)
  if (roomMap == null) {
    console.log("handleCandidate can't find then roomId " + roomId)
    return
  }

  if (roomMap.get(uid) == null) {
    console.log("handleCandidate can't find then uid " + uid)
    return
  }

  let remoteClient = roomMap.get(remoteUid)
  if (remoteClient) {
    let msg = JSON.stringify(message)
    remoteClient.socket.send(msg)
  } else {
    console.log("can't find remoteUid： " + remoteUid)
  }
}

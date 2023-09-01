'use strict'

// join 主动加入房间
// resp-join 告知加入者对方是谁
// leave 主动离开房间
// new-peer 有人加入房间，通知已经在房间的人
// peer-leave 有人离开房间，通知已经在房间的人
// offer 发送offer给对端peer
// answer 发送offer给对端peer
// candidate 发送candidate给对端peer
const SIGNAL_TYPE_JOIN = 'join'
const SIGNAL_TYPE_RESP_JOIN = 'resp-join'
const SIGNAL_TYPE_LEAVE = 'leave'
const SIGNAL_TYPE_NEW_PEER = 'new-peer'
const SIGNAL_TYPE_PEER_LEAVE = 'peer-leave'
const SIGNAL_TYPE_OFFER = 'offer'
const SIGNAL_TYPE_ANSWER = 'answer'
const SIGNAL_TYPE_CANDIDATE = 'candidate'

let localUserId = Math.random().toString(36).substring(2) // 本地uid
let remoteUserId = -1 // 对端
let roomId = 0

let localVideo = document.querySelector('#localVideo')
let remoteVideo = document.querySelector('#remoteVideo')
let localStream = null
let remoteStream = null
let pc = null

class ZeroRTCEngine {
  constructor(wsUrl) {
    this.wsUrl = wsUrl // 设置 websocket url
    this.websocket = null // websocket对象
  }

  createWebsocket() {
    this.websocket = new WebSocket(this.wsUrl)

    this.websocket.onopen = () => {
      this.onOpen()
    }

    this.websocket.onmessage = ev => {
      this.onMessage(ev)
    }

    this.websocket.onerror = ev => {
      this.onError(ev)
    }

    this.websocket.onclose = ev => {
      this.onClose(ev)
    }
  }

  onOpen() {
    console.log('websocket open')
  }

  onMessage(event) {
    console.log('onMessage: ' + event.data)
    let jsonMsg = null
    try {
      jsonMsg = JSON.parse(event.data)
      console.log(jsonMsg)
    } catch (e) {
      console.warn('onMessage parse Json failed:' + e)
      return
    }

    switch (jsonMsg.cmd) {
      case SIGNAL_TYPE_NEW_PEER:
        handleRemoteNewPeer(jsonMsg)
        break
      case SIGNAL_TYPE_RESP_JOIN:
        handleResponseJoin(jsonMsg)
        break
      case SIGNAL_TYPE_PEER_LEAVE:
        handleRemotePeerLeave(jsonMsg)
        break
      case SIGNAL_TYPE_OFFER:
        handleRemoteOffer(jsonMsg)
        break
      case SIGNAL_TYPE_ANSWER:
        handleRemoteAnswer(jsonMsg)
        break
      case SIGNAL_TYPE_CANDIDATE:
        handleRemoteCandidate(jsonMsg)
        break
    }
  }

  onError(event) {
    console.log('onError: ' + event.data)
  }

  onClose(event) {
    console.log('onClose -> code: ' + event.code + ', reason:' + EventTarget.reason)
  }

  sendMessage(message) {
    this.websocket.send(message)
  }
}

let zeroRTCEngine = new ZeroRTCEngine('ws://localhost:3000')
zeroRTCEngine.createWebsocket()

function handleIceCandidate(event) {
  console.info('handleIceCandidate')
  if (event.candidate) {
    let candidateJson = {
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    }
    let jsonMsg = {
      cmd: SIGNAL_TYPE_CANDIDATE,
      roomId: roomId,
      uid: localUserId,
      remoteUid: remoteUserId,
      msg: JSON.stringify(candidateJson)
    }
    let message = JSON.stringify(jsonMsg)
    zeroRTCEngine.sendMessage(message)
    console.info('handleIceCandidate message: ' + message)
    console.info('send candidate message')
  } else {
    console.warn('End of candidates')
  }
}

function handleRemoteStreamAdd(event) {
  console.info('handleRemoteStreamAdd')
  remoteStream = event.streams[0]
  remoteVideo.srcObject = remoteStream
}

function handleConnectionStateChange() {
  if (pc != null) {
    console.info('ConnectionState -> ' + pc.connectionState)
  }
}

function handleIceConnectionStateChange() {
  if (pc != null) {
    console.info('IceConnectionState -> ' + pc.iceConnectionState)
  }
}

function createPeerConnection() {
  let defaultConfiguration = {
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceTransportPolicy: 'all', //relay 或者
    // 修改ice数组测试效果，需要进行封装
    iceServers: [
      {
        urls: [
          'turn:192.168.0.143:3478?transport=udp',
          'turn:192.168.0.143:3478?transport=tcp' // 可以插入多个进行备选
        ],
        username: 'lqf',
        credential: '123456'
      },
      {
        urls: ['stun:192.168.0.143:3478']
      }
    ]
  }

  pc = new RTCPeerConnection(defaultConfiguration) // 音视频通话的核心类
  pc.onicecandidate = handleIceCandidate
  pc.ontrack = handleRemoteStreamAdd
  pc.onconnectionstatechange = handleConnectionStateChange
  pc.oniceconnectionstatechange = handleIceConnectionStateChange

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream)) // 把本地流设置给RTCPeerConnection
}

function createOfferAndSendMessage(session) {
  pc.setLocalDescription(session)
    .then(function () {
      let jsonMsg = {
        cmd: 'offer',
        roomId: roomId,
        uid: localUserId,
        remoteUid: remoteUserId,
        msg: JSON.stringify(session)
      }
      let message = JSON.stringify(jsonMsg)
      zeroRTCEngine.sendMessage(message)
      // console.info("send offer message: " + message);
      console.info('send offer message')
    })
    .catch(function (error) {
      console.error('offer setLocalDescription failed: ' + error)
    })
}

function handleCreateOfferError(error) {
  console.error('handleCreateOfferError: ' + error)
}

function createAnswerAndSendMessage(session) {
  pc.setLocalDescription(session)
    .then(function () {
      let jsonMsg = {
        cmd: 'answer',
        roomId: roomId,
        uid: localUserId,
        remoteUid: remoteUserId,
        msg: JSON.stringify(session)
      }
      let message = JSON.stringify(jsonMsg)
      zeroRTCEngine.sendMessage(message)
      // console.info("send answer message: " + message);
      console.info('send answer message')
    })
    .catch(function (error) {
      console.error('answer setLocalDescription failed: ' + error)
    })
}

function handleCreateAnswerError(error) {
  console.error('handleCreateAnswerError: ' + error)
}

/* let ZeroRTCEngine = function (wsUrl) {
  this.init(wsUrl)
  zeroRTCEngine = this
  return this
}

ZeroRTCEngine.prototype.init = function (wsUrl) {
  // 设置websocket  url
  this.wsUrl = wsUrl
  // websocket对象
  this.signaling = null
}

ZeroRTCEngine.prototype.createWebsocket = function () {
  zeroRTCEngine = this
  zeroRTCEngine.signaling = new WebSocket('ws://localhost:3000')

  zeroRTCEngine.signaling.onopen = function () {
    zeroRTCEngine.onOpen()
  }

  zeroRTCEngine.signaling.onmessage = function (ev) {
    zeroRTCEngine.onMessage(ev)
  }

  zeroRTCEngine.signaling.onerror = function (ev) {
    zeroRTCEngine.onError(ev)
  }

  zeroRTCEngine.signaling.onclose = function (ev) {
    zeroRTCEngine.onClose(ev)
  }
}

ZeroRTCEngine.prototype.onOpen = function () {
  console.log('websocket open')
}

ZeroRTCEngine.prototype.onMessage = function (event) {
  console.log('onMessage: ' + event.data)
  let jsonMsg = null
  try {
    jsonMsg = JSON.parse(event.data)
  } catch (e) {
    console.warn('onMessage parse Json failed:' + e)
    return
  }

  switch (jsonMsg.cmd) {
    case SIGNAL_TYPE_NEW_PEER:
      handleRemoteNewPeer(jsonMsg)
      break
    case SIGNAL_TYPE_RESP_JOIN:
      handleResponseJoin(jsonMsg)
      break
    case SIGNAL_TYPE_PEER_LEAVE:
      handleRemotePeerLeave(jsonMsg)
      break
    case SIGNAL_TYPE_OFFER:
      handleRemoteOffer(jsonMsg)
      break
    case SIGNAL_TYPE_ANSWER:
      handleRemoteAnswer(jsonMsg)
      break
    case SIGNAL_TYPE_CANDIDATE:
      handleRemoteCandidate(jsonMsg)
      break
  }
}

ZeroRTCEngine.prototype.onError = function (event) {
  console.log('onError: ' + event.data)
}

ZeroRTCEngine.prototype.onClose = function (event) {
  console.log('onClose -> code: ' + event.code + ', reason:' + EventTarget.reason)
}

ZeroRTCEngine.prototype.sendMessage = function (message) {
  this.signaling.send(message)
} */

function handleResponseJoin(message) {
  console.info('handleResponseJoin, remoteUid: ' + message.remoteUid)
  remoteUserId = message.remoteUid
  // doOffer()
}

function handleRemotePeerLeave(message) {
  console.info('handleRemotePeerLeave, remoteUid: ' + message.remoteUid)
  remoteVideo.srcObject = null
  if (pc != null) {
    pc.close()
    pc = null
  }
}

function handleRemoteNewPeer(message) {
  console.info('handleRemoteNewPeer, remoteUid: ' + message.remoteUid)
  remoteUserId = message.remoteUid
  doOffer()
}

function handleRemoteOffer(message) {
  console.info('handleRemoteOffer')
  if (pc == null) {
    createPeerConnection()
  }
  let desc = JSON.parse(message.msg)
  pc.setRemoteDescription(desc)
  doAnswer()
}

function handleRemoteAnswer(message) {
  console.info('handleRemoteAnswer')
  let desc = JSON.parse(message.msg)
  pc.setRemoteDescription(desc)
}

function handleRemoteCandidate(message) {
  console.info('handleRemoteCandidate')
  let jsonMsg = JSON.parse(message.msg)
  let candidateMsg = {
    sdpMLineIndex: jsonMsg.label,
    sdpMid: jsonMsg.id,
    candidate: jsonMsg.candidate
  }
  let candidate = new RTCIceCandidate(candidateMsg)
  pc.addIceCandidate(candidate).catch(e => {
    console.error('addIceCandidate failed:' + e.name)
  })
}

function doOffer() {
  // 创建RTCPeerConnection
  if (pc == null) {
    createPeerConnection()
  }
  pc.createOffer().then(createOfferAndSendMessage).catch(handleCreateOfferError)
}

function doAnswer() {
  pc.createAnswer().then(createAnswerAndSendMessage).catch(handleCreateAnswerError)
}

function hangup() {
  localVideo.srcObject = null // 0.关闭自己的本地显示
  remoteVideo.srcObject = null // 1.不显示对方
  closeLocalStream() // 2. 关闭本地流
  if (pc != null) {
    pc.close() // 3.关闭RTCPeerConnection
    pc = null
  }
}

function closeLocalStream() {
  if (localStream != null) {
    localStream.getTracks().forEach(track => {
      track.stop()
    })
  }
}

/**
 * @description: 点击按钮
 * @param {*} joinBtn
 * @return {*}
 */
document.getElementById('joinBtn').onclick = function () {
  roomId = document.getElementById('zero-roomId').value
  if (roomId === '') {
    alert('请输入房间ID')
    return
  }
  openLocalStream()
}

/**
 * @description: 打开摄像头和麦克风
 * @return {*}
 */
function openLocalStream() {
  navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: true
    })
    .then(initLocalStream)
    .catch(function (e) {
      alert('getUserMedia() error: ' + e.name)
    })
}

/**
 * @description: 初始化本地码流
 * @param {*} stream
 * @return {*}
 */
function initLocalStream(stream) {
  localVideo.srcObject = stream // 显示画面
  localStream = stream // 保存本地流的句柄
  doJoin(roomId)
}

/**
 * 加入房间
 * @param {*} roomId
 * @return {*}
 */
function doJoin(roomId) {
  let jsonMsg = {
    cmd: SIGNAL_TYPE_JOIN,
    roomId: roomId,
    uid: localUserId
  }
  let message = JSON.stringify(jsonMsg)
  zeroRTCEngine.sendMessage(message)
}

/**
 * @description: 离开按钮
 * @param {*} leaveBtn
 * @return {*}
 */
document.getElementById('leaveBtn').onclick = function () {
  doLeave()
}

/**
 * @description: 离开房间
 * @return {*}
 */
function doLeave() {
  let jsonMsg = {
    cmd: SIGNAL_TYPE_LEAVE,
    roomId: roomId,
    uid: localUserId
  }
  let message = JSON.stringify(jsonMsg)
  zeroRTCEngine.sendMessage(message)
  hangup()
}

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

/*********WebSocket*********/
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
    let jsonMsg = null
    try {
      jsonMsg = JSON.parse(event.data)
    } catch (e) {
      console.error('onMessage parse Json failed:' + e)
      return
    }

    switch (jsonMsg.cmd) {
      case SIGNAL_TYPE_RESP_JOIN:
        handleResponseJoin(jsonMsg)
        break
      case SIGNAL_TYPE_NEW_PEER:
        handleRemoteNewPeer(jsonMsg)
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
      case SIGNAL_TYPE_PEER_LEAVE:
        handleRemotePeerLeave(jsonMsg)
        break
    }
  }

  onError(event) {
    console.error('onError: ' + event.data)
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

/*********加入离开房间*********/
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

/*********WebRTC*********/

function handleResponseJoin(message) {
  remoteUserId = message.remoteUid
}

function handleRemoteNewPeer(message) {
  remoteUserId = message.remoteUid
  doOffer()
}

function doOffer() {
  // 创建RTCPeerConnection
  if (pc == null) {
    createPeerConnection()
  }
  // createOffer 用于创建一个建议的本地ICE候选。这个方法会返回一个RTCSessionDescription对象，其中包含了一个建议的连接参数。
  pc.createOffer().then(createOfferAndSendMessage).catch(handleCreateOfferError)
}

function createOfferAndSendMessage(session) {
  // setLocalDescription 用于设置本地ICE候选为当前的连接参数。
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
    })
    .catch(function (error) {
      console.error('offer setLocalDescription failed: ' + error)
    })
}

function handleCreateOfferError(error) {
  console.error('handleCreateOfferError: ' + error)
}

function handleRemoteOffer(message) {
  if (pc == null) {
    createPeerConnection()
  }
  let desc = JSON.parse(message.msg)
  // setRemoteDescription 用于设置远程ICE候选为当前的连接参数。
  pc.setRemoteDescription(desc)
  doAnswer()
}

function doAnswer() {
  // createAnswer 用于创建一个回答的本地ICE候选。这个方法会返回一个RTCSessionDescription对象，其中包含了一个回答的连接参数。
  pc.createAnswer().then(createAnswerAndSendMessage).catch(handleCreateAnswerError)
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
    })
    .catch(function (error) {
      console.error('answer setLocalDescription failed: ' + error)
    })
}

function handleCreateAnswerError(error) {
  console.error('handleCreateAnswerError: ' + error)
}

function handleRemoteAnswer(message) {
  let desc = JSON.parse(message.msg)
  pc.setRemoteDescription(desc)
}

function handleRemoteCandidate(message) {
  let jsonMsg = JSON.parse(message.msg)
  let candidateMsg = {
    sdpMLineIndex: jsonMsg.label,
    sdpMid: jsonMsg.id,
    candidate: jsonMsg.candidate
  }
  // RTCIceCandidate() 构造函数用于创建一个新的 RTCIceCandidate 对象。这个对象表示一个 candidate 服务器，它用于在 WebRTC 连接中参与 ICE 过程。
  let candidate = new RTCIceCandidate(candidateMsg)
  // addIceCandidate 用于添加一个ICE候选到当前的连接参数。
  pc.addIceCandidate(candidate).catch(e => {
    console.error('addIceCandidate failed:' + e.name)
  })
}

function handleRemotePeerLeave(message) {
  console.log('handleRemotePeerLeave, remoteUid: ' + message.remoteUid)
  remoteVideo.srcObject = null
  if (pc != null) {
    pc.close()
    pc = null
  }
}

/*********创建 RTCPeerConnection*********/
function createPeerConnection() {
  let defaultConfiguration = {
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceTransportPolicy: 'all', //relay 或者
    // 修改ice数组测试效果，需要进行封装
    iceServers: [
      /* {
        urls: [
          'turn:192.168.0.143:3478?transport=udp',
          'turn:192.168.0.143:3478?transport=tcp' // 可以插入多个进行备选
        ],
        username: 'lqf',
        credential: '123456'
      },
      {
        urls: ['stun:192.168.0.143:3478']
      } */
    ]
  }

  pc = new RTCPeerConnection(defaultConfiguration) // 音视频通话的核心类
  // onicecandidate 用于监听当本地或远程的ICE（交互式连接建立）候选生成时触发。当新的ICE候选被生成时，RTCPeerConnection会触发一个icecandidate事件，事件对象的candidate属性包含候选信息，可以用于建立连接。
  pc.onicecandidate = handleIceCandidate

  // ontrack 用于监听当远程的媒体流（track）被添加到连接时触发。当远程的媒体流被添加到连接中时，RTCPeerConnection会触发一个track事件，事件对象的track属性包含媒体流信息，可以用于处理和显示该媒体流。
  pc.ontrack = handleRemoteStreamAdd

  // onconnectionstatechange 用于监听当连接的状态发生变化时触发。当连接的状态发生变化时，RTCPeerConnection会触发一个connectionstatechange事件，事件对象的state属性包含连接的新状态。
  pc.onconnectionstatechange = handleConnectionStateChange

  // oniceconnectionstatechange 用于监听当ICE连接的状态发生变化时触发。当ICE连接的状态发生变化时，RTCPeerConnection会触发一个iceconnectionstatechange事件，事件对象的state属性包含ICE连接的新状态。
  pc.oniceconnectionstatechange = handleIceConnectionStateChange

  // MediaStream.getTracks() 是一个用于获取当前播放的音频或视频 tracks（音频或视频流中的独立音频或视频流）的 MediaStream 方法。它返回一个包含 MediaTrack 对象的数组，每个对象表示一个 tracks。
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream)) // 把本地流设置给RTCPeerConnection
  // RTCPeerConnection.addTrack() 方法用于将一个音频或视频 track 添加到 RTCPeerConnection。这个方法接受两个参数：一个 MediaStreamTrack 对象和一个 RTCTrackDescription 对象。MediaStreamTrack 对象表示要添加的 track，RTCTrackDescription 对象表示要添加的 track 的类型和配置。
}

/**
 * @description: 发送 candidate
 * @param {*} event
 * @return {*}
 */
function handleIceCandidate(event) {
  console.log('handleIceCandidate', event)
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
  } else {
    console.warn('End of candidates')
  }
}

function handleRemoteStreamAdd(event) {
  remoteStream = event.streams[0]
  remoteVideo.srcObject = remoteStream
}

function handleConnectionStateChange() {
  if (pc != null) {
    console.log('ConnectionState -> ' + pc.connectionState)
  }
}

function handleIceConnectionStateChange() {
  if (pc != null) {
    console.log('IceConnectionState -> ' + pc.iceConnectionState)
  }
}

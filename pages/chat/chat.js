// pages/chat/chat.js
var app = getApp();
let SocketTask = {}, delayTime;
// 输入框
let chatInput = require('../../modules/chat-input/chat-input');
Page({
  /**
   * 页面的初始数据
   */
  data: {
    isAuth: false,
    userInfo: null,
    textMessage: '', // 输入框val
    chatItems: [], // 消息list
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    let that = this,
      typeId = wx.getStorageSync('openid'),
      chatItems = wx.getStorageSync('chatItems_' + typeId),
      cardArr = [1007, 1008, 1036, 1044, 1073, 1074, 1091]; // 场景值
    that.initData();
    // 获取缓存中是否有消息记录
    that.setData({
      chatItems: (chatItems ? JSON.parse(chatItems) : [])
    })
    if (that.data.chatItems.length) {
      setTimeout(() => {
        that.bottom();
      }, 1000)
    }
    // 转发出去的卡片进入后手动关闭websoket并注空
    cardArr.forEach(function (v) {
      if (app.globalData.scene == v) {
        // SocketTask.close()
        SocketTask = {};
      }
    })
  },
  onShow() {
    if (SocketTask.readyState !== 0 && SocketTask.readyState !== 1) {
      console.log('开始尝试连接WebSocket！readyState=' + SocketTask.readyState)
      this.initWebSoket()
    }
  },
  onHide(){
    // SocketTask.close(function (close) {
    //   console.log('关闭 WebSocket 连接。', close)
    //   SocketTask = {};
    // })
    // 缓存消息记录
    let typeId = wx.getStorageSync('openid'),
        chatItems = JSON.stringify(this.data.chatItems);
    wx.setStorageSync('chatItems_' + typeId, chatItems);
  },
  /**
   * 初始化数据
   */
  initData() {
    let that = this;
    that.data.systemInfo = app.globalData.systemInfo; // 获取当前手机信息
    // 初始化输入框
    chatInput.init(this, {
      systemInfo: that.data.systemInfo,
      minVoiceTime: 1, // 最小语音时间
      maxVoiceTime: 60, // 最大语音时间
      startTimeDown: 50, // 开始计时
    });
    // 记录当前手机屏幕高度
    that.setData({
      systemInfo: that.data.systemInfo,
      userInfo: wx.getStorageSync('userInfo'),
      isAuth: wx.getStorageSync('userInfo')?false:true
    });
    // 监听文本/语音
    that.textButton();
    that.voiceButton();
    // 权限询问
    that.getRecordAuth();
  },
  // 初始化websoket
  initWebSoket() {
    let that = this;
    // 判断是否是首次进入
    let isFirst = Object.keys(SocketTask);
    // 创建Socket
    // SocketTask = wx.connectSocket({
    //   url: '', // websoket地址
    //   data: 'data',
    //   header: {
    //     'content-type': 'application/json'
    //   },
    //   method: 'post',
    //   success: function (res) {
    //     console.log('WebSocket连接创建', res)
    //   },
    //   fail: function (err) {
    //     wx.showToast({
    //       title: '网络异常！',
    //     })
    //     console.log(err)
    //   },
    // })
    // SocketTask.onOpen(res => {
    //   // 监听心跳
    //   // that.watchMessageHeartBeat();
    //   console.log('监听 WebSocket 连接打开事件。', res)
    // })
    // SocketTask.onClose(onClose => {
    //   console.log('WebSocket连接已关闭！readyState=' + SocketTask.readyState)
    //   if (SocketTask.readyState !== 0 && SocketTask.readyState !== 1) {
    //     setTimeout(function () {
    //       that.initWebSoket()
    //     }, 300)
    //   }
    // })
    // SocketTask.onError(onError => {
    //   console.log('监听 WebSocket 错误。错误信息', onError)
    // })
    // SocketTask.onMessage(onMessage => {
      // 清除定时器
      // clearTimeout(delayTime);
      // 监听心跳
      // that.watchMessageHeartBeat();
    // })
  },
  //传递消息
  sendSocketMessage(msg) {
    let that = this;
    if (msg){
      that.data.chatItems.push({ isMy: true, content: msg, time: that.getCacheIndex() })
      that.setData({
        chatItems: that.data.chatItems
      })
      that.bottom();
      var onMessage = { content: msg, errorcode: 200  };
      if (!onMessage) {
        that.data.chatItems.push({ isMy: false, content: '未帮您查询到信息', time: that.getCacheIndex() });
        that.setData({
          chatItems: that.data.chatItems
        })
        setTimeout(() => {
          that.bottom();
        }, 300)
        return;
      }
      if (onMessage.errorcode == 200) {
        that.data.chatItems.push({ isMy: false, content: onMessage.content, time: that.getCacheIndex() });
        that.setData({
          chatItems: that.data.chatItems
        })
        setTimeout(() => {
          that.bottom();
        }, 300)
      } else {
        wx.showToast({
          icon: 'none',
          title: '消息接收失败',
        })
      }
    }
  },
  // 发送文本消息 输入监听
  textButton() {
    let that = this;
    chatInput.setTextMessageListener(function (e) {
      let content = e.detail.value; //输入的文本信息
      that.sendSocketMessage(content)
    });
  },
  // 发送语音消息
  voiceButton() {
    var that = this;
    chatInput.recordVoiceListener(function (res) {
      if (!res.result){
        wx.showToast({
          icon: 'none',
          title: '请说话',
        })
      }else{
        that.sendSocketMessage(res.result)
      }
    });
  },
  // 权限询问
  getRecordAuth() {
    wx.getSetting({
      success(res) {
        if (!res.authSetting['scope.record']) {
          wx.authorize({
            scope: 'scope.record',
            success() {
            // 用户已经同意小程序使用录音功能，后续调用 wx.startRecord 接口不会弹窗询问
              console.log("succ auth")
            }, fail() {
            }
          })
        }
      }, 
      fail(res) {
      }
    })
  },
  // 获取发送消息时的时间戳
  getCacheIndex() {
    var thisDate = new Date();
    var thisDateIndex = thisDate.getTime();
    return thisDateIndex;
  },
  // 监听消息心跳
  // watchMessageHeartBeat() {
  //   var that = this;
  //   delayTime = setTimeout(() => {
  //     var time = new Date().getTime(),
  //        lastChatTime = that.data.chatItems.length ? ((that.data.chatItems[that.data.chatItems.length - 1].time) + 50000) : ''
  //     if (lastChatTime && time > lastChatTime) {
  //       that.sendSocketMessage('HeartBeat.')       
  //     }
  //   },50000)
  // },
  // 滚动到底部
  bottom() {
    var that = this;
    this.setData({
      scrollTop: 1000000
    })
  }
})
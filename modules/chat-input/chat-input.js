let _page, inputObj = {}, windowHeight, windowWidth, singleVoiceTimeCount = 0, maxVoiceTime = 60, minVoiceTime = 1, startTimeDown = 50, timer, tabbarHeigth = 0, canUsePress = false, cancelLineYPosition = 0;
const plugin = requirePlugin("WechatSI")
// 获取**全局唯一**的语音识别管理器**recordRecoManager**
const manager = plugin.getRecordRecognitionManager();
function init(page, opt) {
  // 获取手机信息
  windowHeight = opt.systemInfo.windowHeight;
  windowWidth = opt.systemInfo.windowWidth;
  canUsePress = opt.systemInfo.SDKVersion > '1.5.0';
  // 获取录音信息
  minVoiceTime = opt.minVoiceTime ? opt.minVoiceTime : 1;
  maxVoiceTime = opt.maxVoiceTime && opt.maxVoiceTime <= 60 ? opt.maxVoiceTime : 60;
  startTimeDown = opt.startTimeDown ? opt.startTimeDown : 50;
  if (!isNaN(opt.tabbarHeigth)) {
    tabbarHeigth = opt.tabbarHeigth;
  }
  if (!windowHeight || !windowWidth) {
    console.error('没有获取到手机的屏幕尺寸：windowWidth', windowWidth, 'windowHeight', windowHeight);
    return;
  }
  // 获取调用指令的this;
  _page = page;
  getUserInfo()
  initData(opt);
  initVoiceData();
  initChangeInputWayEvent();
  dealVoiceLongClickEventWithHighVersion();
  dealVoiceMoveEvent();
  dealVoiceMoveEndEvent();
}
// 初始化
function initData(opt) {
  _page.data.inputObj = inputObj = {
    voiceObj: {}
  };
}
// 初始化录音信息
function initVoiceData() {
  let width = windowWidth / 2.6;
  _page.setData({
    'inputObj.canUsePress': canUsePress, // 基础库版本
    'inputObj.inputStatus': 'text', // 初始状态为文本输入模式
    'inputObj.windowHeight': windowHeight, //注入可操作区域的总高度
    'inputObj.windowWidth': windowWidth,//注入可操作区域的总宽度
    'inputObj.voiceObj.status': 'end', //录音为结束状态
    'inputObj.voiceObj.startStatus': 0, //录音按钮状态，0：按住说话状态；1：松开结束状态
    'inputObj.voiceObj.voicePartWidth': width, //录音时弹出窗的宽度
    'inputObj.voiceObj.moveToCancel': false, //是否移动到了取消录音区域
    'inputObj.voiceObj.voicePartPositionToBottom': (windowHeight - width / 2.4) / 2, //录音时弹出窗的距离底部的位置，因为弹出窗是正方形的，所以这里是减的width，后面除的2.4是为了调整弹窗在屏幕中的显示位置
    'inputObj.voiceObj.voicePartPositionToLeft': (windowWidth - width) / 2 //录音时弹出窗的距离左侧位置
  });
  cancelLineYPosition = windowHeight * 0.12; //向上滑动到距离屏幕底部cancelLineYPosition大小时，进入到了取消录音的区域
}
// 初始化文本框是语音还是文本
function initChangeInputWayEvent() {
  // 点击切换语音和键盘
  _page.changeInputWayEvent = function () {
    _page.setData({
      'inputObj.inputStatus': _page.data.inputObj.inputStatus === 'text' ? 'voice' : 'text',
    });
  }
}
// 录音
function dealVoiceLongClickEventWithHighVersion() {
  manager.onStart = () => {
    _page.setData({
      'inputObj.voiceObj.showCancelSendVoicePart': true, //调出录音弹窗
      'inputObj.voiceObj.timeDownNum': maxVoiceTime - singleVoiceTimeCount, // 倒计时时间计算
      'inputObj.voiceObj.status': 'start', // 录音状态：开始
      'inputObj.voiceObj.startStatus': 1, // 状态：松开结束
      'inputObj.voiceObj.moveToCancel': false // 滑动结束
    });
    singleVoiceTimeCount = 0;
    //设置定时器计时60秒
    timer = setInterval(function () {
      singleVoiceTimeCount++;
      if (singleVoiceTimeCount >= startTimeDown && singleVoiceTimeCount < maxVoiceTime) {
        // 录音倒计时
        _page.setData({
          'inputObj.voiceObj.timeDownNum': maxVoiceTime - singleVoiceTimeCount,
          'inputObj.voiceObj.status': 'timeDown'
        })
      } else if (singleVoiceTimeCount >= maxVoiceTime) {
        // 录音超时
        _page.setData({
          'inputObj.voiceObj.status': 'timeout'
        });
        delayDismissCancelView();
        clearInterval(timer);
        //TODO 停止录音并生成IM语音信息 并将时长拼入到IM消息中
        endRecord();
      }
    }, 1000);
  }
  // 长按按钮打开录音
  _page.startVoice = function (e) {
    if ('voiceBtn' === e.currentTarget.id) {//长按时需要打开录音功能，开始录音
      // 开始录音
      manager.start({ duration: 60000 });
    }
  };
}
// 判断录音时移出距离
function dealVoiceMoveEvent() {
  _page.voiceMove = function (e) {
    if ('voiceBtn' === e.currentTarget.id) {
      let y = windowHeight + tabbarHeigth - e.touches[0].clientY;
      if (y > cancelLineYPosition) {
        if (!inputObj.voiceObj.moveToCancel) {
          _page.setData({
            'inputObj.voiceObj.moveToCancel': true
          });
        }
      } else {
        if (inputObj.voiceObj.moveToCancel) {//如果移出了该区域
          _page.setData({
            'inputObj.voiceObj.moveToCancel': false
          })
        }
      }
    }
  };
}
// 判断语音长度
function dealVoiceMoveEndEvent() {
  _page.voiceEnd = function (e) {
    if ('voiceBtn' === e.currentTarget.id) {
      if (singleVoiceTimeCount < minVoiceTime && !inputObj.voiceObj.moveToCancel) {//语音时间太短
        _page.setData({
          'inputObj.voiceObj.status': 'short'
        });
        delayDismissCancelView();
        endRecord();
      } else {//语音时间正常
        endRecord();
        _page.setData({
          'inputObj.voiceObj.showCancelSendVoicePart': false,
          'inputObj.voiceObj.status': 'end'
        });
      }
      if (timer) {//关闭定时器
        clearInterval(timer);
      }
    }
  }
}
// 监听发送文本消息
function setTextMessageListener(cb) {
  if (_page) {
    // 文本框获取焦点时 确定input类型
    _page.chatInputBindFocusEvent = function (e) {
      _page.setData({
        'inputObj.inputType': 'text'
      })
    };
    // 文本框失去焦点时 清空input类型
    _page.chatInputBindBlurEvent = function (e) {
      _page.setData({
        'inputObj.inputType': 'none'
      });
    };
    // 回车发送时， 触发 confirm 事件
    _page.chatInputSendTextMessage = function (e) {
      if (!e.detail.value) {
        return;
      };
      _page.setData({
        textMessage: ''
      });
      inputObj.inputValueEventTemp = null;
      typeof cb === "function" && cb(e);
    };
    //点击发送按钮
    _page.chatInputTapSend = function () {
      if (inputObj.inputValueEventTemp && inputObj.inputValueEventTemp.detail.value) {
        typeof cb === "function" && cb(inputObj.inputValueEventTemp);
      }
      _page.setData({
        textMessage: '',
        'inputObj.inputType': 'none'
      });
      inputObj.inputValueEventTemp = null;
    }
    // 获取input输入value
    _page.chatInputGetValueEvent = function (e) {
      inputObj.inputValueEventTemp = e;
    }
  }
}
// 监听发送语音消息
function sendVoiceListener(cbOk) {
  typeof cbOk === "function" && (manager.onStop = (res) => {
    //录音时间太短或者移动到了取消录音区域， 则取消录音
    if (_page.data.inputObj.voiceObj.status === 'short') {
      return;
    } else if (_page.data.inputObj.voiceObj.moveToCancel) {
      return;
    }
    typeof cbOk === "function" && cbOk(res);
  });
  manager.onError = (err) => {
    if (err.retcode == '-30001') {
      wx.showModal({
        title: '录音失败',
        content: '请检查是否打开录音授权',
        showCancel: false,
        success: res => {
        }
      })
    }
  };
}
// 延时隐藏录音动画消息
function delayDismissCancelView() {
  setTimeout(function () {
    if (inputObj.voiceObj.status !== 'start') {
      _page.setData({
        'inputObj.voiceObj.showCancelSendVoicePart': false,
        'inputObj.voiceObj.status': 'end'
      });
    }
  }, 1000)
}
// 停止录音
function endRecord() {
  _page.setData({
    'inputObj.voiceObj.startStatus': 0
  });
  if (_page.data.inputObj.voiceObj.showCancelSendVoicePart) {
    manager.stop();
  }
}
// 用户授权
function getUserInfo(){
  _page.getUserInfo = function(e){
    if (e.detail.errMsg != 'getUserInfo:fail auth deny'){
      _page.setData({
        userInfo: e.detail.userInfo,
        isAuth: false
      })
      wx.setStorageSync('userInfo', e.detail.userInfo);
    }
  }
}
module.exports = {
  init: init,
  recordVoiceListener: sendVoiceListener,
  setTextMessageListener: setTextMessageListener
};
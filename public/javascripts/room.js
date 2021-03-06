var SERVER_ADDRESS = 'http://' + location.host;
var ENTER_MESSAGE = 'enter the room';
var socket = io.connect(SERVER_ADDRESS + '/room');
var locate = new LocationMapping();
var userImage;

var destPos = null;
var flgMapFull=0;
var flgChatFull=0;

var instanceRoomSocket=null;

//------------------------GoogleMap Setting-------------------------
/*show the googleMap*/
locate.init(function(err){console.log(err);});

/*google LongPressEvent Add*/
function LongPress(map, length) {
  this.length_ = length;
  var that = this;
  that.map_ = map;
  that.timeoutId_ = null;

  google.maps.event.addListener(map,'mousedown', function(e) {
    that.onMouseDown_(e);
  });
  google.maps.event.addListener(map,'mouseup', function(e) {
    that.onMouseUp_(e);
  });
  google.maps.event.addListener(map,'drag', function(e) {
    that.onMapDrag_(e);
  });
}

LongPress.prototype.onMouseUp_ = function() {
  clearTimeout(this.timeoutId_);
};

LongPress.prototype.onMouseDown_ = function(e) {
  clearTimeout(this.timeoutId_);
  var map = this.map_;
  var event = e;
  this.timeoutId_ = setTimeout(function() {
    google.maps.event.trigger(map,'longpress',event);
  }, this.length_);
};

LongPress.prototype.onMapDrag_ = function() {
  //移動中はfocus onにしない
  locate.forcusCurrentPosition = false;
  clearTimeout(this.timeoutId_);
};

//------------------------SocketIO Setting-------------------------
socket.on('connect',function(){
   socket.on('roomId',function(data){
      var roomId = data;

      instanceRoomSocket = io.connect(SERVER_ADDRESS + '/room/' + roomId);

      instanceRoomSocket.on('connect', function(){
         //chatメッセージ受信
         instanceRoomSocket.on('emit', function(msgData){
            //入室メッセージだったらDestination情報の共有を行う
            //FIXME: このままだと受け取ったクライアントすべてが送信する
            if(msgData.msg === ENTER_MESSAGE && destPos !== null){
               instanceRoomSocket.emit('destInfo',{lat:destPos.lat, lng: destPos.lng});
            }
            displayChat(msgData.name, msgData.image, msgData.msg);
         });
         
         //positionメッセージ受信
         instanceRoomSocket.on('broadcast', function(msgData){
            var pos = msgData.msg;
            locate.setMarker(pos.lat, pos.lng, pos.icon !== null ? pos.icon : msgData.image, msgData.name);
         });
         
         instanceRoomSocket.on('userInfo', function(msgData){
            setUserIcon(msgData.image);
         });

         instanceRoomSocket.on('destInfo', function(msgData){
            console.log('recv: destInfo');
            setDestination(msgData.lat, msgData.lng);
         });
      });
   
      //定期的に自分の位置を送信
      setInterval(function(){
         instanceRoomSocket.emit('broadcast',{lat:locate.curPos.lat, lng: locate.curPos.lng, head: locate.curPos.head, icon: userImage});
      },3000);
      var roomURL = $('<a>').html(SERVER_ADDRESS + '/room?id=' + roomId);
      $('#displayRoomID').append(roomURL);
      $('#copyDialog').modal('show');
   });
});

//------------------------DOM Setting-------------------------
//FIXME: 時間は要調整
//1500ms長押しで発生するイベントを追加
new LongPress(locate.map,1500);

// クリックした場所にマーカーを追加 
google.maps.event.addListener(locate.map, 'longpress', function(e){
      locate.addMarker(e.latLng.lat(), e.latLng.lng(), 'http://labs.google.com/ridefinder/images/mm_20_red.png','tmp');
      $('#confirmDialog').modal('show');
});

$('.btn.btn-cancel').click(function(){
      $('#confirmDialog').modal('hide');
});

$('.btn.btn-apply').click(function(){
   destPos = locate.getMarkerPosition('tmp');
   setDestination(destPos.lat, destPos.lng);
   $('#confirmDialog').modal('hide');
   instanceRoomSocket.emit('destInfo',{lat:destPos.lat, lng: destPos.lng});
});

function setDestination(lat,lng){
   if(locate.getMarkerPosition('dest') !== null){
      locate.delMarker('dest');
   }

   destPos = {lat: lat, lng: lng};
   locate.addMarker(destPos.lat, destPos.lng, 'http://maps.google.co.jp/mapfiles/ms/icons/tree.png','dest');
   $('.toDestination').tooltip('destroy');
}

$('#confirmDialog').on('hidden.bs.modal',function(){
   //ダイアログが閉じられた際の動作
   locate.delMarker('tmp');
});

$('.toCurrentPosition').click(function(){
   var latLng = locate.getCurrentPosition();
   locate.forcusCurrentPosition = true;
   locate.setCenterPosition(latLng.lat,latLng.lng);
});

$('.toDestination').click(function(){
   locate.forcusCurrentPosition = false;
   if(destPos === null){
      $(this).tooltip({placement: 'top',trigger: 'manual'}).tooltip('show');
   }else{
      locate.setCenterPosition(destPos.lat,destPos.lng);
   }
});

$('.mapOnFull').click(function(){
   var checkIcon = $('<i>',{class :'fa fa-check-square'});

   if(flgMapFull === 0 && flgChatFull!== 0) {
      //chatFullを解除した後Mapfull
      $('#userIcon').toggle();         //userIconの表示
      $('a.chatOnFull').children('i.fa.fa-check-square').remove();
      $('#chatBar').hide();
      flgChatFull=0;
   }else if(flgMapFull !== 0){
      $('a.mapOnFull').children('i.fa.fa-check-square').remove();
      $('ul.dropdown-menu.pull-right.up').removeClass('up');
      flgMapFull=0;
      $('#map-canvas').css('height','60%');
      $('#msgList').css('height','30%');
      return;
   }

   //dropdownMenu -> up
   $('ul.dropdown-menu.pull-right').addClass('up');
   $('a.mapOnFull').append(checkIcon);

   //画面サイズ変更
   $('#msgList').css('height','0%');
   $('#map-canvas').css('height','90%');
   flgMapFull=1;
});

$('.chatOnFull').click(function(){
   var checkIcon = $('<i>',{class :'fa fa-check-square'});

   //map上ユーザーアイコン（チャット用)の表示・非表示切り替え
   $('#userIcon').toggle();
   if(flgChatFull === 0 && flgMapFull!== 0) {
      //mapFullを解除した後chatfull
      $('a.mapOnFull').children('i.fa.fa-check-square').remove();
      $('ul.dropdown-menu.pull-right.up').removeClass('up');
      flgMapFull=0;
   }else if(flgChatFull !== 0){
      $('a.chatOnFull').children('i.fa.fa-check-square').remove();
      flgChatFull=0;
      $('#chatBar').hide();
      $('#msgList').css('height','30%');
      $('#map-canvas').css('height','60%');
      return;
   }
   $('#chatBar').show();
   $('a.chatOnFull').append(checkIcon);
   //画面サイズ変更
   $('#map-canvas').css('height','0%');
   $('#msgList').css('height','85%');
   flgChatFull=1;
});

//SendButton対応
var sendMessage = function(){
   if(instanceRoomSocket !== null){
      var msg = $('#textArea').val();
      if(msg !== ''){
         $('#textArea').val('').focus();
         instanceRoomSocket.emit('emit',msg);
      }
   }
};

$('#sendText').live('click',sendMessage);

//msgListへのメッセージ表示
function displayChat(name,image, msg) {
   var msgBox = $('<div>',{class : 'media'});
   var msgBody = $('<div>',{class : 'media-body'});
   msgBody.html("<h4 class='media-heading'>"+name+'</h4>'+msg);
   
   var pull = $('<a>',{class : 'pull-left',href : '#'});
   var userImg = $('<img>',{src : image});

   pull.append(userImg);
   msgBox.append(pull);
   msgBox.append(msgBody);
   $('#msgList>table>tbody').prepend($('<tr/>').append($('<td/>').append(msgBox)));
}

function setUserIcon(imageSrc){
   var proxy = SERVER_ADDRESS + '/proxy';
   var canvas = $('#userIcon').get(0);
   if ( ! canvas || ! canvas.getContext ) {
      return false;
   }
   var ctx = canvas.getContext('2d');
   canvas.width = 45;
   canvas.height = 45;
   ctx.beginPath();
   ctx.arc(24, 24, 20, 0, Math.PI * 2, false);
   ctx.clip();

   //proxy経由でBase64形式画像の取得
   $.ajax({
     url: proxy,
     type: 'GET',
     data: { url: imageSrc },
     dataType: 'json',
     success: function(result) {
       var img = new Image();
       img.onload = function() {
          ctx.drawImage(img, 0, 0, 45, 45);
          $('#userIcon').popover({
             html : true,
             content: function() {
                return $('#popover-content').html();
             }
          });
          userImage = canvas.toDataURL();
       };
       img.src = result.data;
     }
   });
}

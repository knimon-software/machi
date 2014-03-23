var socket = io.connect('http://localhost:3000/room');
var locate = new LocationMapping();
var roomId;

/*show the googleMap*/
locate.init();

socket.on('connect',function(){
   socket.on('roomId',function(data){
      roomId = data;
      var instanceRoom = io.connect('http://localhost:3000/room/' + roomId);
      instanceRoom.on('connect',function(){
         instanceRoom.on('emit',function(msgData){
            displayChat(msgData.name,msgData.image,msgData.msg);
         });

         instanceRoom.on('broadcast',function(msgData){
            var pos = msgData.msg;
            locate.setMarker(pos.lat,pos.lng,msgData.image,msgData.name);
         });

      });

      function sendMessage(){
         var msg = $('#textArea').val();
         $('#textArea').val('').focus();
         instanceRoom.emit('emit',msg);
      }

      setInterval(function(){ 
         instanceRoom.emit('broadcast',{lat:locate.curPos.lat,lng:locate.curPos.lng,head:locate.curPos.head});
      },3000);


      $('#getRoomId').click(function(e){
         window.alert(location.href+ '?id=' + roomId);
      });

      $('#btn').click(function(e){
         sendMessage();
      });

      $('#textArea').keypress(function(e){
         if(e.which == 13){
            return sendMessage();
         }
      });
   });
});

//発言内容を表示する
function displayChat(name,image, msg) {
   var msgBox = $('<div>',{class : 'media'});
   var msgBody = $('<div>',{class : 'media-body'});
   msgBody.html("<h4>"+name+"</h4>"+msg);
   
   var pull = $('<a>',{class : 'pull-left',href : '#'});
   var userImg = $('<img>',{src : image});

   pull.append(userImg);
   msgBox.append(pull);
   msgBox.append(msgBody);
   $('#msgList').prepend(msgBox);
}


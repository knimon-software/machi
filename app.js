
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');

// passport configuration
var passport = require('passport'),
    TwitterStrategy = require('passport-twitter').Strategy,
    GoogleStrategy  = require('passport-google').Strategy;

//user Setting
var _dammyImage = 'http://blog-imgs-24-origin.fc2.com/w/a/r/waraigun2/warai4.gif';

passport.serializeUser(function(userInfo, done){
   done(null,userInfo);
});

passport.deserializeUser(function(userInfo, done){
   done(null, userInfo);
});

// passport-twitterSetting
passport.use(new TwitterStrategy({
      //TODO: コンシューマキーの読み込みを別モジュールにすること
      consumerKey: process.env.TWITTER_CONSUMER_KEY,
      consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
      callbackURL: 'http://localhost:3000/auth/twitter/callback'
   },
   function(token, tokenSecret, profile, done){
      profile.twitter_token = token;
      profile.twitter_tokenSecret = tokenSecret;

      process.nextTick(function() {
         done(null, profile);
      });
   }
));

//passport-googleSetting
passport.use(new GoogleStrategy({
   returnURL: 'http://localhost:3000/auth/google/return',
    realm: 'http://localhost:3000/'
  },
  function(identifier, profile, done) {
      process.nextTick(function(){
         done(null, profile);
      });
  }
));

/*
 * expressに関する設定
 */
var app = express();
var sessionStore = new express.session.MemoryStore();

app.configure(function(){
   app.set('port', process.env.PORT || 3000);
   app.set('views', __dirname + '/views');
   app.set('view engine', 'jade');

   //FIXME: need to change secret key
   app.set('secretKey', 'mySecret');
   app.set('cookieSessionKey', 'sid');
   app.use(express.favicon());
   app.use(express.logger('dev'));
   app.use(express.bodyParser());
   app.use(express.methodOverride());
   //PassportとSocket.ioのためsession管理が必要なので、以下追記
   app.use(express.cookieParser(app.get('secretKey')));
   //FIXME: クッキーの暗号化処理に関して考えておく
   app.use(express.session({
      key   : app.get('cookieSessionKey'),
      secret: app.get('secretKey'),
      store : sessionStore
   }));
   app.use(passport.initialize());
   app.use(passport.session());

   app.use(app.router);
   app.use(express.static(path.join(__dirname, 'public')));
});


app.configure('development', function(){
   app.use(express.errorHandler());
});

/**
 * expressルーティング処理
 */

app.get('/', routes.index); //index & login page

//TwitterSignIn
app.get('/auth/twitter', passport.authenticate('twitter'));
app.get('/auth/twitter/callback',
   passport.authenticate('twitter', { successRedirect: '/room', failureRedirect: '/'}));

//Google SignIn
app.get('/auth/google', passport.authenticate('google'));
app.get('/auth/google/return',
  passport.authenticate('google', { successRedirect: '/room', failureRedirect: '/' }));
app.get('/logout', function(req, res){
   req.logout();
   res.redirect('/');
});

// checkBelongingRoomId,isLoginedの順番でチェックを行った後、/roomへルーティングする
// ルーティングの際、クライアント側で表示するためにユーザー情報の一部を渡す
app.get('/room', checkBelongingRoomId,isLogined, function(req,res){
   //res user profile
   res.render('room', {
      userName : req.user.displayName,
      userImage : req.user.photos && req.user.photos.length > 0 ? req.user.photos[0]: null
   });
});

/**
 * RoomIDを伴った、/roomへのアクセスである場合は、RoomIDをセッションに格納する
 */
function checkBelongingRoomId(req,res,next){
   //アクセス時パラメータとしてIDを受け取っていればsessionに埋め込み
   if(req.query.id){
      console.log('roomAccess :' + req.sessionID);
      req.session.roomId = req.query.id;
   }

   return next();
}

/**
 * ログインが行われていないアクセスの場合は`/`へリダイレクトをおこなう
 */
function isLogined(req, res, next){
   if(req.isAuthenticated()){
      return next();
   }

   res.redirect('/');
}

var server = http.createServer(app);
server.listen(app.get('port'), function(){
   console.log('Express server listening on port ' + app.get('port'));
});

//socket.ioに関する設定

/**
 * soket.io内部HandShakeにsession情報を埋め込む
 *@param handshake HandShakeでーた
 *@param sessionStore sessionStore
 *@param callback socke.io.authorization内で指定しているcallback
 *@return handshake HandShake + SessionData
 */
var addSessionData = function(handshake,sessionStore,callback){
   //var cookie = require('cookie').parse(decodeURIComponent(handshake.headers.cookie));
   //cookie = connect.utils.parseSignedCookies(cookie,'secretKey');
   var cookieParser = express.cookieParser('secretKey');
   cookieParser(handshake,{},function(err){
      sessionStore.get(handshake.signedCookies['connect.sid'],function(err,session){
         console.log(session);
         if(err){
            console.log(err);
            callback(err.message,false);
         }else if(!session){
            console.log('session is not found');
            callback('session is not found',false);
         }else{
            console.log(sessionId);
            handshake.session = session;
            return handshake;
         }
      });
   });
}

var io = require('socket.io').listen(server),
    passportSocketIo = require('passport.socketio');

/**
 * クライアントからアクセスされてきたときにhandshakeDataにルームIDをセットするため処理 
 * socket.ioにてセッション情報を利用するため、CookieのパースおよびSessionStoreからのget
 */
var Loby = io.of('/room').authorization(function(handshakeData,callback){
   if (handshakeData.headers.cookie) {
        var connect = require('connect');
        //cookieを取得
        var cookie = require('cookie').parse(decodeURIComponent(handshakeData.headers.cookie));
        //cookie中の署名済みの値を元に戻す
        cookie = connect.utils.parseSignedCookies(cookie, app.get('secretKey'));
        //cookieからexpressのセッションIDを取得する
        var sessionID = cookie[app.get('cookieSessionKey')];
        // セッションデータをストレージから取得
        sessionStore.get(sessionID, function(err, session) {
            if (err) {
                //セッションが取得できなかったら
                console.dir(err);
                callback(err.message, false);
            }
            else if (!session) {
                console.log('session not found');
                callback('session not found', false);
            }
            else {
                console.log("authorization success");
 
                // socket.ioからもセッションを参照できるようにする
                handshakeData.cookie = cookie;
                handshakeData.sessionID = sessionID;
                handshakeData.sessionStore = sessionStore;
                handshakeData.session = session//new Session(handshakeData, session);
 
                callback(null, true);
            }
        });
    }else{
        //cookieが見つからなかった時
        return callback('cookie not found', false);
    }
});

Loby.on('connection', function(socket){

   //roomIDが指定されている接続の場合は使用し、そうでなければ作成
   handshakeData = socket.handshake;

   var id = handshakeData.session.roomId || generateHashString(handshakeData);

   handshakeData.roomId = id;
   console.log('authenticated: ' + handshakeData.roomId);
   
   //部屋が作成されていない場合は、/roomへのアクセスがあった後動的に作成する
   if(!io.namespaces.hasOwnProperty('/room/' + id )){
      var onAuthorizeSuccess = function(data,accept){
            accept(null, true);
      }

      var onAuthorizeFail = function(data, message, error, accept){
            if(error){
               throw new Error(message);
            }

            console.log('failed connection to socket.io:', message);
            accept(null, false);
      }

      /**
       * Clientから直接接続する個別のroom,Passportでの認証を利用する
       * 各パラメータはexpressと同様のものを指定する(sucess,failureコールバック以外)
       * @type {Object}
       */
      var instantRoom = io.of('/room/' + id).authorization(passportSocketIo.authorize({
         cookieParser: express.cookieParser,
         key:         app.get('cookieSessionKey'),
         //FIXME: need to change secret key
         secret:      app.get('secretKey'),
         store:       sessionStore,
         success:     onAuthorizeSuccess,
         fail:        onAuthorizeFail
      }));


      instantRoom.on('connection', function(socket){
         /**
         * 以下それぞれクライアントからの意図的なブロードキャスト範囲を伴うイベントを処理する
         * emitの場合は、送信元クライアントには送信されない
         * broadcastの場合は、送信元を含むブロードキャストを行う
         * @param {Object} msgData クライアントからのメッセージオブジェクト
         */
         socket.on('emit', function(msgData){
            var userData = socket.handshake.user;
            var userImage = !userData.hasOwnProperty('photos') ? _dammyImage : userData.photos[0].value;
            instantRoom.emit('emit', { name : userData.displayName, image : userImage, msg : msgData });
         });

         socket.on('broadcast', function(msgData){
            var userData = socket.handshake.user;
            var userImage = !userData.hasOwnProperty('photos') ? _dammyImage : userData.photos[0].value;
            socket.broadcast.emit('broadcast', { name : userData.displayName, image : userImage, msg : msgData });
         });
      });
   }

   socket.emit('roomId', socket.handshake.roomId);
});



/*generate Hash String from Current Date + HandShake Data */
var generateHashString = function(handshake){
   var currentDate = new Date();
   var dateString = '' + currentDate.getFullYear()  + currentDate.getMonth() + currentDate.getDate();
   dateString += '' + currentDate.getHours() + currentDate.getMinutes() + currentDate.getMilliseconds();
   var sha1 = require('crypto').createHash('sha1');

   sha1.update(dateString + handshake.address.address);

   return sha1.digest('hex');
}

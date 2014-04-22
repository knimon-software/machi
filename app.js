
/**
 * Module dependencies.
 */
var express = require('express');
var routes  = require('./routes');
var http    = require('http');
var path    = require('path');
var CONFIG  = require('config');

//App Const Setting
//FIXME: ユーザー情報に画像イメージが含まれていない場合の画像を作成し、以下に指定すること
var DAMMY_IMAGE = 'http://blog-imgs-24-origin.fc2.com/w/a/r/waraigun2/warai4.gif';
var APP_PORT      =  process.env.PORT | CONFIG.serverSetting.port || 3000;
var APP_ADDRESS   = CONFIG.serverSetting.address || 'http://localhost:' + APP_PORT;
var SESSION_KEY   = CONFIG.appSetting.sessionSecretKey || 'secretKey';
var ENTER_MESSAGE = CONFIG.appSetting.enterMessage || 'enter the room';

//passport configuration
var passport         = require('passport'),
    TwitterStrategy  = require('passport-twitter').Strategy,
    FacebookStrategy = require('passport-facebook').Strategy,
    GoogleStrategy   = require('passport-google').Strategy;

passport.serializeUser(function(userInfo, done){
   done(null,userInfo);
});

passport.deserializeUser(function(userInfo, done){
   done(null, userInfo);
});

// passport-twitterSetting
passport.use(new TwitterStrategy({
      consumerKey   : CONFIG.appSetting.twitterConsumerKey,
      consumerSecret: CONFIG.appSetting.twitterConsumerSecret,
      callbackURL   : APP_ADDRESS + '/auth/twitter/callback'
   },
   function(token, tokenSecret, profile, done){
      profile.twitter_token = token;
      profile.twitter_tokenSecret = tokenSecret;

      process.nextTick(function() {
         return done(null, profile);
      });
   }
));

//passport-facebookSetting
passport.use(new FacebookStrategy({
    clientID     : CONFIG.appSetting.facebookAppID,
    clientSecret : CONFIG.appSetting.facebookAppSecret,
    callbackURL  : APP_ADDRESS + '/auth/facebook/callback',
    profileFields: ['id', 'displayName', 'photos']
  },
  function(accessToken, refreshToken, profile, done) {
    process.nextTick(function () {
      
      return done(null, profile);
    });
  }
));

//passport-googleSetting
passport.use(new GoogleStrategy({
   returnURL: APP_ADDRESS + '/auth/google/return',
    realm: APP_ADDRESS
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
   app.set('port', APP_PORT);
   app.set('views', __dirname + '/views');
   app.set('view engine', 'jade');

   app.set('secretKey', SESSION_KEY);
   app.set('cookieSessionKey', 'sid');
   app.use(express.favicon());
   app.use(express.logger('dev'));
   app.use(express.bodyParser());
   app.use(express.methodOverride());
   //PassportとSocket.ioのためsession管理が必要なので、以下追記
   app.use(express.cookieParser(app.get('secretKey')));
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

//facebookSignIn
app.get('/auth/facebook', passport.authenticate('facebook'));
app.get('/auth/facebook/callback',
   passport.authenticate('facebook', { successRedirect: '/room', failureRedirect: '/'}));

//Google SignIn
app.get('/auth/google', passport.authenticate('google'));
app.get('/auth/google/return',
  passport.authenticate('google', { successRedirect: '/room', failureRedirect: '/' }));
app.get('/logout', function(req, res){
   req.logout();
   res.redirect('/');
});

// checkBelongingRoomId,isLoginedの順番でチェックを行った後、/roomへルーティングする
app.get('/room', checkBelongingRoomId,isLogined,function(req,res){
   res.render('room');
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

app.get('/proxy', function(req,res){
   var url, proxyReq;

   if (req.param('url')) {
      url = require('url').parse(req.param('url'));
      var options = {
         host: url.hostname,
         port: '80',
         path: url.pathname,
         method: 'GET'
      };

      console.log(url);

      proxyReq = http.request(options,function(proxyResponse){
         proxyResponse.setEncoding('binary');
         var type = proxyResponse.headers['content-type'],
         prefix = 'data:' + type + ';base64,',
         body = '',
         success = true;

         proxyResponse.on('data', function(chunk) {
            if (proxyResponse.statusCode === 200) {
               body += chunk;
            } else {
               res.statusCode = proxyResponse.statusCode;
               body += chunk;
               success = false;
            }
         });

         proxyResponse.on('end', function() {
            if (success) {
               var base64 = new Buffer(body, 'binary').toString('base64'),
                  data = prefix + base64,
                  obj = {
                     'src': url.href,
                     'data': data
                  };

               res.contentType('application/json');
               res.header('Access-Control-Allow-Origin', '*');
               res.header('Access-Control-Allow-Headers', 'X-Requested-With');
               res.header('Access-Control-Allow-Methods', 'GET,POST');

               res.send(JSON.stringify(obj));
            } else {
               res.send(body);
            }
         });

      });
      proxyReq.on('error', function(err) {
         console.log('error occ');
         res.statusCode = 404;
         res.send(err.message);
      });
      proxyReq.write('data\n');
      proxyReq.write('data\n');
      proxyReq.end();
   }
});

var server = http.createServer(app);
server.listen(app.get('port'), function(){
   console.log('Express server listening on port ' + app.get('port'));
});

//socket.ioに関する設定
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
                console.log('authorization success');
 
                // socket.ioからもセッションを参照できるようにする
                handshakeData.cookie = cookie;
                handshakeData.sessionID = sessionID;
                handshakeData.sessionStore = sessionStore;
                handshakeData.session = session;
 
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
   var handshakeData = socket.handshake;

   var id = handshakeData.session.roomId || generateHashString(handshakeData);

   handshakeData.roomId = id;
   console.log('authenticated: ' + handshakeData.roomId);
   
   //部屋が作成されていない場合は、/roomへのアクセスがあった後動的に作成する
   if(!io.namespaces.hasOwnProperty('/room/' + id )){
      var onAuthorizeSuccess = function(data,accept){
            accept(null, true);
      };

      var onAuthorizeFail = function(data, message, error, accept){
            if(error){
               throw new Error(message);
            }

            console.log('failed connection to socket.io:', message);
            accept(null, false);
      };

      /**
       * Clientから直接接続する個別のroom,Passportでの認証を利用する
       * 各パラメータはexpressと同様のものを指定する(sucess,failureコールバック以外)
       * @type {Object}
       */
      var instantRoom = io.of('/room/' + id).authorization(passportSocketIo.authorize({
         cookieParser: express.cookieParser,
         key:         app.get('cookieSessionKey'),
         secret:      app.get('secretKey'),
         store:       sessionStore,
         success:     onAuthorizeSuccess,
         fail:        onAuthorizeFail
      }));


      instantRoom.on('connection', function(socket){
         var userData = socket.handshake.user;
         var userImage = !userData.hasOwnProperty('photos') ? DAMMY_IMAGE : userData.photos[0].value;

         socket.emit('userInfo', { name : userData.displayName, image : userImage});
         instantRoom.emit('emit', { name : userData.displayName, image : userImage, msg:ENTER_MESSAGE});
         /**
         * 以下それぞれクライアントからの意図的なブロードキャスト範囲を伴うイベントを処理する
         * broadcastの場合は、送信元クライアントには送信されない
         * emitの場合は、送信元を含むブロードキャストを行う
         * @param {Object} msgData クライアントからのメッセージオブジェクト
         */

         socket.on('emit', function(msgData){
            instantRoom.emit('emit', { name : userData.displayName, image : userImage, msg : msgData });
         });

         socket.on('broadcast', function(msgData){
            socket.broadcast.emit('broadcast', { name : userData.displayName, image : userImage, msg : msgData });
         });

         socket.on('destInfo', function(msgData){
            socket.broadcast.emit('destInfo', msgData);
         });
      });
   }
   
   socket.emit('roomId', handshakeData.roomId);
});

/**
* roomIDを自動で生成する関数
* SHA1(現在時刻+アクセス元IPアドレス)
* @param {Object} socket.ioで使用しているhandshakeデータ
* @return String SHA1で生成されたハッシュ値
*/
function generateHashString (handshake){
   var currentDate = new Date();
   var dateString = '' + currentDate.getFullYear()  + currentDate.getMonth() + currentDate.getDate();
   dateString += '' + currentDate.getHours() + currentDate.getMinutes() + currentDate.getMilliseconds();
   var sha1 = require('crypto').createHash('sha1');

   sha1.update(dateString + handshake.address.address);

   return sha1.digest('hex');
}

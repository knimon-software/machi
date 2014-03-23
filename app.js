
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

//express configuration
var app = express();
var MemoryStore = express.session.MemoryStore,
    sessionStore = new MemoryStore();

app.configure(function(){
   app.set('port', process.env.PORT || 3000);
   app.set('views', __dirname + '/views');
   app.set('view engine', 'jade');
   app.use(express.favicon());
   app.use(express.logger('dev'));
   app.use(express.bodyParser());
   app.use(express.methodOverride());
   //session configuration
   app.use(express.cookieParser());
   //app.use(express.cookieParser("secret"));
   app.use(express.session({
      secret: 'secretKey',
      store: sessionStore
   }));
   app.use(passport.initialize());
   app.use(passport.session());

   app.use(app.router);
   app.use(express.static(path.join(__dirname, 'public')));
});


app.configure('development', function(){
   app.use(express.errorHandler());
});

//express routing
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

app.get('/room', isLogined, function(req,res){
   //res user profile
   res.render('room', {
      userName : req.user.displayName,
      userImage : req.user.photos && req.user.photos.length > 0 ? req.user.photos[0]: null
   });
});

/* check authenticated */
function isLogined(req, res, next){
   //アクセス時にroomidが付加されている場合はクッキーに保存する
   //FIXME: cookieを使わない方法に変えたい
   if(req.query.id){
      res.cookie('id', req.query.id);
   }

   if(req.isAuthenticated()){
      return next();
   }

   res.redirect('/');
}

var server = http.createServer(app);
server.listen(app.get('port'), function(){
   console.log('Express server listening on port ' + app.get('port'));
});

//socket.io configuration
var io = require('socket.io').listen(server),
    passportSocketIo = require('passport.socketio'),
    cookie = require('cookie');

//クライアントからアクセスされてきたときにhandshakeDataにルームIDをセットするため処理
//cookieにルームIDが設定されていなければ新規に部屋を作成
//FIXME: cookieを使わない方法に変えたい
var Loby = io.of('/room').authorization(function(handshakeData,callback){

   //指定がなければIDを作成
   var id = cookie.parse(handshakeData.headers.cookie).id || generateHashString(handshakeData);

   handshakeData.roomId=id;
   console.log('authenticated: ' + handshakeData.roomId);

   if(!io.namespaces.hasOwnProperty('/room/' + id )){
      //createRoom & shared session
      var instantRoom = io.of('/room/' + id).authorization(passportSocketIo.authorize({
         cookieParser: express.cookieParser,
         key:         'connect.sid',
         secret:      'secretKey',
         store:       sessionStore,
         success:     function(data,accept){
            accept(null, true);
         },
         fail:        function(data, message, error, accept){
            if(error){
               throw new Error(message);
            }

            console.log('failed connection to socket.io:', message);
            accept(null, false);
         }
      }));

      instantRoom.on('connection', function(socket){
         //main Logic

         socket.on('emit', function(msgData){
            var userData = socket.handshake.user;
            instantRoom.emit('emit', { name : userData.displayName, image : userData.photos[0].value, msg : msgData });
         });

         socket.on('broadcast', function(msgData){
            var userData = socket.handshake.user;
            socket.broadcast.emit('broadcast', { name : userData.displayName, image : userData.photos[0].value, msg : msgData });
         });

      });
   }

   callback(null, true);
});

Loby.on('connection', function(socket){
   socket.emit('roomId', socket.handshake.roomId);
});

/*generate Hash String from Current Date + HandShake Data */
function generateHashString(handshake){
   var currentDate = new Date();
   var dateString = '' + currentDate.getFullYear()  + currentDate.getMonth() + currentDate.getDate();
   dateString += '' + currentDate.getHours() + currentDate.getMinutes() + currentDate.getMilliseconds();
   var sha1 = require('crypto').createHash('sha1');

   sha1.update(dateString + handshake.address.address);

   return sha1.digest('hex');
}

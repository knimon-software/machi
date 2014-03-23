/*Constructor init Map*/
var LocationMapping = function() {
   this.map;
   this.marker = {};
   this.curPos = {lat: -34.397, lng: 150.633, head: 0};

   this.init = function() {

      //initialCenter
      var initLatLng = new google.maps.LatLng(this.curPos.lat, this.curPos.lng);

      //zoom,mapTypeinit
      var mapOptions = {
         center: initLatLng,
         zoom: 12,
         mapTypeId: google.maps.MapTypeId.ROADMAP
      };
      //displayMap
      this.map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);

      //markerinit
      this.marker['mine'] = new google.maps.Marker({
         position: initLatLng,
          map: this.map,
          title: 'currentPosition',
          icon: {
             path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
             scale: 3,
             rotation: 0
          },
          draggable: true
      });

      this.getCurrentLocation();
   };
};

LocationMapping.prototype.getCurrentLocation = function() {
   var that = this;

   if (navigator.geolocation) {
      //GeoLocation enable
      navigator.geolocation.watchPosition(
            function(pos) {
               that.curPos.lat = pos.coords.latitude;
               that.curPos.lng = pos.coords.longitude;
               that.curPos.head = pos.coords.heading;

               var currentPos = new google.maps.LatLng(that.curPos.lat, that.curPos.lng);
               that.marker['mine'].setPosition(currentPos);
               that.map.setCenter(currentPos);

               //heading再設定
               that.marker['mine'].setIcon({
                  path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                  scale: 3,
                  rotation: (that.curPos.head + 180 % 360)
               });
            },
            function(error) {
               var message = '';

               switch (error.code) {
                  // 位置情報が取得できない場合
                  case error.POSITION_UNAVAILABLE:
                     message = '位置情報の取得ができませんでした。';
                     break;

                  // Geolocationの使用が許可されない場合
                  case error.PERMISSION_DENIED:
                     message = '位置情報取得の使用許可がされませんでした。';
                     break;

                  // タイムアウトした場合
                  case error.PERMISSION_DENIED_TIMEOUT:
                     message = '位置情報取得中にタイムアウトしました。';
                     break;
               }
               window.alert(message);
            }
      );
   }else {
      //GeoLocation disable
   }
};

LocationMapping.prototype.addMarker = function(lat, lng, image, name) {
   var markerIcon = new google.maps.MarkerImage(image,
      new google.maps.Size(31, 31),
      new google.maps.Point(0, 0),
      new google.maps.Point(0, 32)

   );

   this.marker[name] = new google.maps.Marker({
         position: new google.maps.LatLng(lat,lng),
         map: this.map,
         title: name,
         icon: markerIcon
   });
}

LocationMapping.prototype.setMarker = function(lat,lng,image,name){
   if(this.marker.hasOwnProperty(name)){
      this.marker[name].setPosition(new google.maps.LatLng(lat,lng));
   }else{
      this.addMarker(lat,lng,image,name);
   }
}

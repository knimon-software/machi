/*Constructor init Map*/
var LocationMapping = function() {
   this.map;
   this.marker = {};
   this.curPos = {lat: -34.397, lng: 150.633, head: 0};
   //forcus center at current position every update to currentposition
   this.forcusCurrentPosition = true;

   this.init = function(errorCallback) {

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

      this.watchCurrentLocation(errorCallback);
   };
};

LocationMapping.prototype.getCurrentPosition = function(){
   var that = this;
   return that.curPos;
}

LocationMapping.prototype.watchCurrentLocation = function(errorCallback) {
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
               if (that.forcusCurrentPosition){
                  that.map.setCenter(currentPos);
               }

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
               errorCallback(message);
            }
      );
   }else {
      //GeoLocation disable
      errorCallback('GeoLocation disable');
   }
};

LocationMapping.prototype.addMarker = function(lat, lng, image, name) {
   var that = this;

   //var markerIcon = new google.maps.MarkerImage(image,
   //   new google.maps.Size(31, 31),
   //   new google.maps.Point(0, 0),
   //   new google.maps.Point(0, 32)

   //);

   that.marker[name] = new google.maps.Marker({
         position: new google.maps.LatLng(lat,lng),
         map: that.map,
         title: name,
         icon: image
   });
}

LocationMapping.prototype.delMarker = function(name){
   var that = this;
   if(that.marker.hasOwnProperty(name)){
      that.marker[name].setMap(null);
      delete that.marker[name];
   }
}

LocationMapping.prototype.setMarker = function(lat,lng,image,name){
   var that = this;
   if(that.marker.hasOwnProperty(name)){
      that.marker[name].setPosition(new google.maps.LatLng(lat,lng));
      that.marker[name].setIcon(image);
   }else{
      that.addMarker(lat,lng,image,name);
   }
}

LocationMapping.prototype.getMarkerPosition = function(name){
   if(this.marker.hasOwnProperty(name)){
      return {lat: this.marker[name].getPosition().lat(), lng: this.marker[name].getPosition().lng()};
   }else{
      return null;
   }
}

LocationMapping.prototype.setCenterPosition = function(lat,lng){
   var that = this;

   that.map.setCenter(new google.maps.LatLng(lat,lng));
}

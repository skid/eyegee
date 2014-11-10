(function(){
  /**
   * We have a special parser function to extract the image
   * for each comic strip website.
  **/
  var xkcd_re = /\<div\s+id=\"comic\"\>\s+\<img\s+src=\"([^"]+)\"/;
  var dilbert_re = /\<img\s+src="([^"]+)"\s+title="The\s+Dilbert\s+Strip\s+for\s+[^"]+"\s+\/\>/;
  var cyanide_re = /\<img\s+alt\=\"Cyanide\s+and\s+Happiness\,\s+a\s+daily\s+webcomic\"\s+src=\"([^"]+)\"\s+border\=0\>/;

  var parserFunctions = [
    function xkcd(html){
      var match = html.match(xkcd_re);
      return match && match[1];
    },
    function dilbert(html){
      var match = html.match(dilbert_re);
      return match && "http://www.dilbert.com/" + match[1];
    },
    function cyanide(html){
      var match = html.match(cyanide_re);
      var url = match && match[1];
      if(url[0] === "/") {
        url = "http://explosm.net" + url;
      }
      return url;
    }
  ];

  /**
   * Eyegee comic widget controller
  **/
  angular.module('eyegeeApp').lazy.controller('ComicController', function ($scope, $http, $timeout, model, appconfig) {
    var widget = model.getWidgetById($scope.widgetId);
    
    // Available comics
    $scope.comics = [
      { name: "XKCD", url: "http://xkcd.com/", source: "http://xkcd.com/" },
      { name: "Dilbert", url: "http://www.dilbert.com/strips", source: "http://www.dilbert.com/" },
      { name: "Cyanide and Happiness", url: "http://explosm.net/comics/", source: "http://explosm.net/comics/" }
    ];

    /**
     * Define the editBegin, editEnd and remove methods.
     * Each widget should have these defined.
    **/
    widget.editBegin = function editBegin(){
      $scope.errors = [];
      $scope.isEdited = true;
      $scope.widget.$loaded = true;
    }

    widget.editEnd = function editEnd(){
      $scope.isEdited = false;
    }

    widget.remove = function remove(){
      if(confirm("Remove this widget?")){
        model.removeWidget(this);
        model.saveState();
      }
    }

    // We need this to expose the scope 
    // to the widget and vice versa
    $scope.widget   = widget;
    $scope.src      = "";
    $scope.index    = widget.index || 0;
    widget.$scope   = $scope;
    widget.$working = 0;
    

    if(widget.__editToken) {
      delete widget.__editToken;
      widget.editBegin();
    }
    else {
      loadSrc();
    }

    // Applies the changes from the edit panel
    $scope.saveSettings = function(){
      $scope.isEdited = false;
      $scope.widget.$loaded = false;
      
      // Set the comic index of the widget. That's all we need to know.
      widget.index = $scope.index;  
      loadSrc(function(){
        model.saveState();
      });
    }

    function loadSrc(callback){
      var comic = $scope.comics[$scope.index];
      
      widget.$working = 1;
      widget.title  = comic.name;
      widget.link   = comic.source;
      widget.$loaded = false;
      
      $scope.src = "";
      $scope.error = "";
      
      // Don't wait for the page forever
      var timeout = setTimeout(function(){
        $scope.error = "Can't load comic strip";
        $scope.widget.$working = 0;
        $scope.widget.$loaded = true;
        $scope.$apply();
      }, appconfig.loadTimeout);

      $http({ url: '/proxy', method: 'POST', data: {source: comic.url} })
      .success(function(data, status, headers, config){
        clearTimeout(timeout);
        
        $scope.src = parserFunctions[$scope.index](data);
        $scope.widget.$working = 0;
        $scope.widget.$loaded = true;
        
        if(!$scope.src) {
          $scope.error = "Can't load comic strip";
        }
        else {
          callback && callback();
        }
      })
      .error(function(){
        clearTimeout(timeout);

        $scope.error = "Can't load comic strip";
        $scope.widget.$loaded = true;
        $scope.widget.$working = 0;
      })
    }
  });
})();

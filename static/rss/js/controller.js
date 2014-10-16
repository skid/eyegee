(function(){
  // RSS parser
  function parseRSS(xml) {
    var channel, feed = {};
    channel = $('channel', xml).eq(0);
    feed.version = $('rss', xml).length == 0 ? '1.0' : $('rss', xml).eq(0).attr('version');
    feed.title = channel.find('title:first').text();
    feed.link = channel.find('link:first').text();
    feed.description = channel.find('description:first').text();
    feed.language = channel.find('language:first').text();
    feed.updated = channel.find('lastBuildDate:first').text();
    feed.items = new Array();
  
    $('item', xml).each(function() {
      var item = $(this);
      feed.items.push({
        title: item.find('title').eq(0).text(),
        link: item.find('link').eq(0).text(),
        description: item.find('description').eq(0).text(),
        updated: item.find('pubDate').eq(0).text(),
        id: item.find('guid').eq(0).text(),
        comments: item.find('comments').eq(0).text(),
      });      
    });
    return feed;
  }


  // Atom parser
  function parseAtom(xml){
    var channel, feed = {};
  
    channel = $('feed', xml).eq(0);
    feed.version = '1.0';
    feed.title = channel.find('title:first').text();
    feed.link = channel.find('link:first').attr('href');
    feed.description = channel.find('subtitle:first').text();
    feed.language = channel.attr('xml:lang');
    feed.updated = channel.find('updated:first').text();
    feed.items = new Array();

    $('entry', xml).each( function() {
      var item = $(this);
      feed.items.push({
        title: item.find('title').eq(0).text(),
        link: item.find('link').eq(0).attr('href'),
        description: item.find('content').eq(0).text(),
        updated: item.find('updated').eq(0).text(),
        id: item.find('id').eq(0).text(),
        comments: item.find('comments').eq(0).text()
      });
    });

    return feed;
  }


  /** 
   * Looks for <link> elements with a "application/rss+xml" or "application/atom+xml" content type.
   * Returns an array of found links' href attributes or null if the parsing fails or no links are found.
  **/
  function findRSSLinks(html){
    var doc    = parseXML(html);
    var links  = doc ? doc.querySelectorAll("link[type='application/rss+xml'], link[type='application/atom+xml']") : [];
    var result = [];

    var href;
    for(var i=0; i<links.length; ++i){
      if(href = links[i].getAttribute('href')){
        result.push(href);
      }
    }
    return result.length ? result : null;
  }

  /**
   * Parses an XML string into an RSS or an Atom feed.
   * Returns null if it fails.
  **/
  function parseFeed(xml){
    var doc = parseXML(xml);

    if(doc && doc.querySelectorAll('channel').length){
      return parseRSS(doc);
    }
    else if(doc && doc.querySelectorAll('feed').length){
      return parseAtom(doc);
    }

    return null;
  }
  
  
  /**
   * A directive for the rss item preview pane.
  **/
  angular.module('eyegeeApp').lazy.directive('rssItemPreview', function ($compile) {
    return { 
      restrict: "A", 
      replace:  false, 
      link: function($scope, element, attrs) {
        attrs.$observe('item', function(val){
          if(val){
            element[0].style.top = ($scope.previewTarget.offsetTop - 20) + "px";
          }
        });
      }
    };
  });
  
  // Need to account for the "all" option instead of just numbers
  angular.module('eyegeeApp').lazy.filter('loopRss', function() {
    // This filter is similar to the limitTo filter, except that
    // passing the string "all" as the limit parameter will loop over all array elements.
    return function(input, itemCount) {
      return itemCount === 'all' ? input : input.slice(0, itemCount);
    };
  });

  /**
   * Angular controller for RSS widgets.
   * Has a separate instance for each widget on the page.
  **/
  angular.module('eyegeeApp').lazy.controller('RssController', function ($scope, $http, $timeout, model, appconfig) {
    // Note for myself:
    // The following code runs only once per widget
    var widget = model.getWidgetById( $scope.widgetId );

    /**
     * Define the editBegin, editEnd and remove methods.
     * Each widget should have these defined.
    **/
    widget.editBegin = function editBegin(){
      $scope.sources    = widget.sources ? widget.sources.slice() : [];
      $scope.sourceInfo = {};
      $scope.sources.forEach(function(source){
        $scope.sourceInfo[source] = 'valid';
      });
      $scope.newSource  = "";
      $scope.errors     = [];
      $scope.itemCount  = widget.itemCount || 10;
      $scope.isEdited   = true;
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
    $scope.widget = widget;
    widget.$scope = $scope;
    widget.$working = 0;
    
    // These are used outside the edit mode
    $scope.itemCount  = widget.itemCount || 10;
    $scope.items      = [];
    $scope.title      = widget.title || "";

    // Upon initilization, we immediately show the edit screen if the widget is new
    // The __editToken is set to true when the user selects the widget's module
    if(widget.__editToken) {
      delete widget.__editToken;
      widget.editBegin();
    }
    // Otherwise we load the feeds
    else {
      loadFeeds();
    }

    /**
     * Runs when the addSource button is clicked
    **/
    $scope.addSource = function(){
      if(!$scope.newSource){ 
        return; 
      }

      // Remember this locally
      var source = $scope.newSource;

      // Remove the source from the scope so the field is empty
      $scope.newSource = "";
      addSource(source);
    }

    /**
     * Runs when the removeSource button is clicked
    **/
    $scope.removeSource = function(index){
      var source = $scope.sources.splice(index, 1)[0];
      delete $scope.sourceInfo[source];
    }

    /**
     * Saves the settings once the user is done editing.
     * Also runs validation before saving them. Validation rules:
     *  1. There needs to be at least 1 source that points to a valid RSS feed
     *  2. All invalid sources are automatically removed
    **/
    $scope.saveSettings = function(){
      var source, valid = false, i=0;
      for(source in $scope.sourceInfo){
        if($scope.sourceInfo[source] === 'valid'){
          valid = true;
          break;
        }
      }

      if(valid){
        // Stop editing, remove invalid sources and update the widget source list
        widget.itemCount = $scope.itemCount;
        widget.title = $scope.title;
        widget.sources = $scope.sources.map(function(source){ 
          return $scope.sourceInfo[source] === 'valid' ? source : null; 
        }).filter(function(source){
          return source;
        });

        $scope.sources = [];
        $scope.sourceInfo = {};
        $scope.isEdited = false;
        
        // Inform the model that a widget has changed and let it handle the storage.
        model.saveState();

        // Load the feeds and display them
        loadFeeds();
      }
    }
    
    /**
     * Shows the RSS item's description
    **/
    $scope.showPreview = function(item, $event){
      var node = $event.target;
      while(("" + node.className).indexOf('rss-item') === -1){
        // Look for the rss item div, which is the parent of the slide-pane div
        node = node.parentNode;
      }
      $scope.preview = item;
      $scope.previewTarget = node;
    }
    $scope.hidePreview = function(item){
      $scope.preview = null;
      $scope.previewTarget = null;
    }

    /**
     * Loads and parses the actual feeds
    **/
    function loadFeeds(){
      if(!widget.sources) {
        return widget.editBegin();
      }

      var i = 0; 
      var feeds = []; 
      var counter = widget.sources.length;
      
      widget.$working = counter ? 1 : 0;

      function done(){
        widget.$working = 0;

        if(feeds.length === 1) {
          $scope.items = feeds[0].items;
          $scope.widget.link = feeds[0].link;
        }
        else if (feeds.length > 1){
          $scope.items = [];
          feeds.forEach(function(feed){
            $scope.items = $scope.items.concat(feed.items);
          });
        }
        else {
          $scope.items = null;
        }
        
        // Setting this flag will remove the "empty" class on the widget container
        widget.$loaded = true;
      }

      widget.sources.forEach(function(source){
        $http({ url: '/proxy', method: 'POST', data: {source: source} })
        .success(function(data, status, headers, config){
          var parsed = parseFeed(data);
          parsed ? feeds.push(parsed) : $scope.errors.push("Can't parse feed " + source);
          --counter || done();
        })
        .error(function(data, status, headers, config){ 
          $scope.errors.push("Can't load feed " + source);
          --counter || done();
        });
      });
    }

    /**
     * Adds a new source URL to the widget's list of sources
    **/
    function addSource(source, atIndex){
      // We don't allow duplicates
      if($scope.sources.indexOf(source) > -1){
        return;
      }

      // Set the working flag
      widget.$working += 1;

      // Remember the index
      var index = isNaN(atIndex) ? $scope.sources.length : atIndex;

      // Add source to the sources list
      $scope.sources.splice(index, 0, source);

      // Mark the source as being checked
      $scope.sourceInfo[source] = "checking";

      $http({ url: '/proxy', method: 'POST', data: {source: source} })
      .success(function(data, status, headers, config){
        var links, feed;
        
        // Page is an RSS feed, mark the source as valid
        if(feed = parseFeed(data)){
          $scope.sourceInfo[source] = "valid";
          if($scope.title === appconfig.newWidgetTitle){
            $scope.title = feed.title;
          }
        }
        // Page contains rss feeds, replace the current source with all of them and check them
        else if(links = findRSSLinks(data)){
          var oldIndex = $scope.sources.indexOf(source);

          $scope.sources.splice(oldIndex, 1);
          delete $scope.sourceInfo[source];

          for(var i = 0; i < links.length; ++i){
            addSource(links[i], oldIndex + i);
          };
        }
        // Can't fetch page, mark the source as invalid and remove it
        else {
          $scope.sources.splice(index, 1);
          delete $scope.sourceInfo[source];
        }
        widget.$working -= 1;          
      })
      .error(function(data, status, headers, config){
        $scope.sources.splice(index, 1);
        delete $scope.sourceInfo[source];
        widget.$working -= 1;
      });
    }

  });
})();

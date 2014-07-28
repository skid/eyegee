// Looks for <link> elements with a "application/rss+xml" or "application/atom+xml" Content-Type.
// Returns an array of found links' href attributes or null if the parsing fails or there are no such links.
// IMPORTANT: All "src" and "href" attributes of external documents are prefixed with "data-"
function findRSSLinks(html){
  var doc = Eye.main.parseXML(html);
  var links = doc ? $("link[type='application/rss+xml'],link[type='application/atom+xml']", doc) : [];
  return (doc && links.length > 0) ? _.compact(links.map(function(){ return $(this).attr('data-href') }).toArray()) : null;
}

// Parses an XML string into an RSS or an Atom feed.
// Returns null if it fails.
function parseFeed(xml){
  var doc = Eye.main.parseXML(xml);
  return doc && ($('channel', doc).length == 1 ? parseRSS(doc) : ($('feed', doc).length == 1 ? parseAtom(doc) : null));
}

// RSS parser
// IMPORTANT: All "src" and "href" attributes of external documents are prefixed with "data-"
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
// IMPORTANT: All "src" and "href" attributes of external documents are prefixed with "data-"
function parseAtom(xml){
  var channel, feed = {};
  
  channel = $('feed', xml).eq(0);
  feed.version = '1.0';
  feed.title = channel.find('title:first').text();
  feed.link = channel.find('link:first').attr('data-href');
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

function checkSource(source, callback){
  $http({ 
    url:  '/proxy', 
    method: 'POST', 
    data: { source: source } 
  })
  .success(function(response){
    var feed, links;
    
    if(parseFeed(response)){
      callback(true);
    }
    else if(links = findRSSLinks(response)) {
      callback(links);
    }
    else {
      callback(false);
    }
  })
  .fail(function(xhr, status, text){
    callback(false);
  });
}



angular.module('eyegeeApp').lazy.controller('RssController', function ($scope, $http, modelFactory) {
  var widget = modelFactory.getWidgetById( $scope.widgetId );

  (widget.sources) || (widget.sources = []);

  $scope.widget = widget;
  $scope.siteName = widget.extra;
  $scope.isEdited = 1;

  $scope.newSource = "";
  
  $scope.addSource = function(index){
    if(!$scope.newSource) return;
    
    $scope.working = true;
    checkSource($scope.newSource, function(result){
      if(result === true){
        widget.sources.push($scope.newSource);
        
      }
    });
    
    
    $scope.newSource = "";
  }

});


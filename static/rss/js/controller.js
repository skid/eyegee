(function(){
  /**
   * Taken from http://stackoverflow.com/questions/7474710/can-i-load-an-entire-html-document-into-a-document-fragment-in-internet-explorer/7539198
   * @param String html    The string with HTML which has be converted to a DOM object
   * @param func callback  (optional) Callback(HTMLDocument doc, function destroy)
   * @returns              undefined if callback exists, else: Object
  **/
  function string2dom(html, callback){
    html = sanitiseHTML(html);

    /* Create an IFrame */
    var iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    function destroy(){
      iframe.parentNode.removeChild(iframe);
    }
    if(callback) {
      return callback(doc, destroy);
    }
    return { "doc": doc, "destroy": destroy };
  }


  /**
   * @param String html  A string representing HTML code
   * @return String      A new string, fully stripped of external resources. All "external" attributes (href, src) are prefixed by "data-"
  **/
  function sanitiseHTML(html){
    /**
     * Adds a <!-\"'--> before every matched tag, so that unterminated quotes
     * aren't preventing the browser from splitting a tag. Test case:
     *    '<input style="foo;b:url(0);><input onclick="<input type=button onclick="too() href=;>">'
    **/
    var prefix = "<!--\"'-->";

    /**
     * Attributes should not be prefixed by these characters. 
     * This list is not complete, but will be sufficient for this function.
     * (see http://www.w3.org/TR/REC-xml/#NT-NameChar) 
    **/
    var att = "[^-a-z0-9:._]";
    var tag = "<[a-z]";
    var any = "(?:[^<>\"']*(?:\"[^\"]*\"|'[^']*'))*?[^<>]*";
    var etag = "(?:>|(?=<))";
    var entityEnd = "(?:;|(?!\\d))";
    var ents = { 
      " ": "(?:\\s|&nbsp;?|&#0*32"+entityEnd+"|&#x0*20"+entityEnd+")",
      "(": "(?:\\(|&#0*40"+entityEnd+"|&#x0*28"+entityEnd+")",
      ")": "(?:\\)|&#0*41"+entityEnd+"|&#x0*29"+entityEnd+")",
      ".": "(?:\\.|&#0*46"+entityEnd+"|&#x0*2e"+entityEnd+")"
    };
    /* Placeholder to avoid tricky filter-circumventing methods */
    var charMap = {};
    /* Short-hand space */
    var s = ents[" "] + "*";

    /* Important: Must be pre- and postfixed by < and >. RE matches a whole tag! */
    function ae(string){
      var all_chars_lowercase = string.toLowerCase();
      if(ents[string]) {
        return ents[string];
      }
      var all_chars_uppercase = string.toUpperCase();
      var RE_res = "";

      for(var i=0; i<string.length; i++){
        var char_lowercase = all_chars_lowercase.charAt(i);
        if(charMap[char_lowercase]){
          RE_res += charMap[char_lowercase];
          continue;
        }
        var char_uppercase = all_chars_uppercase.charAt(i);
        var RE_sub = [char_lowercase];
        RE_sub.push("&#0*" + char_lowercase.charCodeAt(0) + entityEnd);
        RE_sub.push("&#x0*" + char_lowercase.charCodeAt(0).toString(16) + entityEnd);
        if(char_lowercase != char_uppercase){
          RE_sub.push("&#0*" + char_uppercase.charCodeAt(0) + entityEnd);   
          RE_sub.push("&#x0*" + char_uppercase.charCodeAt(0).toString(16) + entityEnd);
        }
        RE_sub = "(?:" + RE_sub.join("|") + ")";
        RE_res += (charMap[char_lowercase] = RE_sub);
      }
      return(ents[string] = RE_res);
    }

    function by(match, group1, group2){
      /* Adds a data-prefix before every external pointer */
      return group1 + "data-" + group2;
    }

    /**
     * @description            Selects a HTML element and performs a search-and-replace on attributes
     * @param String selector  HTML substring to match
     * @param String attribute RegExp-escaped; HTML element attribute to match
     * @param String marker    Optional RegExp-escaped; marks the prefix
     * @param String delimiter Optional RegExp escaped; non-quote delimiters
     * @param String end       Optional RegExp-escaped; forces the match to end before an occurence of <end> when quotes are missing
    **/
    function cr(selector, attribute, marker, delimiter, end){
      if(typeof selector == "string") {
        selector = new RegExp(selector, "gi");
      }
      marker = typeof marker == "string" ? marker : "\\s*=";
      delimiter = typeof delimiter == "string" ? delimiter : "";
      end = typeof end == "string" ? end : "";
  
      var is_end = end && "?";
      var re1 = new RegExp("("+att+")("+attribute+marker+"(?:\\s*\"[^\""+delimiter+"]*\"|\\s*'[^'"+delimiter+"]*'|[^\\s"+delimiter+"]+"+is_end+")"+end+")", "gi");
  
      html = html.replace(selector, function(match){
        return prefix + match.replace(re1, by);
      });
    }

    /**
     * @description            Selects an attribute of a HTML element, and performs a search-and-replace on certain values
     * @param String selector  HTML element to match
     * @param String attribute RegExp-escaped; HTML element attribute to match
     * @param String front     RegExp-escaped; attribute value, prefix to match
     * @param String flags     Optional RegExp flags, default "gi"
     * @param String delimiter Optional RegExp-escaped; non-quote delimiters
     * @param String end       Optional RegExp-escaped; forces the match to end before an occurence of <end> when quotes are missing
    **/
    function cri(selector, attribute, front, flags, delimiter, end){
      if(typeof selector == "string") {
        selector = new RegExp(selector, "gi");
      }
      flags = typeof flags == "string" ? flags : "gi";
      var re1 = new RegExp("("+att+attribute+"\\s*=)((?:\\s*\"[^\"]*\"|\\s*'[^']*'|[^\\s>]+))", "gi");
  
      end = typeof end == "string" ? end + ")" : ")";
      var at1 = new RegExp('(")('+front+'[^"]+")', flags);
      var at2 = new RegExp("(')("+front+"[^']+')", flags);
      var at3 = new RegExp("()("+front+'(?:"[^"]+"|\'[^\']+\'|(?:(?!'+delimiter+').)+)'+end, flags);
  
      var handleAttr = function(match, g1, g2){
        return g2.charAt(0) == '"' ? g1+g2.replace(at1, by) : (g2.charAt(0) == "'" ? g1+g2.replace(at2, by) : g1+g2.replace(at3, by));
      };
      html = html.replace(selector, function(match){
        return prefix + match.replace(re1, handleAttr);
      });
    }

    /* <meta http-equiv=refresh content="  ; url= " > */
    html = html.replace(new RegExp("<meta"+any+att+"http-equiv\\s*=\\s*(?:\""+ae("refresh")+"\""+any+etag+"|'"+ae("refresh")+"'"+any+etag+"|"+ae("refresh")+"(?:"+ae(" ")+any+etag+"|"+etag+"))", "gi"), "<!-- meta http-equiv=refresh stripped-->");

    /* Stripping all scripts */
    html = html.replace(new RegExp("<script"+any+">\\s*//\\s*<\\[CDATA\\[[\\S\\s]*?]]>\\s*</script[^>]*>", "gi"), "<!--CDATA script-->");
    html = html.replace(/<script[\S\s]+?<\/script\s*>/gi, "<!--Non-CDATA script-->");
    cr(tag+any+att+"on[-a-z0-9:_.]+="+any+etag, "on[-a-z0-9:_.]+"); /* Event listeners */

    cr(tag+any+att+"href\\s*="+any+etag, "href"); /* Linked elements */
    cr(tag+any+att+"src\\s*="+any+etag, "src"); /* Embedded elements */

    cr("<object"+any+att+"data\\s*="+any+etag, "data"); /* <object data= > */
    cr("<applet"+any+att+"codebase\\s*="+any+etag, "codebase"); /* <applet codebase= > */

    /* <param name=movie value= >*/
    cr("<param"+any+att+"name\\s*=\\s*(?:\""+ae("movie")+"\""+any+etag+"|'"+ae("movie")+"'"+any+etag+"|"+ae("movie")+"(?:"+ae(" ")+any+etag+"|"+etag+"))", "value");

    /* <style> and < style=  > url()*/
    cr(/<style[^>]*>(?:[^"']*(?:"[^"]*"|'[^']*'))*?[^'"]*(?:<\/style|$)/gi, "url", "\\s*\\(\\s*", "", "\\s*\\)");
    cri(tag+any+att+"style\\s*="+any+etag, "style", ae("url")+s+ae("(")+s, 0, s+ae(")"), ae(")"));

    /* IE7- CSS expression() */
    cr(/<style[^>]*>(?:[^"']*(?:"[^"]*"|'[^']*'))*?[^'"]*(?:<\/style|$)/gi, "expression", "\\s*\\(\\s*", "", "\\s*\\)");
    cri(tag+any+att+"style\\s*="+any+etag, "style", ae("expression")+s+ae("(")+s, 0, s+ae(")"), ae(")"));
    return html.replace(new RegExp("(?:"+prefix+")+", "g"), prefix);
  }

  
  function parseXML(xml) {
    var doc = null;
    var reHTML = new RegExp("<\\!doctype", "i");

    // XML document, use the native parser
    if(!reHTML.test(xml)){
      try {
        if (window.ActiveXObject) {
          doc = new ActiveXObject("Microsoft.XMLDOM");
          doc.loadXML(xml);
        }
        else {
          doc = (new DOMParser).parseFromString(xml, "text/xml");
        }
      } catch(e){
        doc = null; // Can't parse - invalid XML
      }
      return doc;
    }
    // A HTML document, use the iframe parser
    else {
      doc = string2dom(xml);
      // Will remove the injected iframe on the next loop.
      setTimeout(doc.destroy, 0);
      return doc.doc;
    }
  }

  // Looks for <link> elements with a "application/rss+xml" or "application/atom+xml" Content-Type.
  // Returns an array of found links' href attributes or null if the parsing fails or there are no such links.
  // IMPORTANT: All "src" and "href" attributes of external documents are prefixed with "data-"
  function findRSSLinks(html){
    var doc = parseXML(html);
    var links = doc ? $("link[type='application/rss+xml'],link[type='application/atom+xml']", doc) : [];
    return (doc && links.length > 0) ? links.map(function(){ return $(this).attr('data-href') }).toArray().filter(function(e){ return e; }) : null;
  }


  // Parses an XML string into an RSS or an Atom feed.
  // Returns null if it fails.
  function parseFeed(xml){
    var doc = parseXML(xml);
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
  
  /**
   * Angular controller for RSS widgets.
   * Has a separate instance for each widget on the page.
  **/
  angular.module('eyegeeApp').lazy.controller('RssController', function ($scope, $http, $timeout, model) {
    // Note for myself:
    // The following code runs only once per widget
    var widget = model.getWidgetById( $scope.widgetId );

    $scope.widget = widget;
    widget.$scope = $scope; // Expose the scope
      
    // These are used outside the edit mode
    $scope.itemCount  = widget.itemCount || 10;
    $scope.items      = [];
    $scope.title      = widget.title || "";
    
    widget.editBegin = function(){
      $scope.sources    = widget.sources ? widget.sources.slice() : [];
      $scope.sourceInfo = {};
      $scope.sources.forEach(function(source){
        $scope.sourceInfo[source] = 'valid';
      });

      $scope.newSource  = "";
      $scope.errors     = [];
      $scope.itemCount  = widget.itemCount || 10;
      $scope.items      = [];
      
      $scope.loading   = false;
      $scope.isEdited  = true;
      $scope.isWorking = 0;
    }

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

    // Note for myself:
    // The above code runs only once per widget

    /**
     * Runs when the addSource button is clicked
    **/
    $scope.addSource = function(){
      if(!$scope.newSource){ return; }

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
     * Loads the RSS feeds from the sources
    **/
    function loadFeeds(){
      var i = 0, feeds = [], counter = widget.sources.length;

      function done(){
        $scope.loading = false;
        if(feeds.length === 1) {
          $scope.title || (widget.title = feeds[0].title || "No title");
          $scope.items = feeds[0].items;
          $scope.widget.link = feeds[0].link;
        }
        else if (feeds.length > 1){
          $scope.title || (widget.title = "Multiple Feeds");
          $scope.items = [];
          feeds.forEach(function(feed){
            $scope.items = $scope.items.concat(feed.items);
          });
        }
        else {
          $scope.items = null;
        }
      }

      widget.sources.forEach(function(source){
        $scope.loading = true;
        $http({ 
          url:  '/proxy', 
          method: 'POST', 
          data: { source: source } 
        })
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
     * Loads a URL and, parses the result and then runs the callback
     * passing it an argument which can be one of the folowing 3:
     *  1. Boolean true - the URL points to a valid RSS resource
     *  2. Boolean false - there is an error loading the URL
     *  3. Array of strings - The URL points to a html that links to RSS pages.
    **/
    function checkSource(source, callback){
      $http({ 
        url:  '/proxy', 
        method: 'POST', 
        data: { source: source } 
      })
      .success(function(data, status, headers, config){
        var feed, links;
        parseFeed(data) ? callback(true) : (links = findRSSLinks(data)) ? callback(links) : callback(false);        
      })
      .error(function(data, status, headers, config){ 
        callback(false); 
      });
    }

    // Add source
    function addSource(source, atIndex){
      var i, oldIndex, index;
      
      // We don't allow duplicates
      if($scope.sources.indexOf(source) > -1){
        return;
      }

      // Set the working flag
      $scope.isWorking += 1;
      
      // Remember the index
      index = isNaN(atIndex) ? $scope.sources.length : atIndex;

      // Add source to the sources list
      $scope.sources.splice(index, 0, source);

      // Mark the source as being checked
      $scope.sourceInfo[ source ] = "checking";

      // Check the source
      checkSource(source, function(result){
        // Page is an RSS feed
        if(result === true){
          $scope.sourceInfo[ source ] = "valid";
        }
        // Can't fetch page, mark the source as invalid and remove it after one second
        else if(result === false){
          $scope.sourceInfo[ source ] = "invalid";
          // TODO: Make the timeout configurable and add a transition effect
          $timeout(function(){
            $scope.sources.splice(index, 1);
            delete $scope.sourceInfo[source];
          }, 1000);
        }
        // Page contains rss feeds, replace the current source with all of them and check them
        else {
          i, oldIndex = $scope.sources.indexOf(source);
          
          $scope.sources.splice(oldIndex, 1);
          delete $scope.sourceInfo[source];

          for(i = 0; i < result.length; ++i){
            addSource(result[i], oldIndex + i);
          };
        }

        $scope.isWorking -= 1;
      });
    }
  });

})();

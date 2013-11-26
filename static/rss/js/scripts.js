/**
 * RSS Module methods
 * Expects the RSS module manifest to be already loaded.
**/
(function(){
  
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
        comments: item.find('comments').eq(0).text()
      });
    });

    return feed;
  }
  
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
  
  function parseFeed(xml){
    var xmldoc, feed;

    if (window.ActiveXObject) {
      xmldoc = new ActiveXObject("Microsoft.XMLDOM");
      xmldoc.loadXML(xml);
      xml = xmldoc;
    }
    if( typeof xml === 'string' ) {
      xml = $.parseXML(xml);
    }

    return ($('channel', xml).length == 1) ? parseRSS(xml) : ($('feed', xml).length == 1) ? parseAtom(xml) : null;
  }
  
  
  
  
  /**
   * This is not a real prototype.
   * The attributes of this object are copied over the base widget supplied by main.
  **/
  var WidgetProto = {
    // Marks that a widget has been extended with the RSS methods
    _rss: true,
    // Marks if the widget has been rendered at least once, hence appeneded to the DOM
    _rendered: false,
    // Keeps the latest parsed XML feed
    _parsed: null,

    // Reneders the widget contents and appends the widget box to the DOM, if not already appended
    render: function(){
      // At this point, the widget object (this) should have a list of feed items
      // and an 'attributes' attribute which holds the general info about the feed
      

      // If this is the first time we render this widget
      // we also append it to the DOM.
      if(!this._rendered) {
        Eye.main.appendWidget(this);
        this._rendered = true;
      }
    },

    // Each widgets has a "data" property.
    // Its content depends on the "data" property and this method's job
    // is to take a look at it and decide what to show.
    prepare: function(callback){
      this.getFeed(function(err, feed){
        // TODO: Handle errors

        this.items = feed.items;
        this.attributes = {
          title: feed.title,
          description: feed.description,
          link: feed.link
        }
        callback();
      });
    },

    getFeed: function(callback){
      // TODO: cache feeds and then expire them. Trigger an automatic refresh on cache expiry.

      $.ajax('/rss/feed', {
        context: this,
        data: { source: this.data.source },
        success: function(feed){
          var feed = parseFeed(feed);
          callback(feed || new Error("Can't parse feed"), feed);
        },
        error: function(){
          // TODO: Examine the server error
          callback(new Error("A server error happened"));
        }
      });
    }
  }

  
  
  
  
  // Uses the data argument to either create a new widget
  // or modify an existing one (if a valid id is provided)
  Eye.rss.setWidget = function(data){
    var widget = Eye.main.widget(data.id);

    widget._rss || _.extend(widget, WidgetProto);
    widget.data = data;
    widget.prepare(function(){
      widget.render();
    });
  }

})();

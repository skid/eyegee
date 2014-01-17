/**
 * RSS Module methods
 * Expects the RSS module manifest to be already loaded.
**/
(function(){
  var tLink = _.template("<a target='_blank' href='<%= link %>'><%= title %></a>");

  var RSSMixin = {
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
      this.title.html(tLink(this.attributes));

      this.content.html(this.items.slice(0, this.config.count).map(function(item){
        return "<div class='rss-item'>" + tLink(item) + "</div>";
      }).join(""));

      if(this.config.count < this.items.length){
        this.content.append("<div class='rss-show-all'>Show All</div>");
      }
    },

    // Each widget has a "data" property.
    // Its content depends on the "data" property and this method's job
    // is to take a look at it and decide what to show.
    prepare: function(callback){
      var self = this;
      this.getFeed(function(err, feed){
        if( err ) {
          // TODO: Better error handling
          return alert(err.message);
        }

        self.items = feed.items;
        self.attributes = {
          title: feed.title,
          description: feed.description,
          link: feed.link
        }
        callback();
      });
    },

    getFeed: function(callback){
      // TODO: cache feeds and then expire them. Trigger an automatic refresh on cache expiry.

      $.ajax('/module/rss/feed', {
        type: 'post',
        context: this,
        data: { source: this.config.source },
        success: function(response){
          var feed = parseFeed(response);
          callback(feed ? null : new Error("Can't parse feed"), feed);
        },
        error: function(xhr, status, text){
          callback(new Error(text));
        }
      });
    }
  }

  // Uses the data argument to either create a new widget
  // or modify an existing one (if a valid id is provided)
  Eye.rss.setWidget = function(config){
    var widget = Eye.main.getWidget(config.id);

    widget._rss || _.extend(widget, RSSMixin);
    widget.config = config;
    
    // We append the widget immiediately to the body.
    // It will show a loading gif until we render real content in it.
    if(!widget._rendered) {
      Eye.main.appendWidget(widget);
      widget._rendered = true;
    }

    widget.prepare(function(){
      widget.render();
      Eye.main.trigger('widget:ready', widget);
    });
  }
  
  //
  // Widget Logic
  //
  $(document).delegate('.rss-show-all', 'click', function(e){
    var widget = Eye.main.getWidget($(this).parents('.widget-container').data('id'));
    if(widget) {
      widget.config.count = 10000;
      widget.render();
    }
  });
  
  //
  // RSS Parsers
  //
  function parseFeed(xml){
    var xmldoc, feed;
    
    try {
      if (window.ActiveXObject) {
        xmldoc = new ActiveXObject("Microsoft.XMLDOM");
        xmldoc.loadXML(xml);
        xml = xmldoc;
      }
      if( typeof xml === 'string' ) {
        xml = $.parseXML(xml);
      }
    } catch(e){
      // Can't parse - invalid XML
      return null;
    }

    return ($('channel', xml).length == 1) ? parseRSS(xml) : ($('feed', xml).length == 1) ? parseAtom(xml) : null;
  }

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
})();

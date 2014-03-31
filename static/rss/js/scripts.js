/**
 * RSS Module methods
 * Expects the RSS module manifest to be already loaded.
**/
(function(){
  var tLink = _.template("\
<a target='_blank' href='<%= link %>'><%= title %></a>");

  var tItem = _.template("\
<div class='rss-item clearfix'>\
  <% if(comments){ %>\
    <div class='rss-item-meta'>\
      <a class='ion-chatbubble-working rss-item-comments' href='<%= comments %>' target='_blank' title='Comments'></a>\
    </div>\
  <% } %>\
  <%= link %>\
</div>");

  var tSource = _.template("\
<div class='rss-sources'>\
  <input class='rss-source-existing rss-input' type='text' placeholder='RSS Feed / Site URL' data-url='<%= url %>' disabled>\
  <a class='ion-trash-b rss-source-remove' href='javascript:;'></a>\
</div>");

  var tSourceFake = _.template("\
<div class='rss-sources'>\
  <span class='rss-input-fake'><%= url %><span> &nbsp; <%= message %></span></span>\
  <a class='ion-trash-b rss-source-remove' href='javascript:;'></a>\
</div>");

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

      var count = parseInt(this.config.count, 10);
      isNaN(count) && (count = 100000);

      this.content.html(this.items.slice(0, count).map(function(item){
        return tItem({ link: tLink(item), comments: item.comments || null });
      }).join(""));

      if(count < this.items.length){
        this.content.append("<div class='rss-show-all'>Show All</div>");
      }
    },

    // Each widget has a "data" property.
    // Its content depends on the "data" property and this method's job
    // is to take a look at it and decide what to show.
    prepare: function(callback){
      var self  = this;
      var count = this.config.sources.length;
      var items = [];
      var attributes = {
        title: this.config.title || (count > 1 ? "Multiple Feeds" : ""),
        link: (count > 1 ? null : "")
      };

      function next(err){
        if(err) {
          return callback(err);
        }

        _.each(items, function(item){
          item.updated = (new Date(item.updated)).getTime() || 9999999999999;
        });

        self.items = items.sort(function(a, b){ return a.updated === b.updated ? 0 : a.updated > b.updated ? -1 : 1});
        self.attributes = attributes;
        callback();
      }
      
      this.config.sources.forEach(function(source){
        self.getFeed(source, function(err, feed){
          if(err) {
            alert("An error happened with widget " + (self.config.title || self.config.id) + ".\n(" + err.message + ")");
          }
          else {
            items = items.concat(feed.items);
            attributes.title || (attributes.title = feed.title);
            attributes.link === null && (attributes.link = feed.link);
          }
          --count || next(err);
        });
      });
    },

    getFeed: function(source, callback){
      // TODO: cache feeds and then expire them. Trigger an automatic refresh on cache expiry.
      $.ajax({ url: '/module/rss/feed', type: 'post', context: this, data: { source: source }})
      .done(function(response){
        var feed = parseFeed(response);
        callback(feed ? null : new Error("Can't parse feed"), feed);
      })
      .fail(function(xhr, status, text){
        callback(new Error(text));
      });
    }
  }


  /**
   * This method will resolve any URLs passed to it into URLs to RSS feeds.
   * This works for:
   *    1. URLs to RSS feeds in XML
   *    2. URLs to websites that contain <link rel="alternate" type="application/rss+xml" href="..." /> HEAD element
   *    {
   *      "http://non-example.net": "Not an RSS feed",  // Couldn't resolve the webpage into a feed
   *      "http://wrong.url": "Can't reach URL",        // Couldn't open this URL
   *      "http://example.com/rss": 0,                  // This is a feed.
   *      "http://example.com": {                       // This webpage URL contains links to one or more feeds
   *        "http://example.com/rss": 0,
   *        "http://example.com/atom": 0
   *      }
   *    }
  **/
  Eye.rss.discover = function(sources, callback, depth){
    var count = sources.length;
    var results = {};

    // If no sources are passed, exit right away.
    // Also prevents following <link href="..."> tags more than 1 time. What twisted mind would do this anyway?
    if(sources.length === 0 || (depth = depth || 0) > 1) {
      return callback({});
    }

    sources.forEach(function(source){
      $.ajax({ 
        url:  '/module/rss/feed', 
        type: 'post', 
        data: { source: source }
      })
      .done(function(response){
        var feed, links;

        // If parsing for a feed succeeds, this is a direct URL to a feed.
        if(feed = parseFeed(response)) {
          results[source] = 0;
          --count || callback(results);
        }
        // Otherwise it's a URL to a page that hopefully contains URLs to feeds.
        else if(links = findRSSLinks(response)) {
          Eye.rss.discover(links, function(resolved){
            results[source] = resolved;
            --count || callback(results);
          }, depth + 1);
        }
        // Otherwise this is a faulty URL
        else {
          results[source] = "No feeds here";
          --count || callback(results);
        }
      })
      .fail(function(xhr, status, text){
        results[source] = "Can't reach URL";
        --count || callback(results);
      });
    });
  }
  
  // *****************************************************************
  // The next 3 module methods are required by the Eye.main framework.
  /**
   *  Required methods
   *
   *    The next 3 module methods are required by the Eye.main framework
   *    - setWidget() is called when a widget is initialized.
   *    - widget() is called when the user clicks on the "addWidget" buton or the "settings" button on an individual widget.
   *    - saveSettings() is called when the user clicks on the "OK" button in the widget settings dialog.
  **/
  
  

  /**
   * Sets properties on a newly created widget or an existing one,
   * then calls the render() method.
  **/
  Eye.rss.setWidget = function(config){
    var widget = Eye.main.getWidget(config.id);
    
    widget.setConfig(config);

    // This is done only once for each widget instance
    // The RSSMixin has a truthy _rss property
    if(!widget._rss) {
      _.extend(widget, RSSMixin);
      widget.element.addClass('rss');
    }

    // We append the widget immiediately to the body.
    // It will show a loading gif until we render real content in it.
    if(!widget._rendered) {
      Eye.main.appendWidget(widget);
      widget._rendered = true;
    }
    
    widget.prepare(function(err){
      if( !err ) {
        widget.render();
        Eye.main.trigger('widget:ready', widget);
      }
    });
  }


  /**
   * UI METHOD: This method is invoked when a user clicks somewhere
   * Populates the widget settings dialog with custom HTML for this module
  **/
  Eye.rss.widget = function (e, widget){
    // This line is mandatory for all implementations
    Eye.main.renderWidgetSettings(this, widget);

    // Will update the existing source input with their values.
    updateSourceURLS();

    // For new widgets, the widget argument is not passed
    if(widget) {
      var config = widget.config;

      // The Eye.main module will emit a "widget:<id>:settings" event
      // once the dialog has been rendered. We listen to that event ONCE
      // and we use it to populate the fields in the dialog.
      Eye.main.once('widget:' + config.id + ':settings', function(){
        $('.rss-source-existing').each(function(index){ $(this).val( config.sources[index] ); });
        $('.rss-settings > h3').html("RSS Widget Options");
        $('#rss-item-count').val(config.count);
        $('#rss-widget-title').val(config.title).focus();
      });
    }
    else {
      $('.rss-settings > h3').html("New RSS Widget");
      $('#rss-widget-title').focus();
    }
  }


  /** 
   * UI METHOD: This method is invoked when a user clicks somewhere
   * Takes care of creating/modifying a widget once the widget settings dialog is submitted.
  **/
  Eye.rss.saveSettings = function(e, widgetId){
    // Here we try to get the widget whose settings we're editing.
    // If it's a NEW widget, the "widgetId" argument will be undefined 
    // and main.getWidget will return a new instance.
    // Existing RSS widgets will have the "_rss" property defined
    var widget = Eye.main.getWidget(widgetId);
    var id     = widget._rss ? widget.config.id : null;

    var sources = _.compact($('.rss-source-existing').map(function(index, input){ return input.value.trim(); }).toArray());
    var count   = $('#rss-item-count').val();
    var title   = $('.rss-title').val();
    
    // TODO: Better validation
    if(sources.length === 0) {
      alert("Provide at least one valid URL");
      return;
    }

    // Before saving anything, we want to check the source URLs for validity  
    // and discover any RSS feeds from non-rss URLs.
    Eye.rss.discover(sources, function(results){

      // If all the sources are valid RSS links, we proceed with saving.
      if(_.all(_.values(results), function(result){ return result === 0; })) {
        var config = { module: 'rss', count: count, title: title, sources: sources, id: id };
        widget.save(config, function(err, id){
          config.id = id;
          Eye.rss.setWidget(config);
        });
      }

      // Otherwise we notify the user that some of the sources were replaced/invalidated.
      else {
        $('.rss-source-existing').each(function(){
          var self = $(this);
          var result = results[ self.val() ];
          var html;

          // A valid RSS feed, leave it intact.
          if(result === 0) {
            return;
          }
          // An url that linked to one or more feeds
          else if( _.isObject(result) ) {
            var inputs = _.map(result, function(result, url){
              return result === 0 ? tSource({ url: url }) : tSourceFake({ url: url, message: result });
            }).join("");
            self.parent().replaceWith(inputs);
          }
          // An invalid feed url
          else {
            self.parent().replaceWith(tSourceFake({ url: self.val(), message: result }));
          }
        });

        // TODO: Inform the user that the URLS have been resolved.        
        updateSourceURLS(); // Will update the existing source input with their values.
      }
    });   
  }

  
  
  /**
   *  Helper functions
   *
   *    the following functions don't really belong anywhere
  **/
  
  // We can't put a value for input elements inside their "value" attribute
  // when we generate them as HTML and append to the DOM.
  // So whenever we create those, we put the value in a "data-url" property
  // and call this function which will change their value attribute later.
  function updateSourceURLS(){
    _.defer(function(){
      $('.rss-source-existing').each(function(){ $(this).val($(this).data('url')); });
    });
  }


  /**
   *  The DOM Logic
   *
   *    the following code handles UI element behavior
   *    for the widget elements and the widget settings window.
  **/
  $(document)

  // Toggle showing of all feed items
  .delegate('.rss-show-all', 'click', function(e){
    var widget = Eye.main.getWidget($(this).parents('.widget-container').data('id'));
    widget.config.count = "all";
    widget.render();
  })

  // Toggle the RSS item description (The optional CDATA sent with the RSS item)
  .delegate('.rss-item-description-toggle', 'click', function(e){
    $(this).parent().next().toggle();
  })

  // Add a new source when clicking the plus button
  .delegate('.rss-source-add', 'click', function(){
    var self = $(this), input = self.prev(), parent = self.parent();
    // Only add a new source input if we have a value in the current one.
    if( input.val() ) {
      parent.before( tSource({ url: input.val() }) );
      updateSourceURLS();
      input.val("").focus();
    }
  })
  
  // Add a new source when hitting Return (same as a click on the plus botton)
  .delegate('.rss-source-new', 'keypress', function(e){
    e.which === 13 && $(this).next().click();
  })
  
  // Remove an existing source when clicking the trash button
  .delegate('.rss-source-remove', 'click', function(){
    var next = $(this).parent().next();
    $(this).parent().remove();
    next.find('.rss-input, .rss-source-remove').focus();
  });



  /**
   *  RSS / HTML Parsers
   *
   *    The following code parses the RSS feeds and HTML.
  **/

  // Uses the browser's inbuilt XML parser to parse feeds or XML pages.
  function parse(xml) {
    var xmldoc = null;
    try {
      if (window.ActiveXObject) {
        xmldoc = new ActiveXObject("Microsoft.XMLDOM");
        xmldoc.loadXML(xml);
      }
      else {
        xmldoc = (new DOMParser).parseFromString(xml, "text/xml");
      }
    } catch(e){
      xmldoc = null; // Can't parse - invalid XML
    }
    return xmldoc;
  }
  
  // Looks for <link> elements with a "application/rss+xml" or "application/atom+xml" Content-Type.
  // Returns an array of found links' href attributes or null if the parsing fails or there are no such links.
  function findRSSLinks(html){
    var doc = parse(html);
    var links = doc ? $("link[type='application/rss+xml'],link[type='application/atom+xml']", doc) : [];
    return (doc && links.length > 0) ? _.compact(links.map(function(){ return $(this).attr('href') }).toArray()) : null;
  }
  
  // Parses an XML string into an RSS or an Atom feed.
  // Returns null if it fails.
  function parseFeed(xml){
    var doc = parse(xml);
    return doc && ($('channel', doc).length == 1 ? parseRSS(doc) : ($('feed', doc).length == 1 ? parseAtom(doc) : null));
  }
  
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
})();

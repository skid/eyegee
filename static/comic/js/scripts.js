/**
 * RSS Module methods
 * Expects the RSS module manifest to be already loaded.
**/
(function(){
  var tLink = _.template("<a target='_blank' href='<%= link %>'><%= title %></a>");
  var tComic = _.template("\
<div class='comic-item clearfix'>\
  <div>\
    <% if(prev){ %><a class='comic-nav-link comic-prev' href='<%= prev %>'>Previous</a> <% } %>\
    <% if(next){ %><a class='comic-nav-link comic-next' href='<%= next %>'>Next</a> <% } %>\
  </div>\
  <img src='/proxy?source=<%= url %>'>\
</div>");

  var ComicMixin = {
    // Marks that a widget has been extended with the ComicMixin methods
    _comic: true,
    // Marks if the widget has been rendered at least once, hence appeneded to the DOM
    _rendered: false,

    // Reneders the widget contents and appends the widget box to the DOM, if not already appended
    render: function(){
      this.title.html(tLink(this.config));
      this.content.html(tComic({ url: this.image, prev: this.linkPrev, next: this.linkNext }));
    },

    // Each widget has a "data" property.
    // Its content depends on the "data" property and this method's job
    // is to take a look at it and decide what to show.
    prepare: function(callback){
      var self = this;
      var parser = Parsers[self.config.source];

      $.ajax({ url: '/proxy', type: 'post', context: this, data: { source: this.config.url }})
      .done(function(response){
        var parsed = parser(response);

        if(parsed === null) {
          alert("An error happened with widget " + (self.config.title || self.config.id) + ".\nCan't parse remote page.");
        }
        else {
          self.image = parsed.url;
          self.linkPrev = parsed.prev;
          self.linkNext = parsed.next;
          callback();
        }
      })
      .fail(function(xhr, status, text){
        alert("An error happened with widget " + (self.config.title || self.config.id) + ".\n(" + text + ")");
        callback();
      });
    },
    
    setComic: function(url){
      var self = this;
      this.config.url = url;
      this.prepare(function(){ self.render(); });
    }
  }

  // Uses the data argument to either create a new widget
  // or modify an existing one (if a valid id is provided)
  Eye.comic.setWidget = function(config){
    var widget = Eye.main.getWidget(config.id);
    
    widget.setConfig(config);
    
    if(!widget._comic) {
      _.extend(widget, ComicMixin);
      widget.element.addClass('comic');
    }

    // We append the widget immiediately to the body.
    // It will show a loading gif until we render real content in it.
    if(!widget._rendered) {
      Eye.main.appendWidget(widget);
      widget._rendered = true;
    }

    widget.prepare(function(err, data){
      widget.render();
      Eye.main.trigger('widget:ready', widget);
    });
  }

  /**
   * UI METHOD: This method is invoked when a user clicks somewhere
   * Populates the widget settings dialog with custom HTML for this module
  **/
  Eye.comic.widget = function (e, widget){
    // This line is mandatory for all implementations
    Eye.main.renderWidgetSettings(this, widget);
    
    // For new widgets, the widget argument is not passed
    if(widget) {
      var config = widget.config;

      // The Eye.main module will emit a "widget:<id>:settings" event
      // once the dialog has been rendered. We listen to that event ONCE
      // and we use it to populate the fields in the dialog.
      Eye.main.once('widget:' + config.id + ':settings', function(){
        $('.comic-settings > h3').html("Comic Widget (" + config.title + ")");
        $('#comic-site-name').val(widget.config.source).focus();
      });
    }
    else {
      $('.comic-settings > h3').html("New Comic Widget");
      $('#rss-widget-title').focus();
    }
  }

  /** 
   * UI METHOD: This method is invoked when a user clicks somewhere
   * Takes care of creating/modifying a widget once the widget settings dialog is submitted.
  **/
  Eye.comic.saveSettings = function(e, widgetId){
    // Here we try to get the widget whose settings we're editing.
    // If it's a NEW widget, the "widgetId" argument will be undefined 
    // and main.getWidget will return a new instance.
    // Existing Comic widgets will have the "_comic" property defined
    var widget = Eye.main.getWidget(widgetId);
    var id     = widget._comic ? widget.config.id : null;
    var source = $('#comic-site-name').val();
    var config = { module: 'comic', source: source, url: Sources[source].url, title: Sources[source].title, link: Sources[source].link, id: id };

    widget.save(config, function(err, id){
      config.id = id;
      Eye.comic.setWidget(config);
    });
  }

  //
  // Widget DOM Logic
  //
  $(document)
  .delegate('.comic-nav-link', 'click', function(e){
    var widget = Eye.main.getWidget($(this).parents('.widget-container').data('id'));
    widget.setComic($(this).attr('href'))
    e.preventDefault();
  });  
  
  // 
  // Different comic strip parsers
  //
  var Sources = {
    dilbert: {
      url: "http://www.dilbert.com/strips",
      link: "http://www.dilbert.com",
      title: "Dilbert"
    },
    cyanide: {
      url: "http://explosm.net/comics/",
      link: "http://explosm.net/comics/",
      title: "Cyanide and Happiness"
    },
    xkcd: {
      url:  "http://xkcd.com/",
      link: "http://xkcd.com/",
      title: "XKCD"
    }
  }

  var Parsers = {
    dilbert: function(xml){
      var doc;

      if(!(doc = Eye.main.parseXML(xml))) {
        return null;
      }
      
      var prev = $('.STR_Prev.PNG_Fix', doc).attr('data-href');
      var next = $('.STR_Next.PNG_Fix', doc).attr('data-href');
      
      return { 
        url:  "http://dilbert.com" + $('.STR_Image', doc).eq(0).find('img').attr('data-src'), 
        prev: prev && ("http://dilbert.com" + prev),
        next: next && ("http://dilbert.com" + next)
      };
    },
    
    cyanide: function(xml){
      if(!(doc = Eye.main.parseXML(xml))) {
        return null;
      }

      var url  = $('#maincontent', doc).find('>div').eq(1).find('>div').eq(0).find('img').attr('data-src')
      var prev = $('#maincontent', doc).find('>div').eq(1).find('a[rel=prev]').attr('data-href');
      var next = $('#maincontent', doc).find('>div').eq(1).find('a[rel=next]').attr('data-href');
      return { 
        url:  url ? url.substr(0, 4) === 'http' ? url : "http://explosm.net" + url : null,
        prev: prev && ("http://explosm.net" + prev),
        next: next && ("http://explosm.net" + next)
      };
    },
    
    xkcd: function(xml){
      if(!(doc = Eye.main.parseXML(xml))) {
        return null;
      }

      var url  = $('#comic', doc).find('img').attr('data-src')
      var prev = $('.comicNav', doc).find('a[rel=prev]').attr('data-href');
      var next = $('.comicNav', doc).find('a[rel=next]').attr('data-href');
      return { 
        url:  url ? url.substr(0, 4) === 'http' ? url : "http://xkcd.com" + url : null,
        prev: prev && prev !== "#" && ("http://xkcd.com" + prev),
        next: next && next !== "#" && ("http://xkcd.com" + next)
      };
    }
  }
})();

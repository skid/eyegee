/**
 * RSS Module methods
 * Expects the RSS module manifest to be already loaded.
**/
(function(){
  var tLink = _.template("<a target='_blank' href='<%= link %>'><%= title %></a>");
  var tItem = _.template("\
<div class='rss-item clearfix'>\
  <% if(comments){ %>\
    <div class='rss-item-meta'>\
      <a class='rss-item-comments' href='<%= comments %>' target='_blank'>Comments</a>\
    </div>\
  <% } %>\
  <%= link %>\
</div>");

  var ComicMixin = {
    // Marks that a widget has been extended with the ComicMixin methods
    _comic: true,
    // Marks if the widget has been rendered at least once, hence appeneded to the DOM
    _rendered: false,

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

    widget.prepare(function(){
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
    var config = { module: 'comic', source: source };

    widget.save(config, function(err, id){
      config.id = id;
      Eye.comic.setWidget(config);
    });
  }

  //
  // Widget DOM Logic
  //
  $(document);
})();

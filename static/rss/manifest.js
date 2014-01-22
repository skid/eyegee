/**
 * RSS Module manifest
**/
(function(){
  Eye.rss = {
    module:      'rss',
    dialog:      '/static/rss/html/dialog.html',
    main:        '/static/rss/js/scripts.js',
    stylesheet:  '/static/rss/css/styles.css',
    name:        'RSS',
    icon:        'ion-social-rss',
    description: '',
    
    /**
     * UI METHOD: This method is invoked when a user clicks somewhere
     *
     * Populates the widget settings dialog with custom HTML for this module
    **/
    widget: function(e, widget){
      // Once we fetch the dialog, we can replace this method with a simpler one
      // that uses the cached version of the dialog HTML.
      this.widget = function(e, widget){

        // For new widgets, the widget argument is not passed
        if(widget) {
          Eye.main.once('widget:' + widget.config.id + ':settings', function(){
            $('#rss-item-count').val(widget.config.count);
            $('#rss-source').val(widget.config.source);
          });
        }

        Eye.main.renderWidgetSettings(this, widget);
      }

      $.ajax(this.dialog, {
        context: this,
        success: function(html){
          this.dialog = html;
          this.widget(e, widget);
        }
      });
    },

    /**
     * UI METHOD: This method is invoked when a user clicks somewhere
     *
     * Takes care of creating/modifying a widget once the widget settings dialog is submitted.
    **/
    saveSettings: function(e, widgetId){
      var widget = Eye.main.getWidget(widgetId);
      var config = {
        module: 'rss',
        count: $('#rss-item-count').val(),
        source: $('#rss-source').val(),
        // Existing RSS widgets will have the "_rss" property defined
        id: widget._rss ? widget.config.id : null
      };

      // The setWidget methods is defined in the main script file
      // At this point we don't know if it's loaded yet.
      var next = _.bind(function(){ this.setWidget(config); }, this);

      $.ajax('/module/rss/widget', {
        type: 'post',
        data: config,
        context: this,
        dataType: 'json',
        success: function(response){
          // The response should return a new ID for new widgets 
          // or the existing ID for olds widgets. IDs are unique per user per widget.
          if (response.status === 'ok'){
            config.id = response.id;
            this.setWidget ? next() : require(this.main, next);
            $('head').append($("<link rel='stylesheet' href='" + this.stylesheet + "'>"));
          }
        }
      });
    }
  };
})();


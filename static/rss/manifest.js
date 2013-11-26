/**
 * RSS Module manifest
**/
(function(){
  Eye.rss = {
    module:      'rss',
    dialog:      '/static/rss/html/dialog.html',
    main:        '/static/rss/js/scripts.js',
    name:        'RSS Widget',
    icon:        'ion-social-rss',
    description: 'Add an RSS feed from your favourite site',

    newWidget: function(callback){
      // Once we fetch the dialog, we can replace this method with a simpler one  
      this.newWidget = function(callback){
        Eye.main.setWidgetPaletteDialog(this);
      }

      $.ajax(this.dialog, {
        context: this,
        success: function(html){
          this.dialog = html;
          this.newWidget();
        }
      });
    },

    // Called when clicking OK
    saveSettings: function(){
      // These element IDs should be unique in the document.
      // The elements are defined in rss/html/dialog.html.
      var data  = {
        count: $('#rss-item-count').val(),
        source: $('#rss-source').val(), 
        id:    null
      };

      // This is used in the callback
      var next = _.bind(function(){ this.setWidget(data); }, this);

      $.ajax('/module/rss/widget', {
        type: 'post',
        data: data,
        context: this,
        dataType: 'json',
        success: function(response){
          if (response.status === 'ok'){
            data.id = response.id;
            // The setWidget is defined in the main script file
            this.setWidget ? next() : require(this.main, next);
          }
        }
      });
    }
  };
})();

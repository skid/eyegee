/**
 * RSS Module manifest
**/
(function(){
  Eye.rss = {
    module:      'rss',
    dialog:      '/static/rss/html/dialog.html',
    main:        '/static/rss/js/scripts.js',
    stylesheet:  '/static/rss/css/styles.css',
    name:        'RSS Feed',
    icon:        'ion-social-rss',
    description: 'Add a single feed or combine multiple feeds into this widget.',

    /**
     * UI METHOD: This method is invoked when a user clicks somewhere
     *
     * A PLACEHOLDER method for Eye.rss.widget()
     *
     * If the module is not loaded, this method will load it. The module's main
     * script will in turn overwrite the "widget()" method with the one that does useful stuff.
     * Once that is done, we can call Eye.rss.widget() again.
    **/
    widget: function(e, widget){
      Eye.main.loadModule('rss', function(){
        this.widget(e, widget);
      });
    }
  };
})();

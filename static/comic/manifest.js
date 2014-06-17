/**
 * Comics Module manifest
**/
(function(){
  Eye.comic = {
    module:      'comic',
    dialog:      '/static/comic/html/dialog.html',
    main:        '/static/comic/js/scripts.js',
    stylesheet:  '/static/comic/css/styles.css',
    name:        'Comics',
    icon:        'ion-images',
    description: 'A daily comic strip from a selection of popular websites.',

    /**
     * UI METHOD: This method is invoked when a user clicks somewhere
     *
     * A PLACEHOLDER method for Eye.rss.widget()
     *
     * If the module is not loaded, this method will load it. The module's main
     * script will in turn overwrite the "widget()" method with the one that does useful stuff.
     * Once that is done, we can call Eye.comic.widget() again.
    **/
    widget: function(e, widget){
      Eye.main.loadModule('comic', function(){
        this.widget(e, widget);
      });
    }
  };
})();

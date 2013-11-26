(function(){
  // Some DOM elements that exist in index.html
  var ePalette = $('#add-widget-window');
  var eLogin = $('login-window');
  var eMain = $('main');
  
  // Cache for existing widget instances
  var Cache = {};
  
  // Namespace for main functionality and widgets
  window.Eye = {
    main: {}
  };
  
  // All widgets use this template as their topmost element.
  // They produce their own html for the content box and the title.
  var tWidget = _.template("\
<div class='widget-container'>\
  <div class='widget-head'>\
    <h3 class='widget-title'></h3>\
  </div>\
  <div class='widget-content'></div>\
</div>");

  /**
   * Serves as a basic abstract class for widgets.
   * Modules should extend this to make their own widgets.
  **/
  function Widget(id){
    this.id      = id;
    this.element = tWidget({});
    this.head    = this.element.find('.widget-head');
    this.title   = this.element.find('.widget-title');
    this.content = this.element.find('.widget-content');
  };
  

  Eye.main.getWidget = function(id){
    return Cache[id] || (Cache[id] = new Widget(id));
  }

  Eye.main.appendWidget = function(widget){
    eMain.append(widget.element);
  }
  

  // Palette item template. 
  // Allows the user to pick what new widget to add.
  var tPaletteItem = _.template("\
<div class='palette-item' data-module='<%= module %>' data-method='newWidget' control>\
 <div class='<%= icon %>'></div>\
 <h3><%= name %></h3>\
 <p><%= description %></p>\
</div>");
  
  // New widget dialog template.
  // Allows the user to pick settings and add the new widget.
  var tAddWidget = _.template("\
<div class='add-widget'>\
  <%= dialog %>\
  <button type='button' data-module='main' data-method='openWidgetPalette' control>Cancel</button>\
  <button type='button' data-module='<%= module %>' data-method='saveSettings' control>OK</button>\
</div>");
    
  /**
   * Opens the palette for choosing a new widget.
   * This palette also contains the dialog for making settings.
  **/
  Eye.main.openWidgetPalette = function(){
    // Order the modules (except main) in the palette alphabetically and then render the manifest
    // Underscore FTW
    ePalette.html( _.without(_.keys(Eye), 'main').sort().map(function(k){ return Eye[k]; }).map(tPaletteItem).join("") );
    ePalette.addClass('shown');
  }
  
  /**
   * Changes the pallette window contets to the "new widget dialog"
  **/
  Eye.main.setWidgetPaletteDialog = function(module){
    ePalette.html( tAddWidget( module ) );
    ePalette.addClass('shown');
  }

  /**
   * Loads the manifest for the available modules and populates the Add Widget palette.
   * Then it loads the scripts for the modules used by the user.
  **/
  function initModules(callback){
    require.apply(this, _.map(MODULES, function(mod){
      return "/static/" + mod + "/manifest.js";
    }).concat(function(){
      // Do something when manifests are loaded
      // Load the user modules
    }));
  }

  window.init = function init(){
    initModules();

    $('body').delegate('[control]', 'click', function(){
      Eye[ $(this).data('module') ][ $(this).data('method') ]();
    }); 
  }

})();


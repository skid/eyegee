(function(){
  /* Cache for existing widget instances */
  var Cache = {};
  
  /* Elements */
  var eMain        = $('main');
    
  /* Modal Dialogs */
  var eUserModal   = $('#user-modal');
  var eWidgetModal = $('#widget-modal');

  eUserModal.on('mousedown', function(e){ e.originalEvent._stopCloseOperation = eUserModal; });
  eWidgetModal.on('mousedown', function(e){ e.originalEvent._stopCloseOperation = eWidgetModal; });

  var modals = [eUserModal, eWidgetModal];
  
  /* Templates */
  var tWidget         = _.template( $('#widget-template').html() );
  var tWidgetIcon     = _.template( $('#widget-icon-template').html() );
  var tWidgetSettings = _.template( $('#widget-settings-template').html() );
  
  /**
   * Serves as a basic abstract class for widgets.
   * Modules should extend this to make their own widgets.
  **/
  function Widget(id){
    this.id      = id;
    this.element = $(tWidget({}));

    this.head    = this.element.find('.widget-head');
    this.title   = this.element.find('.widget-title');
    this.content = this.element.find('.widget-content');
  };
  
  /**
   * Function that deals with modal window positioning.
   * This will allow modal windows to appear as dropdown menus under items.
  **/
  function showWindow(el, target){
    var offset = target.offset();
    var scroll = $(window).scrollTop();
    var width  = $(window).width();
    var size   = { w: target.outerWidth(), h: target.outerHeight() };
    
    var css = { position: "absolute", left: "", right: "", bottom: "" , top: Math.round(offset.top - scroll + size.h) };
    
    if( width - size.w / 2 >= offset.left ) {
      css.left = Math.round(offset.left);
    }
    else {
      css.right = Math.round(width - offset.left - size.w);
    }

    el.css(css).addClass('shown');
  }
  
  /** 
   * EyeGee module namespace.
   *
   * We immediately define the "main" module which takes care of 
   * management of other modules, widgets and page initialization. 
  **/
  window.Eye = {
    main: {
      /**
       * Returns a widget by id or creates a new one 
       * and sets the data-id property.
      **/
      getWidget: function(id){
        var widget = Cache[id];
        if(!widget) {
          widget = (Cache[id] = new Widget(id));
          widget.element.attr('data-id', id);
        }
        return widget;
      },

      /**
       * Appends a widget to the body
      **/
      appendWidget: function(widget){
        eMain.append(widget.element);
      },

      /**
       * Renders the widget settings dialog in the widget window.
       * The widget settings dialog depends on the module the widget belongs to.
      **/
      renderWidgetSettings: function(module){
        eWidgetModal.html(tWidgetSettings(module));

        // Hide the widget settings modal once the widget is ready.
        // The specific widget module needs to fire a "widget:ready" events.
        this.once("widget:ready", function(widget){
          eWidgetModal.removeClass('shown');
        });
      },
      
      /**
       * Renders the widget picker dialog in the widget window.
       * The widget picker dialog depends on the avaiable modules.
      **/
      renderWidgetPicker: function(){
        // Order the modules (except main) in the palette alphabetically and then render the manifest
        eWidgetModal.html( _.without(_.keys(Eye), 'main').sort().map(function(k){ return Eye[k]; }).map(tWidgetIcon).join("") );
      },

      /**
       * Opens the widget modal window and renders the widget icons in it - which is the default view.
       * This palette also contains the dialog for making settings.
      **/
      showWidgetWindow: function(e){
        this.renderWidgetPicker();
        showWindow(eWidgetModal, $(e.target));
      },
      
      /**
       * Opens the user modal window and renders the user settings dialog in it
      **/
      showUserWindow: function(e){
        showWindow(eUserModal, $(e.target));
      }
    }
  };

  /**
   * Make Eye.main an event manager
  **/
  _.extend(Eye.main, Backbone.Events);

  /**
   * Loads the manifest for the available modules and populates the Add Widget palette.
   * Then it loads the scripts for the modules used by the user.
  **/
  window.init = function init(){

    require.apply(this, _.map(MODULES, function(mod){
      return "/static/" + mod + "/manifest.js";
    }).concat(function(){
      // For each widget used by the current user, we need to load its module.
      var scripts = USER.widgets.map(function(widget){ return Eye[widget.module].main; });

      // After loading the modules, we need to initialize and render the widgets.
      require.apply(this, scripts.concat(function(){
        USER.widgets.forEach(function(widget){
          // This will initialize the widget and render it
          Eye[widget.module].setWidget(widget);
        });
      }));
      
      // Now load any stylesheets too
      USER.widgets.forEach(function(widget){ 
        var module = Eye[widget.module]; 
        module.stylesheet && $('head').append($("<link rel='stylesheet' href='" + module.stylesheet + "'>"));
      });
      
    }));
    
    // Initialize the button's actions
    $('body').delegate('[control]', 'click', function(e){
      Eye[ $(this).data('module') ][ $(this).data('method') ](e);
    });
    
    // Close modal windows when you click outside them
    $(document).on('mousedown', function(e){
      modals.forEach(function(modal){
        e.originalEvent._stopCloseOperation !== modal && modal.removeClass('shown');
      });
    });
  }

})();

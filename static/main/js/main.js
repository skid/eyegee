(function(){
  /* Cache for existing widget instances */
  var Cache = {};
  
  /* Elements */
  var eMain        = $('main');
  var eUserModal   = $('#user-modal');
  var eWidgetModal = $('#widget-modal');
  
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
   * EyeGee module namespace.
   *
   * We immediately define the "main" module which takes care of 
   * management of other modules, widgets and page initialization. 
  **/
  window.Eye = {
    main: {
      /**
       * Returns a widget by id or creates a new one
      **/
      getWidget: function(id){
        return Cache[id] || (Cache[id] = new Widget(id));
      },
      
      /**
       * Appends a widget to the body
      **/
      appendWidget: function(widget){
        eMain.append(widget.element);
      },

      /**
       * Opens the widget modal window and renders the widget itcons in it.
       * This palette also contains the dialog for making settings.
      **/
      showWidgetIcons: function(){
        // Order the modules (except main) in the palette alphabetically and then render the manifest
        eWidgetModal.html( _.without(_.keys(Eye), 'main').sort().map(function(k){ return Eye[k]; }).map(tWidgetIcon).join("") );
        eWidgetModal.addClass('shown');
      },
      
      /**
       * Opens the widget modal window and renders the widget settings dialog in it.
       * The widget settings dialog depends on the module the widget belongs to.
      **/
      showWidgetSettings: function(module){
        eWidgetModal.html( tWidgetSettings( module ) );
        eWidgetModal.addClass('shown');

        // Hide the widget settings modal once the widget is ready.
        // The specific widget module needs to fire a "widget:ready" events.
        this.once("widget:ready", function(widget){
          eWidgetModal.removeClass('shown');
        });
      },


      /**
       * Opens the user modla window and renders the user settings dialog in it
      **/
      showUserSettings: function(){
        
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
      var loadees = USER.widgets.map(function(widget){ 
        return Eye[widget.module].main; 
      });

      // After loading the modules, we need to initialize and render the widgets.
      require.apply(this, loadees.concat(function(){
        USER.widgets.forEach(function(widget){
          // This will initialize the widget and render it
          Eye[widget.module].setWidget(widget);
        });
      }));
    }));

    $('body').delegate('[control]', 'click', function(){
      Eye[ $(this).data('module') ][ $(this).data('method') ]();
    }); 
  }

})();

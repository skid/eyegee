(function(){
  /* Cache for existing widget instances */
  var Cache = {};
  
  /* Templates */
  var tWidget         = _.template( $('#widget-template').html() );
  var tWidgetIcon     = _.template( $('#widget-icon-template').html() );
  var tWidgetSettings = _.template( $('#widget-settings-template').html() );
  
  /* Elements */
  var eMain           = $('main');
  var eBackdrop       = $('#backdrop');

  /* Inputs */
  var eEmailInput     = $('#email');
  var ePasswordInput  = $('#password');
  var ePassCheckInput = $('#password-check');

  /* Buttons */
  var eSessionButton  = $('#session-button');
  var eRegisterButton = $('#register-button');
  var eLoginButton    = $('#login-button');

  /* Modal Dialogs */
  var eUserModal   = $('#user-modal');
  var eWidgetModal = $('#widget-modal');
  var modals       = [eUserModal, eWidgetModal];

  // Modify the original event while it bubbles up.
  // We need to know which modal window is being clicked on so we don't close it by mistake.
  _.each(modals, function(modal){
    modal.on('mousedown', function(e){ 
      e.originalEvent._currentModal = modal;
    });
  });

  /**
   * Deals with modal window positioning.
   * This will allow modal windows to appear as dropdown menus under items.
  **/
  function showModal(el, target){
    var offset = target.offset();
    var scroll = $(window).scrollTop();
    var width  = $(window).width();
    var size   = { w: target.outerWidth(), h: target.outerHeight() };
    var css    = { position: "absolute", left: "", right: "", bottom: "" , top: Math.round(offset.top - scroll + size.h) };

    css.right = Math.round(width - offset.left - size.w);
    
    if(target){
      // The "target" is a button that invoked the modal
      // We want to style it to look like it's part of the modal.
      // We also need to keep a reference to it for when the modal closes.
      target.addClass('modal-active');
      el.__invoker = target;
    }
    el.css(css).addClass('shown');
  }

  /**
   * Hides a specific modal and sends a signal that the modal 
   * in question has been hidden.
  **/
  function hideModal(el, target) {
    el.removeClass('shown');

    if(el.__invoker) {
      el.__invoker.removeClass('modal-active');
      el.__invoker = null;
    }
  }
  
  
  /**
   * Serves as a basic abstract class for widgets.
   * Modules should extend this to make their own widgets.
  **/
  function Widget(id){
    this.id      = id;
    this.element = $(tWidget({ id: this.id }));

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
      // Add a key in the waiting hash when you want to prevent some action
      // from happening while you're waiting for ajax results.
      // Be sure to remove the key when the waiting is over.
      waiting: {},

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
       * Registers the user
      **/
      userRegister: function(){
        var email = eEmailInput.val();
        var pass = ePasswordInput.val();

        // TODO: regex the email and provide a friendlier validation
        if(ePassCheckInput.val() !== pass || !email) {
          return alert("No email or passwords don't match");
        }

        this._setUser('/register', email, pass);
      },
      
      /**
       * Signs in the user
      **/
      userSignin: function(){
        var email = eEmailInput.val();
        var pass = ePasswordInput.val();

        this._setUser('/signin', email, pass);
      },
      
      /**
       * Signs out the user
      **/
      userSignout: function(){
        $.ajax("/signout", { 
          success: function(){ 
            window.location.reload(); 
          }
        });
      },
      
      /**
       * Private method that sends the user's email and password
       * for registration or login.
      **/
      _setUser: function(url, email, pass){
        if(this.waiting.register) {
          return;
        }
        
        this.once("user:ready", function(widget){
          hideModal(eUserModal);
        });

        // TODO: Refactor ajax calls to handle errors
        this.waiting.register = true;
        $.ajax(url, {
          type: "post",
          dataType: "json",
          data: { 
            email: email, 
            password: pass 
          },
          context: this,
          success: function(response) {
            delete this.waiting.register;
            // Set the global user variable
            USER = response.user;
            // This setup all the widgets
            setupSession();
            this.trigger('user:ready');
          },
          error: function(xhr, status, message){
            delete this.waiting.register;
            this.off("user:ready");
            alert(message);
          }
        });
      },

      /**
       * Renders the widget settings dialog in the widget window.
       * The widget settings dialog depends on the module the widget belongs to.
      **/
      renderWidgetSettings: function(module, widget){
        
        eWidgetModal.html(tWidgetSettings({ 
          module: module.module, 
          dialog: module.dialog, 
          extra: widget ? widget.config.id : "" 
        }));

        // Send a signal to existing widgets
        // that the widget dialog has been rendered
        if(widget) {
          this.trigger('widget:' + widget.config.id + ':settings');
        }

        // Hide the widget settings modal once the widget is ready.
        // The specific widget module needs to fire a "widget:ready" events.
        this.once("widget:ready", function(widget){
          hideModal(eWidgetModal);
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
       * UI METHOD: This method is invoked when a user clicks somewhere
       *
       * Removes a widget from the dashboard.
       * Sends a request to the backend to remove the widget from the user config.
      **/
      removeWidget: function(e, widgetId) {
        var widget = this.getWidget(widgetId);
        
        if( !confirm("Are you sure you want to remove this widget?") ) {
          return;
        }

        $.ajax("/remove_widget", {
          type: 'post',
          dataType: 'json',
          data: { id: widget.id },
          context: this,
          success: function(response){
            widget.element.remove();
            delete Cache[widgetId];
            USER.widgets = _.without(USER.widgets, _.findWhere(USER.widgets, { id: parseInt(widgetId, 10) }));
          },
          error: function(xhr, status, message){
            alert(message);
          }
        });
      },


      /**
       * UI METHOD: This method is invoked when a user clicks somewhere
       *
       * Opens the widget modal window and renders the widget icons in it - which is the default view.
       * This palette also contains the dialog for making settings.
      **/
      showWidgetWindow: function(e, widgetId){
        var instance;

        // Differentiate between a "settings" click and an "Add widget button" click
        if(widgetId) {
          instance = this.getWidget(widgetId);
          Eye[instance.config.module].widget(null, instance);
        }
        else {
          this.renderWidgetPicker();
        }

        showModal(eWidgetModal, $(e.target));
      },
      
      /**
       * UI METHOD: This method is invoked when a user clicks somewhere
       *
       * Opens the user modal window and renders the user settings dialog in it
      **/
      showUserWindow: function(e){
        showModal(eUserModal, $(e.target));
      }
    }
  };

  /**
   * Make Eye.main an event manager
  **/
  _.extend(Eye.main, Backbone.Events);


  /**
   * Loads the scripts for the modules used by the user session.
   * Then it initializes the widgets.
  **/
  function setupSession(){
    if(window.USER && USER.email) {
      eSessionButton.html(USER.email);
      eLoginButton.html("Sign Out").attr('data-method', "userSignout");
      eRegisterButton.html("Update").attr('data-method', "userUpdate");
    }
    else {
      eSessionButton.html("Sign in / Register");
      eLoginButton.html("Sign In").attr('data-method', "userSignin");
      eRegisterButton.html("Register").attr('data-method', "userRegister");
    }

    // TODO: show a nice landing page if there are no widgets
    eMain.empty();

    // For each widget used by the current user, we need to load its module.
    var scripts = USER.widgets.map(function(widget){ 
      return Eye[widget.module].main; 
    });

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
  }


  /**
   * This is executed only once, at page load.
   *  1. It binds some global event listeners
   *  2. Loads the manifests for the available modules and populates the widget picker.
   *  3. Then it calls the setupSession function which loads the needed scripts for the session and initializes the widgets.
  **/
  window.init = function init(){
    // Initialize the button's actions
    $('body').delegate('[control]', 'click', function(e){
      var module = Eye[ $(this).data('module') ];
      var method = $(this).data('method');
      var extra  = $(this).data('extra');

      // Pass the event object only to methods of Eye.main.
      // since this is the only module that cares about positioning.
      module[method](e, extra);
    });

    // Close modal windows when you click outside them
    $(document).on('mousedown', function(e){
      modals.forEach(function(modal){
        e.originalEvent._currentModal !== modal && hideModal(modal);
      });
    });

    // Load any modules that the current session uses and then run "setupSession"
    require.apply(this, _.map(MODULES, function(mod){
      return "/static/" + mod + "/manifest.js";
    }).concat(setupSession));
  }

})();

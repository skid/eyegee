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
    var css    = {  
      right: Math.round(width - offset.left - size.w), 
      top: Math.round(offset.top - scroll + size.h),
    };

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
   * Simple drag-drop functionality.
   * It's implemented into separate functions since it won't be used elsewhere.
  **/
  var placeholder = $("<div class='drag-placeholder'></div>");
  var draggable   = null;
  var offset      = null;
  var mouse       = null;
  var before      = null;
  var wmap        = {};
  var positions   = {};
  var lefts       = [];
  
  // Returns the positions of all widgets in a data structure easy for searching
  function calcPositions(){
    var scrollTop = $(window).scrollTop();
    positions = {};
    
    $('.column').each(function(){
      var column = $(this);
      var left = parseInt(column.offset().left, 10) + column.width();

      positions[left] = [];
      column.children('.widget-container').each(function(){
        if(draggable && draggable.element.is(this)) {
          return;
        }

        var self = $(this);
        var top  = Math.round(parseInt(self.offset().top) + self.outerHeight() / 2);
        positions[left].push(top);
        wmap["" + left + top] = Eye.main.getWidget(self.data('id'));
      });
      positions[left].sort(function(a, b){ return a > b ? 1 : a < b ? -1 : 0; });
    });

    lefts = _.map(_.keys(positions), function(left){ return parseInt(left); }).sort(function(a, b){ return a > b ? 1 : a < b ? -1 : 0; });
  }

  // Executed when dragging begins
  function drag(widgetId, e){
    var width, height;

    draggable = Eye.main.getWidget(widgetId);
    width = draggable.element.outerWidth();
    height = draggable.element.height();
    offset = draggable.element.position();
    mouse = { y: e.pageY, x: e.pageX };

    draggable.element.before(placeholder.css('height', height));
    draggable.element.css({ width: width, height: height, top: offset.top, left: offset.left });
    draggable.element.addClass('dragging');

    calcPositions();
    $(document).on('mousemove', dragStep);
    $(document).on('mouseup', drop);
  }

  // Executed when dragging ends
  function drop(e){
    var oldcol = draggable.element.parent();
    var oldpos = oldcol.children().not(placeholder).index(draggable.element);

    draggable.element.removeClass('dragging').css({ width: "", height: "", top: "", left: "" })
    placeholder.after(draggable.element).detach();
    
    var newcol = draggable.element.parent();
    var newpos = newcol.children().not(placeholder).index(draggable.element);

    if( !oldcol.is(newcol) || oldpos !== newpos ) {
      draggable.config.column = $('.column').index(newcol);
      draggable.save({ id: draggable.id, column: draggable.config.column, position: newpos });
    }

    draggable = offset = mouse = before = null;
    positions = wmap = {};
    lefts = [];
    
    $(document).off('mousemove', dragStep);
    $(document).off('mouseup', drop);
  }
  
  
  // Executed on each mousemove event
  function dragStep(e){
    var deltaX = mouse.x - e.pageX; 
    var deltaY = mouse.y - e.pageY; 
    var focused, left, top, i = 0, j = 0;

    while(left = lefts[i++]){
      if(e.pageX >= left) continue;
      
      while(top = positions[left][j++]) {
        if(e.pageY < top) break;
      }
      break;
    }
    
    mouse  = { x: mouse.x - deltaX, y: mouse.y - deltaY };
    offset = { top: offset.top - deltaY, left: offset.left - deltaX };
    draggable.element.css(offset);
    
    if(focused = wmap["" + left + top]) {
      if(before === focused) {
        return;
      }
      before = focused;
      before.element.before(placeholder);
      calcPositions();
    }
    else {
      focused = $('.column').eq(lefts.indexOf(left));
      if(focused.is(before)) {
        return;
      }
      before = focused;
      before.append(placeholder);
      calcPositions();
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
    this.config  = { column: 0 }; // New widgets are automatically added to column 0
  };
    
  Widget.prototype.setConfig = function(config){
    _.extend(this.config, config);
  }

  Widget.prototype.save = function(config, callback){
    config.column = this.config.column;

    $.ajax({
      url: '/widget',
      type: 'post', 
      data: JSON.stringify(config),
      dataType: 'json',
      contentType: 'application/json; charset=utf-8'
    }).done(function(response){
      if(response.status === 'ok'){
        callback && callback(null, response.id);
      }
      else {
        alert("Handle this error");
      }
    });
  }


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
       * Appends a widget to the correct column.
      **/
      appendWidget: function(widget){
        $('.column').eq(widget.config.column).append(widget.element);
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
          data: { email: email, password: pass },
          context: this
        })
        .done(function(response) {
          delete this.waiting.register;
          // Set the global user variable
          USER = response.user;
          // This will setup all the widgets
          setupSession(true);
          this.trigger('user:ready');
        })
        .fail(function(xhr, status, message){
          delete this.waiting.register;
          this.off("user:ready");
          alert(message);
        });
      },


      /**
       * Renders the widget settings dialog in the widget window.
       * The widget settings dialog depends on the module the widget belongs to.
      **/
      renderWidgetSettings: function(module, widget){
        eWidgetModal.html(tWidgetSettings({ 
          // The module name is used in the main template
          module: module.module, 
          // The we render the specific module dialog template which
          // in turn gets inserted as HTML inside the main template
          dialog: module.dialog({ widget: widget }),
          // We also pass the widget id as an extra parameter
          extra: widget ? widget.config.id : ""
        }));

        // Send a signal to existing widgets that the widget dialog has been rendered
        widget && _.defer(function(){
          Eye.main.trigger('widget:' + widget.config.id + ':settings');
        });

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
       * Loads all resources of a particular module
      **/
      loadModule: function(moduleName, callback){
        // TODO: Add a loading indicator on the module icon
        var module = Eye[moduleName];
        var count = 2;
        
        // This prevent the modules from being loaded multiple times
        // but at the same time executes all callbacks sent to loadModule.
        module._cbq || (module._cbq = []);
        module._cbq.push(callback);

        if(module._isLoading) {
          return; 
        }

        if(module._isLoaded) {
          return callback.call(module);
        }

        module._isLoading = true;

        function done(){
          if(--count === 0) {
            // We actually don't need this, since the "widget method" of the module
            // will get replaced once the module is loaded, so "loadModule" will never be called again.
            module._isLoaded = true;
            module._isLoading = false;
            module._cbq.forEach(function(callback){
              callback.call(module);
            });
          }
        }

        $.ajax(module.dialog)
        .done(function(html){ 
          module.dialog = _.template(html); 
        })
        .fail(function(){
          alert("TODO: Handle this error"); // TODO: Handle this error
        })
        .always(done);

        require(module.main, module.stylesheet, done);
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

        $.ajax("/remove_widget", { type: 'post', dataType: 'json', data: { id: widget.id }})
        .done(function(response){
          widget.element.remove();
          delete Cache[widgetId];
          USER.widgets = _.without(USER.widgets, _.findWhere(USER.widgets, { id: parseInt(widgetId, 10) }));
        })
        .fail(function(xhr, status, message){
          alert(message);
        })
        .always(function(){
          hideModal(eWidgetModal)
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
  function setupSession(emptyCache){
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

    // Empty the main window and cache
    eMain.empty();

    if(emptyCache) {
      Cache = {};
    }
    else {
      _.each(Cache, function(widget){ 
        widget._rendered = false; 
      });
    }
    
    // Add the columns
    for(var i = 0; i < (USER.columns || 3); ++i) {
      eMain.append("<div class='column column-" + (USER.columns || 3) + "'></div>");
    }

    // For each widget used by the current user, 
    // we need to load its module and then show the widget.
    USER.widgets.forEach(function(config){
      Eye.main.loadModule(config.module, function(){
        Eye[config.module].setWidget(config);
      });
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
    $('body')
    .delegate('[control]', 'click', function(e){
      var module = Eye[ $(this).data('module') ];
      var method = $(this).data('method');
      var extra  = $(this).data('extra');

      // Pass the event object only to methods of Eye.main.
      // since this is the only module that cares about positioning.
      module[method](e, extra);
    });

    // Close modal windows when you click outside them
    $(document)
    .on('mousedown', function(e){
      modals.forEach(function(modal){
        e.originalEvent._currentModal !== modal && hideModal(modal);
      });

      if(e.button === 0 && $(e.target).is('.widget-head')) {
        drag($(e.target).parent().data('id'), e);
      }
    });

    // Load any modules that the current session uses and then run "setupSession"
    require.apply(this, _.map(MODULES, function(mod){
      return "/static/" + mod + "/manifest.js";
    }).concat(setupSession));
  }

})();

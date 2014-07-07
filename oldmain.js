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
      /** HELPER METHOD: ParseXML
       *
       *    Parses an XML document using the browser's built-in facility
      **/
      parseXML: function(xml) {
        var doc = null;
        var reHTML = new RegExp("<\\!doctype", "i");
        
        // XML document, use the native parser
        if(!reHTML.test(xml)){
          try {
            if (window.ActiveXObject) {
              doc = new ActiveXObject("Microsoft.XMLDOM");
              doc.loadXML(xml);
            }
            else {
              doc = (new DOMParser).parseFromString(xml, "text/xml");
            }
          } catch(e){
            doc = null; // Can't parse - invalid XML
          }
          return doc;
        }
        // A HTML document, use the iframe parser
        else {
          doc = string2dom(xml);

          // Will remove the injected iframe on the next loop.
          _.defer(doc.destroy);
          return doc.doc;
        }
      },

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

        $('#widget-pane').append(tWidgetSettings({
          // The module name is used in the main template
          module: module.module, 
          // The we render the specific module dialog template which
          // in turn gets inserted as HTML inside the main template
          dialog: module.dialog({ widget: widget }),
          // We also pass the widget id as an extra parameter
          extra: widget ? widget.config.id : ""
        }));

        _.defer(function(){
          $('#widget-pane > .section:not(.widget-settings)').addClass('hidden-post');
          $('#widget-pane > #' + module.module + '-settings').removeClass('hidden-pre');
        });

        // Send a signal to existing widgets that the widget dialog has been rendered
        widget && _.defer(function(){
          Eye.main.trigger('widget:' + widget.config.id + ':settings');
        });
        
        // Place a loading indicator on the save/remove buttons once they've been clicked
        this.once('widget:saving', function(widget){
          $('.loader-button').addClass('loading');
        });
        
        // Hide the widget settings modal once the widget is ready.
        // The specific widget module needs to fire a "widget:ready" events.
        this.once("widget:ready", function(widget){
          UI.hideAllPanes();
        });
      },
      

      /**
       * Renders the widget picker dialog in the widget window.
       * The widget picker dialog depends on the avaiable modules.
      **/
      renderWidgetPicker: function(){
        // Order the modules (except main) in the palette alphabetically and then render the manifest
        $('#widget-pane').html(
          _.without(_.keys(Eye), 'main').sort().map(function(k){ return Eye[k]; }).map(tWidgetIcon).join("")
        );
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
          showModal(eWidgetModal, $(e.target));
        }
        else {
          if( $('#widget-pane').is('.active') ) {
            $('#widget-pane > .widget-picker').removeClass('hidden-post');
            $('#widget-pane > .widget-settings').addClass('hidden-pre');
          }
          else {
            this.renderWidgetPicker();
          }
        }
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
      eLoginButton.html("Sign Out").attr('data-method', "userSignout");
      eRegisterButton.html("Update").attr('data-method', "userUpdate");
    }
    else {
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

  
  var UI = {

    /* UI Element collections */
    panes: $('#widget-pane,#preferences-pane,#user-pane'),
    navbtns: $('nav.main > button'),
    
    hideAllPanes: function(){
      this.panes.removeClass('active');
      this.navbtns.removeClass('active inactive');
    },

    showWidgetPane: function(){
      $('#widget-pane').addClass('active');
      Eye.main.renderWidgetPicker();
    },

    showPreferencesPane: function(){
      $('#preferences-pane').addClass('active');
    },

    showUserPane: function(){
      $('#user-pane').addClass('active');
    }

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
      
      if($(this).is('.loading')) {
        return;
      }
      
      // Pass the event object only to methods of Eye.main.
      // since this is the only module that cares about positioning.
      module[method](e, extra);
    });

    // Initialize animations on navigation buttons
    $('nav.main').delegate('button', 'click', function(){
      var self = $(this);
      var invoke = self.data('invoke');
      
      if(self.is('.active')) {
        return;
      }

      self.siblings().addClass('inactive');
      self.removeClass('inactive').addClass('active');
      invoke && UI[invoke]();
    });

    // Close modal windows when you click outside them
    $(document)
    .on('mousedown', function(e){
      e.button === 0 && $(e.target).parents('.pane').length === 0 && !$(e.target).is('.pane') && UI.hideAllPanes();
      
      if(e.button === 0 && $(e.target).is('.widget-head')) {
        drag($(e.target).parent().data('id'), e);
      }
    });

    // Load any modules that the current session uses and then run "setupSession"
    require.apply(this, _.map(MODULES, function(mod){
      return "/static/" + mod + "/manifest.js";
    }).concat(setupSession));
  }



  /**
   * Taken from http://stackoverflow.com/questions/7474710/can-i-load-an-entire-html-document-into-a-document-fragment-in-internet-explorer/7539198
   * @param String html    The string with HTML which has be converted to a DOM object
   * @param func callback  (optional) Callback(HTMLDocument doc, function destroy)
   * @returns              undefined if callback exists, else: Object
  **/
  function string2dom(html, callback){
    html = sanitiseHTML(html);
  
    /* Create an IFrame */
    var iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);
  
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
  
    function destroy(){
      iframe.parentNode.removeChild(iframe);
    }
    if(callback) {
      return callback(doc, destroy);
    }
    return { "doc": doc, "destroy": destroy };
  }
  

  /**
   * @param String html  A string representing HTML code
   * @return String      A new string, fully stripped of external resources. All "external" attributes (href, src) are prefixed by "data-"
  **/
  function sanitiseHTML(html){
    /**
     * Adds a <!-\"'--> before every matched tag, so that unterminated quotes
     * aren't preventing the browser from splitting a tag. Test case:
     *    '<input style="foo;b:url(0);><input onclick="<input type=button onclick="too() href=;>">'
    **/
    var prefix = "<!--\"'-->";
  
    /**
     * Attributes should not be prefixed by these characters. 
     * This list is not complete, but will be sufficient for this function.
     * (see http://www.w3.org/TR/REC-xml/#NT-NameChar) 
    **/
    var att = "[^-a-z0-9:._]";
    var tag = "<[a-z]";
    var any = "(?:[^<>\"']*(?:\"[^\"]*\"|'[^']*'))*?[^<>]*";
    var etag = "(?:>|(?=<))";
  
    var entityEnd = "(?:;|(?!\\d))";
    var ents = { 
      " ": "(?:\\s|&nbsp;?|&#0*32"+entityEnd+"|&#x0*20"+entityEnd+")",
      "(": "(?:\\(|&#0*40"+entityEnd+"|&#x0*28"+entityEnd+")",
      ")": "(?:\\)|&#0*41"+entityEnd+"|&#x0*29"+entityEnd+")",
      ".": "(?:\\.|&#0*46"+entityEnd+"|&#x0*2e"+entityEnd+")"
    };
    /* Placeholder to avoid tricky filter-circumventing methods */
  
    var charMap = {};
    var s = ents[" "] + "*"; /* Short-hand space */
  
    /* Important: Must be pre- and postfixed by < and >. RE matches a whole tag! */
    function ae(string){
      var all_chars_lowercase = string.toLowerCase();
      if(ents[string]) {
        return ents[string];
      }
      var all_chars_uppercase = string.toUpperCase();
      var RE_res = "";

      for(var i=0; i<string.length; i++){
        var char_lowercase = all_chars_lowercase.charAt(i);
        if(charMap[char_lowercase]){
          RE_res += charMap[char_lowercase];
          continue;
        }
        var char_uppercase = all_chars_uppercase.charAt(i);
        var RE_sub = [char_lowercase];
        RE_sub.push("&#0*" + char_lowercase.charCodeAt(0) + entityEnd);
        RE_sub.push("&#x0*" + char_lowercase.charCodeAt(0).toString(16) + entityEnd);
        if(char_lowercase != char_uppercase){
          RE_sub.push("&#0*" + char_uppercase.charCodeAt(0) + entityEnd);   
          RE_sub.push("&#x0*" + char_uppercase.charCodeAt(0).toString(16) + entityEnd);
        }
        RE_sub = "(?:" + RE_sub.join("|") + ")";
        RE_res += (charMap[char_lowercase] = RE_sub);
      }
      return(ents[string] = RE_res);
    }

    function by(match, group1, group2){
      /* Adds a data-prefix before every external pointer */
      return group1 + "data-" + group2;
    }

    /**
     * @description            Selects a HTML element and performs a search-and-replace on attributes
     * @param String selector  HTML substring to match
     * @param String attribute RegExp-escaped; HTML element attribute to match
     * @param String marker    Optional RegExp-escaped; marks the prefix
     * @param String delimiter Optional RegExp escaped; non-quote delimiters
     * @param String end       Optional RegExp-escaped; forces the match to end before an occurence of <end> when quotes are missing
    **/
    function cr(selector, attribute, marker, delimiter, end){
      if(typeof selector == "string") {
        selector = new RegExp(selector, "gi");
      }
      marker = typeof marker == "string" ? marker : "\\s*=";
      delimiter = typeof delimiter == "string" ? delimiter : "";
      end = typeof end == "string" ? end : "";
    
      var is_end = end && "?";
      var re1 = new RegExp("("+att+")("+attribute+marker+"(?:\\s*\"[^\""+delimiter+"]*\"|\\s*'[^'"+delimiter+"]*'|[^\\s"+delimiter+"]+"+is_end+")"+end+")", "gi");
    
      html = html.replace(selector, function(match){
        return prefix + match.replace(re1, by);
      });
    }
  
    /**
     * @description            Selects an attribute of a HTML element, and performs a search-and-replace on certain values
     * @param String selector  HTML element to match
     * @param String attribute RegExp-escaped; HTML element attribute to match
     * @param String front     RegExp-escaped; attribute value, prefix to match
     * @param String flags     Optional RegExp flags, default "gi"
     * @param String delimiter Optional RegExp-escaped; non-quote delimiters
     * @param String end       Optional RegExp-escaped; forces the match to end before an occurence of <end> when quotes are missing
    **/
    function cri(selector, attribute, front, flags, delimiter, end){
      if(typeof selector == "string") {
        selector = new RegExp(selector, "gi");
      }
      flags = typeof flags == "string" ? flags : "gi";
      var re1 = new RegExp("("+att+attribute+"\\s*=)((?:\\s*\"[^\"]*\"|\\s*'[^']*'|[^\\s>]+))", "gi");
    
      end = typeof end == "string" ? end + ")" : ")";
      var at1 = new RegExp('(")('+front+'[^"]+")', flags);
      var at2 = new RegExp("(')("+front+"[^']+')", flags);
      var at3 = new RegExp("()("+front+'(?:"[^"]+"|\'[^\']+\'|(?:(?!'+delimiter+').)+)'+end, flags);
    
      var handleAttr = function(match, g1, g2){
        return g2.charAt(0) == '"' ? g1+g2.replace(at1, by) : (g2.charAt(0) == "'" ? g1+g2.replace(at2, by) : g1+g2.replace(at3, by));
      };
      html = html.replace(selector, function(match){
        return prefix + match.replace(re1, handleAttr);
      });
    }
  
    /* <meta http-equiv=refresh content="  ; url= " > */
    html = html.replace(new RegExp("<meta"+any+att+"http-equiv\\s*=\\s*(?:\""+ae("refresh")+"\""+any+etag+"|'"+ae("refresh")+"'"+any+etag+"|"+ae("refresh")+"(?:"+ae(" ")+any+etag+"|"+etag+"))", "gi"), "<!-- meta http-equiv=refresh stripped-->");

    /* Stripping all scripts */
    html = html.replace(new RegExp("<script"+any+">\\s*//\\s*<\\[CDATA\\[[\\S\\s]*?]]>\\s*</script[^>]*>", "gi"), "<!--CDATA script-->");
    html = html.replace(/<script[\S\s]+?<\/script\s*>/gi, "<!--Non-CDATA script-->");
    cr(tag+any+att+"on[-a-z0-9:_.]+="+any+etag, "on[-a-z0-9:_.]+"); /* Event listeners */
  
    cr(tag+any+att+"href\\s*="+any+etag, "href"); /* Linked elements */
    cr(tag+any+att+"src\\s*="+any+etag, "src"); /* Embedded elements */
  
    cr("<object"+any+att+"data\\s*="+any+etag, "data"); /* <object data= > */
    cr("<applet"+any+att+"codebase\\s*="+any+etag, "codebase"); /* <applet codebase= > */
  
    /* <param name=movie value= >*/
    cr("<param"+any+att+"name\\s*=\\s*(?:\""+ae("movie")+"\""+any+etag+"|'"+ae("movie")+"'"+any+etag+"|"+ae("movie")+"(?:"+ae(" ")+any+etag+"|"+etag+"))", "value");
  
    /* <style> and < style=  > url()*/
    cr(/<style[^>]*>(?:[^"']*(?:"[^"]*"|'[^']*'))*?[^'"]*(?:<\/style|$)/gi, "url", "\\s*\\(\\s*", "", "\\s*\\)");
    cri(tag+any+att+"style\\s*="+any+etag, "style", ae("url")+s+ae("(")+s, 0, s+ae(")"), ae(")"));

    /* IE7- CSS expression() */
    cr(/<style[^>]*>(?:[^"']*(?:"[^"]*"|'[^']*'))*?[^'"]*(?:<\/style|$)/gi, "expression", "\\s*\\(\\s*", "", "\\s*\\)");
    cri(tag+any+att+"style\\s*="+any+etag, "style", ae("expression")+s+ae("(")+s, 0, s+ae(")"), ae(")"));
    return html.replace(new RegExp("(?:"+prefix+")+", "g"), prefix);
  }
  
})();

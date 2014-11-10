(function(){
  /**
   * This is the main model that contains the widgets
   * It handles state loading and saving and widget arrangements.
  **/
  var model = {
    _guid: 0,
    _columnCount: 0,

    // A reference to the Angular $http service
    $http: null,
    
    // We store the widgets here.
    // At the beginning, we have a single column, but this will be immediately changed.
    // The global variable USER keeps info about the user's widgets.
    columns: [ USER.widgets ],
    
    guid: function() {
      return ++this._guid;
    },

    /**
      Widget layout explanation:

        1. The page is divided in columns depending on the viewport width.
           The user can't control the number of columns, they are automatically added and removed
           when the screen width changes. These are all possible configurations
          
                1-Col            2-Col                    3-Col                            4-Col
               < 480px         480-960px                960-1440px                      1440 - 1920px
              +-------+    +-------+-------+    +-------+-------+-------+    +-------+-------+-------+-------+
              | [ A ] |    | [ A ] | [ B ] |    | [ A ] | [ B ] | [ C ] |    | [ A ] | [ B ] | [ C ] | [ D ] |
              | [ B ] |    | [ C ] | [ D ] |    | [ D ] |       |       |    |       |       |       |       |
              | [ C ] |    |       |       |    |       |       |       |    |       |       |       |       |
              | [ D ] |    |       |       |    |       |       |       |    |       |       |       |       |

           The 4 column setup is the maximum number of columns we can have.
           For horizontal rezolutions greater than 1920px the entire content will be centered in the screen.

        2. Each widget has a default order that is calculated from left to right THEN from top to bottom.
           If a new widget is added in the 2-Col layout it will automatically be assigned the order of "5" and be 
           placed directly under [ C ]. Later when the user resizes the screen and gets to a 3-Col layout,
           the new widget will be moved under [ B ].
    
        3. The user can re-arrange the widgets by dragging them in place of other widgets. As soon as the user 
           moves a single widget, ALL of the widgets positions for the current layout type are saved. Later, when 
           the layout is changed the widgets will arrange themselves according to the following rule:
          
              1. If the widget has a position preference for the current layout, use that.
              2. Otherwise order them by ID.
    
        4. The widget's position preferences are also saved when a user adds or removes a widget.

    **/
    setWindowSize: function(ww){
      var colCount = ww <= 480 ? 1 : (ww <= 960 ? 2 : (ww <= 1440 ? 3 : 4));

      if( this._columnCount === colCount ){
        return; // Don't do unnecessary work
      }
      this._columnCount = colCount;
      this.setColumns(this.columns);
    },

    setColumns: function(widgets){
      var col, pos, min, preference, widget, flat = [];
      var ccount = this._columnCount;
      
      // Get a flat list of the widgets
      widgets.forEach(function(c){ 
        flat = flat.concat(c); 
      });
      // Put the widgets with position preference first
      // So we can see which places are left for widgets with no preferences.
      flat = flat.sort(function(a, b){
        return a[ccount] ? -1 : b[ccount] ? 1 : 0;
      });
      
      var i = 0;
      var columns = new Array(this._columnCount);
      while(i < ccount) { 
        columns[i++] = [];
      }

      while(widget = flat.shift()){
        if(preference = widget[this._columnCount]){
          col = preference.col;
          pos = preference.pos;
        }
        else {
          min = null;
          columns.forEach(function(c){
            if(!min || c.length < min.length){
              min = c;
            }
          });
          col = columns.indexOf(min);
          pos = min.length;
        }
        columns[col][pos] = widget;
      }

      this.$scope.columns = this.columns = columns;
      // Check if the digest loop is in progress
      this.$scope.$$phase || this.$scope.$apply();
    },

    setPositionPreferences: function(){
      var i, j, column;
      for(i=0; i<this.columns.length; ++i){
        column = this.columns[i];
        for(j=0; j<column.length; ++j){
          column[j][ this._columnCount ] = { col: i, pos: j };
        }
      }
    },

    getWidgetById: function(id){
      var c, w, j, i = 0;
      id = "" + id;
      while(c = this.columns[i++]){
        j = 0;
        while(w = c[j++]){
          if(w.id + "" === id){
            return w;
          }
        }
      }
      return null;
    },

    addWidget: function(){
      var widget = { 
        module: null, 
        title: this.appconfig.newWidgetTitle,
        id: "new-" + this.guid()
      };
      var columns = this.columns;
      var low = 0;

      columns.forEach(function(col, index){
        if(col.length < columns[low].length){
          low = index;
        }
      });      
      this.columns[low].push(widget);
      return low;
    },

    removeWidget: function(widget){
      var c, i;
      for(c = 0; c < this.columns.length; c++){
        for(i = 0; i < this.columns[c].length; i++){
          if(widget === this.columns[c][i]){
            return this.columns[c].splice(i, 1)[0];
          }
        }
      }
    },

    saveState: function(callback){
      this.setPositionPreferences();

      // Filter out only JSON-serializable properties of the widgets.
      // We will always save the entire state because we don't expect much data.
      var columns = this.columns.map(function(c){
        return c.map(function(w){
          var prop, widget = {};
          for(prop in w){
            if(w.hasOwnProperty(prop) && prop[0] !== '$' && !angular.isFunction(w[prop])){
              widget[prop] = w[prop]; 
            }
          }
          return widget;
        });
      });

      this.$http({ url: "/widget", method: "POST", data: JSON.stringify(columns), headers: {'Content-Type': 'application/json'} })
      .success(function(data, status, headers, config){
        // TODO: Handle success
      })
      .error(function(data, status, headers, config){ 
        // TODO: Handle errors
      });
    }
  }



  /**
   * The one and only module that handles the basic stuff.
  **/
  var app = angular.module('eyegeeApp', ['ngRoute', 'widgetbox', 'ui.keypress', 'ngSanitize']);

  // The model is used by other controllers too  
  app.constant('model', model);

  // Global configuration goes here
  app.constant('appconfig', {
   newWidgetTitle: "New Widget",
   loadTimeout: 6000
  });

  // Needed for safe binding of dynamic svg icon urls
  app.filter('svgSource', function ($sce) {
    return function(icon) {
      return $sce.trustAsResourceUrl('/static/main/icons.svg#' + icon);
    };
  });

  // Needed for other urls
  app.filter('url', function($sce){
    return function(url) {
      return $sce.trustAsResourceUrl(url);
    };
  });

  // Needed for dynamically loading controllers (https://coderwall.com/p/y0zkiw)
  app.config(function($controllerProvider, $compileProvider, $filterProvider, $provide){
    app.lazy = {
      controller: $controllerProvider.register,
      directive: $compileProvider.directive,
      filter: $filterProvider.register,
      factory: $provide.factory,
      service: $provide.service
    }
  });

  /**
   * A directive that will bind a global keydown listener
   * and will execute actions based on the key pressed.
  **/
  app.directive('escHandler', function($document, $rootScope){
    var q = $rootScope.eyegeeEscQueue = [];

    return {
      restrict: "A",
      link: function(){
        $document.bind('keydown', function(e){
          if(e.which === 27){
            var fn = q.pop();
            (typeof fn === 'function') && fn();
          }
        });
      }
    }
  });


  /**
   * The widgetItem directive will render the widgets.
   * It will have different behaviour based on the widget that calls it
   * since it will depend on the controller loaded for the widget. The loading
   * is done by the microload library.
   *
   * Check: http://onehungrymind.com/angularjs-dynamic-templates/
  **/
  app.directive('widgetBody', function ($compile, $http, $templateCache, $timeout) {
    function widgetBodyLinker(scope, element, attrs) {
      /**
       * This is a very important observer.
       * The widget's module changes ONLY ONCE, in one of the following situations:
       *   1. A new widget is added and the user selects the module
       *   2. An existing widget is initialized
       * Once the module is set, we apply the correct controller ONCE, adding methods
       * to the widget.
      **/
      attrs.$observe('module', function(val){
        scope.module = val;
        scope.widgetId = attrs.widgetId;

        if(val){
          microload('/static/' + val + '/styles.css');
          microload('/static/' + val + '/controller.js', function(){
            // TODO: Find out why passing a function that reads the widget-body attribute
            // to the templateUrl in the Directive Definition Map doesn't work ...
            $http
              .get('/static/' + val + '/widget.html', { cache: $templateCache })
              .success(function(html){
                // This will populate the widget's html contents
                // Take a look at static/<module_name>/templates/widget.html
                element.replaceWith( $compile(html)(scope) );
              });
          });
        }
      });      
    }
    return { restrict: "E", replace: true, link: widgetBodyLinker, scope: {} };
  });


  /**
   * The MainController provides a scope for the model and the callback
   * for the angular-widgetbox plugin.
  **/
  app.controller('MainController', function($scope, $timeout, $window, $http, model, appconfig){
    model.$scope = $scope;
    model.$http  = $http;
    model.appconfig = appconfig;
    
    // The number of columns depends on the window width.
    // We need to initialize a listener and the number of columns.
    // The model takes care of distributing the widgets among the columns.
    angular.element($window).bind('resize', debounce(function(){
      model.setWindowSize($window.innerWidth);
    }, 250));
    model.setWindowSize($window.innerWidth);

    $scope.columns = model.columns;
    $scope.modules = MODULES;

    // The angular-widgetbox directive calls this method when a widget is moved
    $scope.widgetboxOnWidgetMove = function(sourceColumn, sourcePosition, targetColumn, targetPosition){
      $scope.$apply(function(){
        if(targetColumn){
          var widget = model.columns[parseInt(sourceColumn, 10)].splice(parseInt(sourcePosition, 10), 1)[0];
          var target = model.columns[parseInt(targetColumn, 10)];
          targetPosition == 'last' ? target.push(widget) : target.splice(parseInt(targetPosition, 10), 0, widget);
        }
      });
      
      // Apply the new position preferences
      model.setPositionPreferences();

      // Save the new state.
      model.saveState();
    }

    /**
     * Sets the module of a new widget
     * Once the module changes, the widgetBodyLinker function will load the controller
    **/
    $scope.setModule = function(widgetId, module){
      var widget = model.getWidgetById(widgetId);
      
      // This will be consumed by the widget controller and will open an edit dialog immediately
      widget.__editToken  = true;
      widget.module = module;
    }

    /**
     * Removes a widget
    **/
    $scope.removeWidget = function(widget){
      widget.remove();
    }
    
    /**
     * Starts widget editing.
    **/
    $scope.editWidget = function(widget){
      widget.module && widget.editBegin();
    }

    /**
     * Cancels editing
    **/
    $scope.cancelEdit = function(widget){
      widget.editEnd();
    }
  });


  /**
   * The NavigationController takes care of the top navigation buttons
   * and user session management and/or registration.
   * I know, the choice for a name is poor.
  **/
  app.controller('NavigationController', function($scope, $rootScope, $http, $timeout, $sce, model){
    // Method invoked by the "new widget" button
    $scope.newWidget = function(){ 
      var colIndex = model.addWidget();      
      $timeout(function(){
        var colElement = document.querySelector('[widgetbox-column-id="' + colIndex + '"]');
        var widElement = colElement.children[ colElement.children.length-1 ]
        // We use 85 as an arbitrary padding.
        document.body.scrollTop = widElement.getBoundingClientRect().top - 85;
      });
    }
    
    $scope.session = {
      // State variables
      isAnon:     !USER.email,
      isFormOpen: false,
      
      // Form field values
      email:        USER.email || "",
      password:     "",
      password2:    "",
      
      // Titles
      buttonTitle:  "",
      
      // Error moessages
      error: "",
      
      setSessionButtonTitle: function(){
        this.buttonTitle = this.isFormOpen ? "Forget That" : this.isAnon ? "Login/Register" : "Profile";
      }
    }
    
    $scope.email = USER.email || "";
    
    // Set this automatically
    $scope.session.setSessionButtonTitle();

    /**
     * Opens the panel where the user email/password controls are located.
    **/
    $scope.toggleSessionForm = function(){ 
      if($scope.session.isFormOpen = !$scope.session.isFormOpen){
        document.getElementById('input-email').focus();
        
        // This is handled in the escHandler directive in the main controller.
        $rootScope.eyegeeEscQueue.push(function(){
          $scope.toggleSessionForm();
          $scope.$apply();
        });
      }
      $scope.session.setSessionButtonTitle();
    }
    
    /**
     * Logs the user out
     * It modifies the global USER variable.
    **/
    $scope.doSignOut = function(){
      window.location = "/signout";
    }
    
    /**
     * Logs the user in
     * It modifies the global USER variable on succesful login.
    **/
    $scope.doSignIn = function(){      
      if(!$scope.session.email || !$scope.session.password){
        return $scope.session.error = "Email and password are required";
      }
      loginOrRegister("/signin");
    }
    
    /**
     * Registers the user and immeidately logs him in.
    **/
    $scope.doRegister = function(update){
      if(!$scope.session.email || !$scope.session.password || !$scope.session.password2){
        return $scope.session.error = "To " + (update ? "change your email or password" : "register") + ", you'll need to fill out all three fields";
      }
      if($scope.session.password !== $scope.session.password2){
        return $scope.session.error = "Your passwords don't match";
      }
      loginOrRegister("/register");
    }
    
    /**
     * Sends an email to the provided email address that contains
     * a reset password link
    **/
    $scope.doForgotten = function(){
      if(!$scope.session.email){
        return $scope.session.error = $sce.trustAsHtml("Enter an email and we'll send you <br>a reset password link.");
      }
    }
    
    function loginOrRegister(url){
      $scope.session.error = "";

      $http({ 
        url: url, 
        method: "POST",
        headers: {'Content-Type': 'application/json'},
        data: JSON.stringify({ email: $scope.session.email, password: $scope.session.password })
      })
      .success(function(data, status, headers, config){
        window.USER = data.user;
        $scope.session.isAnon = false;
        $scope.session.email = data.user.email;
        $scope.session.password = $scope.session.password2 = "";
        $scope.session.isFormOpen = false;
        $scope.session.setSessionButtonTitle();
        
        $scope.email = data.user.email;

        model.setColumns(USER.widgets);
      })
      .error(function(data, status, headers, config){ 
        $scope.session.error = data.message;
      });
    }
  });
  

  // Helper functions  
  function debounce(fn, delay) {
    var timer = null;
    return function () {
      var context = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  }      
})();

(function(){
  var app = angular.module('eyegeeApp', ['ngRoute', 'widgetbox', 'ui.keypress']);

  var model = {
    _guid: 0,
    _isInitialized: false,
    _columnCount: 0,

    // A reference to the Angular $http service
    $http: null,
    
    // We store the widgets here.
    // At the beginning, we have a single column, but this will be immediately changed.
    // The global variable USER keeps info about the user's widgets.
    columns: [ USER.widgets ],
    
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
      var min, prev, col, pos, colCount, i = 0, columns = [], widgets = [];

      colCount = ww <= 480 ? 1 : ww <= 960 ? 2 : ww <= 1440 ? 3 : 4;
      if( this._columnCount === colCount ){
        // Don't do unnecessary work
        return;
      }
      this._columnCount = colCount;

      // Get a flat list of the widgets
      this.columns.forEach(function(c){
        widgets = widgets.concat(c);
      });

      i = 0;
      columns = new Array(colCount);
      while(i < colCount) { 
        columns[i++] = []; 
      }

      while(widget = widgets.shift()){ 
        if(preference = widget[colCount]){
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

      this.columns = columns;
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

    guid: function() {
      return ++this._guid;
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
      // TODO: Determine next widget position
      this.columns[0].push({ module: null, id: "new-" + this.guid(), title: "New Widget" });
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

      this.$http({
        url: '/widget',
        method: "POST",
        data: JSON.stringify(columns),
        headers: {'Content-Type': 'application/json'}
      })
      .success(function(data, status, headers, config){
        // TODO: Handle success
      })
      .error(function(data, status, headers, config){ 
        // TODO: Handle errors
      });
    }
  }

  // Register some filters
  app.filter('loopRss', function() {
    // This filter is similar to the limitTo filter, except that
    // passing the string "all" as the limit parameter will loop over all array elements.
    return function(input, itemCount) {
      return itemCount === 'all' ? input : input.slice(0, itemCount);
    };
  })

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
   * We need access to the model in different controllers spread across different files.
   * which are loaded dynamically. That's why we make a factory that will return the model.
   * On the first call, we also need to attach dependencies angular services.
  **/
  app.factory('model', function($http){
    if(!model._isInitialized) {
      model.$http = $http;
      model._isInitialized = true;
    }
    return model;
  });

  /**
   * The widgetItem directive will render the widgets.
   * It will have different behaviour based on the widget that calls it
   * since it will depend on the controller loaded for the widget. The loading
   * is done by the microload library.
   *
   * Check: http://onehungrymind.com/angularjs-dynamic-templates/
  **/
  app.directive('widgetBody', function ($compile, $http, $templateCache, $q) {
    
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
          microload('/static/' + val + '/css/styles.css');
          microload('/static/' + val + '/js/controller.js', function(){
            // TODO: Find out why passing a function that reads the widget-body attribute
            // to the templateUrl in the Directive Definition Map doesn't work ...
            $http
              .get('/static/' + val + '/templates/widget.html', { cache: $templateCache })
              .success(function(html){
                // This will populate the widget's html contents
                // Take a look at static/<module_name>/templates/widget.html
                element.html(html);
              })
              .then(function(response){
                // This will initialize the controller dynamically
                // Take a look at static/<module_name>/js/controller.js
                element.replaceWith($compile(element.html())(scope));
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
  app.controller('MainController', function($scope, $timeout, $window, model){
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
    
    // The number of columns depends on the window width.
    // We need to initialize a listener and the number of columns.
    // The model takes care of distributing the widgets among the columns.
    angular.element($window).bind('resize', debounce(function(){
      model.setWindowSize($window.innerWidth);
      $scope.columns = model.columns;
      $scope.$apply();
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

    $scope.setModule = function(widgetId, module){
      var widget = model.getWidgetById(widgetId);
      
      // This will be consumed by the widget controller and will open an edit dialog immediately
      widget.__editToken  = true;
      widget.module = module;
    }

    $scope.removeWidget = function(widget){
      if(confirm("Remove this widget?")){
        model.removeWidget(widget);
        model.saveState();
      }
    }
    
    $scope.editWidget = function(widget){
      widget.module && widget.editBegin();
    }
  });


  /** 
   * Takes care of user signin and registration
  **/
  app.controller('SessionController', function($scope){
    
  });


  /** 
   * Takes care of the navigation buttons
  **/
  app.controller('NavigationController', function($scope, model){
    $scope.sessionButtonTitle = "Sign In";

    // Adding a new widget
    $scope.newWidget = function(){ 
      model.addWidget();
      // TODO: Scroll to widget
    }

    $scope.doLoginOrRegister = function(){ 
      console.log("Login/Register"); 
    }
  });    
})();


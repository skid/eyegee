(function(){
  /**
   * Angular controller for Notes widgets.
   * Has a separate instance for each widget on the page.
  **/
  angular.module('eyegeeApp').lazy.controller('NotesController', function ($scope, model, appconfig) {
    // Note for myself:
    // The following code runs only once per widget
    var widget = model.getWidgetById($scope.widgetId);
    
    /**
     * Define the editBegin, editEnd and remove methods.
     * Each widget should have these defined.
    **/
    widget.editBegin = function editBegin(){
      $scope.title      = widget.title;
      $scope.lineCount  = widget.lineCount || 10;
      $scope.isEdited   = true;
    }

    widget.editEnd = function editEnd(){
      $scope.isEdited = false;
    }

    widget.remove = function remove(){
      if(confirm("Remove this widget?")){
        model.removeWidget(this);
        model.saveState();
      }
    }
    
    // We need this to expose the scope 
    // to the widget and vice versa
    $scope.widget = widget;
    widget.$scope = $scope;

    // These are used outside the edit mode
    $scope.notes      = widget.notes || "";
    $scope.title      = widget.title || "";
    $scope.lineCount  = widget.lineCount || 10;
    $scope.errors     = [];

    // Upon initilization, we immediately show the edit screen if the widget is new
    // The __editToken is set to true when the user selects the widget's module
    if(widget.__editToken) {
      delete widget.__editToken;
      widget.editBegin();
    }

    /**
    * Saves the settings once the user is done editing.
    **/
    $scope.saveSettings = function(){
      widget.title = $scope.title;
      widget.lineCount = $scope.lineCount;
      $scope.isEdited = false;
      model.saveState();
    }
    
    /**
     * Watch the notes and issue a save each second.
    **/
    $scope.$watch('notes', debounce(function(oldVal, newVal){
      if(oldVal + "" !== newVal + ""){
        widget.notes = newVal;
        model.saveState();
      }
    }, 2000));
  });
})();

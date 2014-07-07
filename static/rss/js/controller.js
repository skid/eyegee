angular.module('eyegeeApp').lazy.controller('RssController', function ($scope, modelFactory) {
  $scope.testData = "This comes from the controller";
  $scope.id = $scope.widgetId;
  $scope.siteName = modelFactory.getWidgetById($scope.id).extra;
});
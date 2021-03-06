var removed_id;
var removed_name = "";

var regulatorCtrl = function ($scope, $rootScope, $http, ngDialog) {

    $scope.allAssets = [];
    $scope.markets = [];

    var URL = 'http://localhost:3000/api/';

    //test samples
    // $scope.allAssets = [{companyID:1, name:"test1", marketID:"east"},{companyID:2, name:"test2", marketID:"west"},
    //                     {companyID:3, name:"test3", marketID:"east"},{companyID:4, name:"test4", marketID:"east"}];
    // $scope.markets = [{marketID:"east"},{marketID:"west"}];
    //
    // $scope.selectedMarket = $scope.markets[0];
    // $scope.selectedMarket2 = $scope.markets[0];

    function refreshPage(){
        $http.get(URL+'Market').then(function (response) {
            angular.extend($scope.markets, response.data);
            $scope.selectedMarket = $scope.markets[0];
            $scope.selectedMarket2 = $scope.markets[0];
        });
        $http.get(URL+'Company').then(function (response) {
            angular.extend($scope.allAssets, response.data);
        });
    };

    refreshPage();

    $scope.openAddCompanyDlg = function () {
        ngDialog.open({
            template: 'addCompanyDlg',
            className: 'ngdialog-theme-default',
            controller: 'RegulatorCtrl',
            scope: $scope
        });
    };

    $scope.openAddMarketDlg = function () {
        ngDialog.open({
            template: 'addMarketDlg',
            className: 'ngdialog-theme-default',
            controller: 'RegulatorCtrl',
            scope: $scope
        });
    };

    $scope.openDeleteDlg = function (id, name) {
        removed_id = id;
        removed_name = name;
        ngDialog.open({
            template: 'deleteDlg',
            className: 'ngdialog-theme-default',
            controller: 'RegulatorCtrl',
            scope: $scope
        });
    };

    $scope.addMarket = function () {
        $scope.loading_add2 = true;

        var body = {
            $class: "org.emission.network.Market",
            marketID: $scope.marketName,
            emission: 0,
	    declaredEmission: 0,	
            etts: []
        };
        console.debug("body "+JSON.stringify(body));
        $http.post(URL+'Market', body).then(

            function (response) {
                $scope.$parent.markets.push(response.data);
                $scope.$parent.loading_add2 = false;
                if($scope.$parent.markets.length == 1) {
                    $scope.$parent.selectedMarket = $scope.markets[0];
                    $scope.$parent.selectedMarket2 = $scope.markets[0];
                }
                ngDialog.closeAll();
            });
    };

    $scope.addCompany = function () {
        $scope.loading_add = true;

        var id = Math.random().toString(36).substr(2,10);  //generate unique company ID

        //fist, add company
        var body1 = {
            $class: "org.emission.network.Company",
            companyID: id,
            name: $scope.companyName,
            marketID: $scope.selectedMarket2.marketID,
            emissionConsumed: 0,
            emissionLimit: $scope.limit,
	    cash:0,		
            ett: "org.emission.network.Ett#"+id
        };
        // then, add ett
        var body2 = {
            $class: "org.emission.network.Ett",
            ettID: id,
            emission: 0,
            owner: "org.emission.network.Company#"+id
        };

        $http.post(URL+'Company', body1).then(

            function (response) {
                $scope.$parent.allAssets.push(response.data);
                $http.post(URL+'Ett', body2).then(
                    function () {
                        $http.post('/adduser', {companyname: $scope.companyName});
                        $scope.$parent.loading_add = false;
                        ngDialog.closeAll();
                    }
                );
            },
            function () {
                ngDialog.closeAll();
                return;
            }
        );

    };

    $scope.delete = function () {

        $scope.loading_delete = true;

        var body = {
            $class: "org.emission.network.RemoveCompany",
            companyID: removed_id
        };

        $http.post(URL+'RemoveCompany', body).then(
            function (response) {
                var i;
                for(i = 0; i < $scope.allAssets.length; i++){
                    if($scope.allAssets[i].companyID == removed_id) {
                        $scope.$parent.allAssets.splice(i, 1);
                    }
                }
                $http.post('/deleteuser', {companyname: removed_name});
                $scope.loading_delete = false;
                ngDialog.closeAll();}
        );
    };
};

app.controller('RegulatorCtrl', regulatorCtrl);

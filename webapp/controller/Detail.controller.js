sap.ui.define([
    "convenience/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter"
],
    function (Controller, JSONModel, Filter) {
        "use strict";
        
        return Controller.extend("convenience.controller.Detail", {
            onInit: function () {
                this.getRouter().getRoute("Detail").attachMatched(this._onRouteMatched, this);
            },
    
            _onRouteMatched: function (oEvent) {
                var oArgs = oEvent.getParameter("arguments");
                var inputData = JSON.parse(oArgs.inputData);
                this.Uuid = oArgs.Uuid;
                console.log(inputData);
                console.log(this.Uuid);
    
                if(this.Uuid){
                    
                } else {
                    this.editable = true;
                    var oModel = new JSONModel({...inputData, editable : this.editable});
                    this.setModel(oModel, "inputModel");
                }

                this.initData();
            },
    
            initData: function (){
    
            },

            getProductData: function (){


            },

            getStoreData: function (){

            },

        });
    }
)
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/model/Filter",
	"sap/m/MessageToast",
	"sap/ui/model/Sorter",
	"sap/ui/model/json/JSONModel"
], function (Controller, History, Filter, MessageToast, Sorter, JSONModel) {
    "use strict";

    return Controller.extend("convenience.controller.BaseController", {
        /**
         * Convenience method for accessing the router in every controller of the application.
         * @public
         * @returns {sap.ui.core.routing.Router} the router for this component
         */
        getRouter : function () {
            return this.getOwnerComponent().getRouter();
        },

        /**
         * Convenience method for getting the view model by name in every controller of the application.
         * @public
         * @param {string} sName the model name
         * @returns {sap.ui.model.Model} the model instance
         */
        getModel : function (sName) {
            return this.getView().getModel(sName);
        },

        /**
         * Convenience method for setting the view model in every controller of the application.
         * @public
         * @param {sap.ui.model.Model} oModel the model instance
         * @param {string} sName the model name
         * @returns {sap.ui.mvc.View} the view instance
         */
        setModel : function (oModel, sName) {
            return this.getView().setModel(oModel, sName);
        },

        /**
         * Convenience method for getting the resource bundle.
         * @public
         * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
         */
        getResourceBundle : function () {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        },

        /**
         * Event handler for navigating back.
         * It there is a history entry we go one step back in the browser history
         * If not, it will replace the current entry of the browser history with the list route.
         * @public
         */
        onNavBack : function() {
            var sPreviousHash = History.getInstance().getPreviousHash();

            if (sPreviousHash !== undefined) {
                // eslint-disable-next-line fiori-custom/sap-no-history-manipulation
                history.go(-1);
            } 
        },

        _getODataRead : function(oModel, readContext, aFilter, oParameters){
			var deferred = $.Deferred();
			var param = {
				ReadContext : readContext || "",
				Parameters : oParameters || null,
				Filter : aFilter || []
			};
			oModel.read(param.ReadContext,{
				urlParameters: param.Parameters,
				filters : param.Filter,
				success : function(oReturn){
					var aResult = oReturn.results;
			    	deferred.resolve(aResult);
				},
				error: function(oError) {
			    	deferred.reject(oError);
					try{
						var oResponseTextData = JSON.parse(oError.responseText);
						MessageToast.show(oResponseTextData.error.message.value);
					}catch(e){
						MessageToast.show(oError.message + "_" + oError.statusCode);
					}
				}
			});
			
			return deferred.promise();
		},
        
		_getODataDelete: function(oModel, readContext){
			var deferred = $.Deferred();
			
			oModel.remove(readContext,{
				success : function(oReturn){
			    	deferred.resolve(oReturn);
				},
				error: function(oError) {
			    	deferred.reject(oError);
					try{
						var oResponseTextData = JSON.parse(oError.responseText);
						MessageToast.show(oResponseTextData.error.message.value);
					}catch(e){
						MessageToast.show(oError.message + "_" + oError.statusCode);
					}
				}
			});
			
			return deferred.promise();
		},

		_getODataCreate : function(oModel, readContext, oData){
			var deferred = $.Deferred();
			
			oModel.create(readContext, oData,{
				success : function(oReturn){
					var aResult = oReturn.results;
			    	deferred.resolve(oReturn, aResult);
				},
				error: function(oError) {
					deferred.reject(oError);				
				}
			});
			
			return deferred.promise();

        },

		_getODataUpdate : function(oModel, updateContext, oData){
			var deferred = $.Deferred();
		
			oModel.update(updateContext, oData,{
				merge: true, // This is for PATCH, if you want to use PUT set this to false
				success : function(oReturn){
					deferred.resolve(oReturn);
				},
				error: function(oError) {
					deferred.reject(oError);
					try{
						var oResponseTextData = JSON.parse(oError.responseText);
						MessageToast.show(oResponseTextData.error.message.value);
					}catch(e){
						MessageToast.show(oError.message + "_" + oError.statusCode);
					}
				}
			});
		
			return deferred.promise();
		},

		navTo: function (psTarget, pmParameters) {
			this.getRouter().navTo(psTarget, pmParameters);
		},

        setProperty: function (sModelName, sPropertyName, value) {
            this.getModel(sModelName).setProperty(`/${sPropertyName}`, value);
        },

		getURL: function (item, aliasName) {
            return item.__metadata.uri.substring(item.__metadata.uri.indexOf("/" + aliasName + "("));
        }


    });

});
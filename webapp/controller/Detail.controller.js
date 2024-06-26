sap.ui.define([
    "convenience/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/m/MessageToast",
    "sap/ui/model/Sorter",
    "sap/ui/table/RowSettings",
    "sap/ui/core/library",
],
    function (Controller, JSONModel, Filter, RowSettings, MessageToast, Sorter, CoreLibrary) {
        "use strict";
        
        return Controller.extend("convenience.controller.Detail", {
            onInit: function () {
                this.getRouter().getRoute("Detail").attachMatched(this._onRouteMatched, this);
            },
    
            _onRouteMatched: function (oEvent) {
                var oArgs = oEvent.getParameter("arguments");
                var inputData = JSON.parse(oArgs.inputData);
                this.Uuid = oArgs.Uuid;
                var oModel;

                if(this.Uuid){
                    this.editable = false;
                    this.getStoreData();
                } else {
                    this.editable = true;
                    oModel = new JSONModel({...inputData, editable : this.editable});
                    this.setModel(oModel, "inputModel");
                }
                
                this.initData();
            },
    
            initData: function (){
                this.setModel(new JSONModel([]), 'cartModel');
                this.setModel(new JSONModel([]), 'stockModel');
                this.getProductData();
            },

            getProductData: function (){
                var oMainModel = this.getOwnerComponent().getModel('Product');
                this._getODataRead(oMainModel, "/Product")
                .done(function (aGetData) {
                    console.log(aGetData)
                    this.setModel(new JSONModel(aGetData), "productModel");
                }.bind(this))
                .fail(function () {
                    console.error('Failed to read data');
                }.bind(this))
                .always(function () {})
            },

            getStoreData: function (){
                var oMainModel = this.getOwnerComponent().getModel();
                this._getODataRead(oMainModel, "/Head")
                .done(function (aGetData) {
                    this.setModel(new JSONModel({ ...aGetData, editable : this.editable}), "inputModel");
                }.bind(this))
                .fail(function () {
                    console.error('Failed to read data');
                }.bind(this))
                .always(function () {})
            },

            getStockData: function (){
                var oMainModel = this.getOwnerComponent().getModel();
                var aFilter = [];
                aFilter.push(new Filter("Uuid", "EQ", this.Uuid));
                this._getODataRead(oMainModel, '/Head', aFilter, '$expand=to_Item').done(function (aGetData) {
                    console.log(aGetData[0]);
                    console.log(aGetData[0].to_Item.results)
                    this.setModel(new JSONModel(aGetData[0]), "stockModel");
                }.bind(this)).fail(function () {
                    MessageBox.information("Read Fail");
                }).always(function () {

                });
            },

            addStock: function (){
                var presentStock = [];
                var cartData = this.getModel('cartModel').getData();
                var stockData = this.getModel('stockModel').getData();

                cartData.map( product => {
                    presentStock.push({
                        ...product,
                        Unit : 'EA',
                        ProductStock : '30',
                        StockStatus : 'Success'
                    })
                })

                this.Uuid ? presentStock = [ ...presentStock , ...stockData] :

                console.log(presentStock)
                this.setModel(new JSONModel(presentStock), 'stockModel');
                this.setModel(new JSONModel([]), 'cartModel');

                var SortOrder = CoreLibrary.SortOrder;
                var oProductNameColumn1 = this.getView().byId("ProductCode1");
                this.getView().byId("table").sort(oProductNameColumn1, SortOrder.Ascending);

                // 섹션 포커스 설정
                this.oObjectPageLayout = this.getView().byId("ObjectPageLayout");
                this.oEditAttrSection = this.getView().byId("presentStock");
                this.oObjectPageLayout.setSelectedSection( this.oEditAttrSection.getId() );

            },

            cartReset: function (){
                this.moveSelectedRow("cartModel", "productModel", true);
            },

            moveToTable1: function() {
                // Table2에서 선택된 항목을 Table1로 이동
                this.moveSelectedRow("cartModel", "productModel");
            },
            
            moveToTable2: function() {
                // Table1에서 선택된 항목을 Table2로 이동
                this.moveSelectedRow("productModel", "cartModel");
            },
            
            moveSelectedRow: function(sourceModelName, targetModelName, resetState=false) {

                var oSourceTable = this.byId(sourceModelName === "productModel" ? "table1" : "table2");
                var oTargetTable = this.byId(targetModelName === "productModel" ? "table1" : "table2");
                var oSourceModel = this.getView().getModel(sourceModelName);
                var oTargetModel = this.getView().getModel(targetModelName);
                var aSourceData = oSourceModel.getData() || [];
                var aTargetData = oTargetModel.getData() || [];
                var aNewItems = [];
                var dataLength;

                var aSelectedIndices = oSourceTable.getSelectedIndices();
                if (aSelectedIndices.length === 0 && !resetState) {
                    sap.m.MessageToast.show("먼저 이동할 항목을 선택하세요.");
                    return;
                }

                var dataLength = resetState ? aSourceData.length : aSelectedIndices.length;

                for (var i = dataLength - 1; i >= 0; i--) {
                    var iIndex = resetState ? i : aSelectedIndices[i];
                    var oSelectedData = aSourceData[iIndex];
                    var bExists = aTargetData.some(function(item) {
                        return item.ProductCode === oSelectedData.ProductCode;
                    });
            
                    if (!bExists) {
                        aNewItems.unshift(oSelectedData);
                    }
                    aSourceData.splice(iIndex, 1);
                }

                
                aNewItems.forEach(function(oNewItem) {
                    aTargetData.push(oNewItem);
                });

                this.setModel(new JSONModel(aSourceData), sourceModelName);
                this.setModel(new JSONModel(aTargetData), targetModelName);
            

                var SortOrder = CoreLibrary.SortOrder;
                var oProductNameColumn2 = this.getView().byId("ProductCode2");
                var oProductNameColumn3 = this.getView().byId("ProductCode3");
                this.getView().byId("table1").sort(oProductNameColumn2, SortOrder.Ascending);
                this.getView().byId("table2").sort(oProductNameColumn3, SortOrder.Ascending);

            },

            onHighlightToggle: function(oEvent) {
                const oTable = this.byId("table");
                const oToggleButton = oEvent.getSource();
    
                if (oToggleButton.getPressed()) {
                    oTable.setRowSettingsTemplate(new RowSettings({
                        highlight: "{Status}"
                    }));
                } else {
                    oTable.setRowSettingsTemplate(null);
                }
            },
    
            
        
        });
    }
)
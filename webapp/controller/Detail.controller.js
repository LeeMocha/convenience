sap.ui.define([
    "convenience/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/m/MessageToast",
    "sap/ui/model/Sorter",
    "sap/ui/table/RowSettings",
    "sap/ui/core/library",
    "sap/m/MessageBox",
],
    function (Controller, JSONModel, Filter, MessageToast, Sorter, RowSettings, CoreLibrary, MessageBox) {
        "use strict";
        
        return Controller.extend("convenience.controller.Detail", {
            onInit: function () {
                this.getRouter().getRoute("Detail").attachMatched(this._onRouteMatched, this);
            },
    
            _onRouteMatched: function (oEvent) {
                var oArgs = oEvent.getParameter("arguments");
                this.Uuid = oArgs.Uuid ? JSON.parse(oArgs.Uuid) : undefined;
                this.inputData = oArgs.inputData ? JSON.parse(oArgs.inputData) : undefined;
                
                this.initData();

                // 섹션 포커스 설정
                this.oObjectPageLayout = this.getView().byId("ObjectPageLayout");
                this.oEditAttrSection = this.getView().byId("presentStock");
                this.oObjectPageLayout.setSelectedSection( this.oEditAttrSection.getId() );
            },
    
            initData: function() {
                this.setModel(new JSONModel([]), 'cartModel');
                this.getStoreData()
                    .then(this.getProductData.bind(this)).then(()=>{
                        var SortOrder = CoreLibrary.SortOrder;
                        var oProductNameColumn1 = this.getView().byId("ProductCode1");
                        this.getView().byId("table").sort(oProductNameColumn1, SortOrder.Ascending);        
                    })
                    .catch(function() {
                        console.error('Failed to initialize data');
                    });
            },

            getStoreData: function() {
                return new Promise(function(resolve, reject) {
                    if (this.Uuid) {
                        this.editable = false;
                        var oMainModel = this.getOwnerComponent().getModel();
                        var aFilter = [new Filter("Uuid", "EQ", this.Uuid)];
                
                        this._getODataRead(oMainModel, "/Head", aFilter, '$expand=to_Item')
                            .done(function(aGetData) {
                                this.setModel(new JSONModel({ ...aGetData[0], editable: this.editable }), "inputModel");
                                this.setModel(new JSONModel(aGetData[0].to_Item.results), "stockModel");
                                resolve(); // 성공적으로 데이터를 가져오면 resolve 호출
                            }.bind(this))
                            .fail(function() {
                                console.error('Failed to read store data');
                                reject(); // 데이터를 가져오지 못하면 reject 호출
                            }.bind(this));
                    } else {
                        this.editable = true;
                        var oModel = new JSONModel({ ...this.inputData, editable: this.editable });
                        this.setModel(oModel, "inputModel");
                        this.setModel(new JSONModel([]), 'stockModel');
                        resolve(); // 비동기 작업이 필요 없는 경우에도 resolve 호출
                    }
                }.bind(this));
            },
            
            getProductData: function() {
                return new Promise(function(resolve, reject) {
                    var oMainModel = this.getOwnerComponent().getModel('Product');
                    var aStockData = this.getModel('stockModel').getData();
            
                    var aStockProductCodes = aStockData.map(function(item) {
                        return item.ProductCode;
                    });
            
                    this._getODataRead(oMainModel, "/Product")
                        .done(function(aGetData) {
                            console.log(aGetData);
            
                            var aFilteredData = aGetData.filter(function(product) {
                                return !aStockProductCodes.includes(product.ProductCode);
                            });
            
                            this.setModel(new JSONModel(aFilteredData), "productModel");
                            resolve(); // 성공적으로 데이터를 가져오면 resolve 호출
                        }.bind(this))
                        .fail(function() {
                            console.error('Failed to read product data');
                            reject(); // 데이터를 가져오지 못하면 reject 호출
                        }.bind(this));
                }.bind(this));
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

            onDeepCreate: function (){
                var oMainModel = this.getOwnerComponent().getModel();
                var headData = this.getModel('inputModel').getData();
                var itemsData = this.getModel('stockModel').getData();
                var newItems = []

                if (itemsData.length <= 0 ) {
                    MessageToast.show("판매할 상품이 없습니다. 상품을 추가해 주십시오.");
                    return;
                }

                itemsData.map( (stock) => {
                    newItems.push({ 
                        ProductCode : stock.ProductCode,
                        ProductName : stock.ProductName
                    })
                })

                delete headData.editable;
                headData.to_Item = newItems;

                console.log(headData)
                
                this._getODataCreate(oMainModel, "/Head", headData).done(function(aReturn){  

                    console.log(aReturn);

                    this.navTo("Main", {});

                }.bind(this)).fail(function(err){
                    console.log(err)
                }).always(function(){

                });

            },

            onDeepDelete: function() {
                var oMainModel = this.getOwnerComponent().getModel();
                this._getODataDelete(oMainModel, "/Head(guid'"+ this.Uuid +"')").done(function(aReturn){
                }.bind(this)).fail(()=>{
                    MessageBox.information("Delete Fail");
                }).then(()=>{
                    this.navTo('Main', {})
                })
   
            },

            addStock: function (){
                var oMainModel = this.getOwnerComponent().getModel();
                var cartData = this.getModel('cartModel').getData();
                var headData = this.getModel("inputModel").getData();

                if(cartData.length <= 0) {
                    MessageToast.show("선택하신 상품이 없습니다.");
                    return;
                }

                if(this.Uuid){
                    var that = this;
                    MessageBox.confirm("선택한 상품을 재고로 추가합니다. 기본 재고로 30EA 가 들어갑니다.", {
                        actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                        emphasizedAction: MessageBox.Action.OK,
                        onClose: function (sAction) {
                            if(sAction === 'OK'){
                                var headUri = headData.__metadata.uri;
                                var param = headUri.substring(headUri.indexOf("/Head(")); // "/Head(guid'...')"
                                cartData.map( stock => {
                                    var newStock = {
                                        StoreUuid : headData.Uuid,
                                        ProductCode : stock.ProductCode,
                                        ProductName : stock.ProductName
                                    }
                                    var createUri = param + "/to_Item";
                                    that._getODataCreate(oMainModel, createUri, newStock).done(function(aReturn){
                                    }.bind(this)).fail(()=>{
                                        MessageBox.information("Create Fail");
                                    }).always(()=>{
                                        that.initData();
                                    })
                                })
                            }
                        },
                        dependentOn: this.getView()
                    });
                } else {
                    var presentStock = [];
                    cartData.map( product => {
                        presentStock.push({
                            ...product,
                            Unit : 'EA',
                            ProductStock : '30',
                            StockStatus : 'Success'
                        })
                    })
                    this.setModel(new JSONModel(presentStock), 'stockModel');
                    this.setModel(new JSONModel([]), 'cartModel');
                }

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
                    MessageToast.show("먼저 이동할 항목을 선택하세요.");
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

            onSale: function(oEvent) {
                var that = this;
                var oMainModel = this.getOwnerComponent().getModel();
                var selectedProduct = oEvent.getSource().getParent().getBindingContext("stockModel").getObject();
                console.log(selectedProduct);

                if(selectedProduct.ProductStock <= 0){
                    MessageToast.show("재고가 부족합니다. 판매할 수 없습니다.");
                    return;
                }

                --selectedProduct.ProductStock;

                var itemUri = selectedProduct.__metadata.uri.substring(selectedProduct.__metadata.uri.indexOf("/Item("));
                this._getODataUpdate(oMainModel, itemUri, selectedProduct).done(function(aReturn){
								
                }.bind(this)).fail(function(){
                    MessageBox.information("Saleing Failed");
                }).always(function(){
                    var oTable = that.byId("table");
                    var oBinding = oTable.getBinding("items") || oTable.getBinding("rows");
                    if (oBinding) {
                        oBinding.refresh();
                    }
                });
            }
        });
    }
)
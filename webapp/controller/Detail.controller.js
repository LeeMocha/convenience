sap.ui.define([
    "convenience/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/m/MessageToast",
    "sap/ui/model/Sorter",
    "sap/ui/table/RowSettings",
    "sap/ui/core/library",
    "sap/m/MessageBox",
    'sap/ui/core/Fragment',
    'sap/m/Token',
],
    function (Controller, JSONModel, Filter, MessageToast, Sorter, RowSettings, CoreLibrary, MessageBox, Fragment, Token) {
        "use strict";
        
        return Controller.extend("convenience.controller.Detail", {
            onInit: function () {
                this.getRouter().getRoute("Detail").attachMatched(this._onRouteMatched, this);
            },
    
            _onRouteMatched: function (oEvent) {
                var oArgs = oEvent.getParameter("arguments");
                this.Uuid = oArgs.Uuid
                this.inputData = oArgs.inputData ? JSON.parse(oArgs.inputData) : undefined;
                
                this.initData();
            },
    
            initData: function() {
                this.setModel(new JSONModel([]), 'cartModel');
                this.setModel(new JSONModel({StockStatus : []}),"searchModel");
                this.byId("multiInput").setTokens([]);
                if(!this.filterModel){
                    this.filterModel = {
                        filters : [{
                            type : "상태 조회",
                            values : [{StockStatus : 'Success'}, {StockStatus : 'Warning'}, {StockStatus : 'Error'}]
                        }]
                    }
                    this.setModel(new JSONModel(this.filterModel), 'filterModel')
                }
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
                                this.setModel(new JSONModel({ ...aGetData[0], editable: this.editable, totalLength : aGetData[0].to_Item.results.length }), "inputModel");
                                this.setModel(new JSONModel(aGetData[0].to_Item.results), "stockModel");
                                resolve(); // 성공적으로 데이터를 가져오면 resolve 호출
                            }.bind(this))
                            .fail(function() {
                                console.error('Failed to read store data');
                                reject(); // 데이터를 가져오지 못하면 reject 호출
                            }.bind(this));
                        
                            // 섹션 포커스 설정
                        this.oObjectPageLayout = this.getView().byId("ObjectPageLayout");
                        this.oEditAttrSection = this.getView().byId("presentStock");
                        this.oObjectPageLayout.setSelectedSection( this.oEditAttrSection.getId() );

                    } else {
                        this.editable = true;
                        var oModel = new JSONModel({ ...this.inputData, editable: this.editable, totalLength : 0});
                        this.setModel(oModel, "inputModel");
                        this.setModel(new JSONModel([]), 'stockModel');


                        // 섹션 포커스 설정
                        this.oObjectPageLayout = this.getView().byId("ObjectPageLayout");
                        this.oEditAttrSection = this.getView().byId("addStock");
                        this.oObjectPageLayout.setSelectedSection( this.oEditAttrSection.getId() );

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

            getStockData: function (aFilter = []){
                var that = this;
                var oMainModel = this.getOwnerComponent().getModel();
                aFilter.push(new Filter("StoreUuid", "EQ", this.Uuid));
                this._getODataRead(oMainModel, '/Item', aFilter).done(function (aGetData) {
                    console.log(aGetData);
                    this.setModel(new JSONModel(aGetData), "stockModel");
                }.bind(this)).fail(function () {
                    MessageBox.information("Read Fail");
                }).always(function () {
                    var SortOrder = CoreLibrary.SortOrder;
                    var oProductNameColumn1 = that.getView().byId("ProductCode1");
                    that.getView().byId("table").sort(oProductNameColumn1, SortOrder.Ascending);
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
                delete headData.totalLength;
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
                var that = this;
                var oMainModel = this.getOwnerComponent().getModel();
                var headData = this.getModel('inputModel').getData();

                MessageBox.warning("해당 지점(" + headData.StoreName + ")을 영업 중지 처리 합니다. 해당 지점의 모든 정보가 사라집니다.", {
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (sAction) {
                        if(sAction === 'OK'){
                            that._getODataDelete(oMainModel, "/Head(guid'"+ that.Uuid +"')").done(function(aReturn){
                            }.bind(this)).fail(()=>{
                                MessageBox.information("Delete Fail");
                            }).then(()=>{
                                MessageBox.alert('정상적으로 영업 중지 처리 되었습니다.', { onClose : ()=>{
                                    that.navTo('Main', {})
                                }})
                            })            
                        }
                    },
                    dependentOn: this.getView()
                });

            },

            addStock: function (){
                var oMainModel = this.getOwnerComponent().getModel();
                var cartData = this.getModel('cartModel').getData();
                var headData = this.getModel("inputModel").getData();
                this.oObjectPageLayout = this.getView().byId("ObjectPageLayout");
                this.oEditAttrSection = this.getView().byId("presentStock");

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
                                        // 섹션 포커스 설정
                                        this.oObjectPageLayout.setSelectedSection( this.oEditAttrSection.getId() );
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
                    // 섹션 포커스 설정
                    this.oObjectPageLayout.setSelectedSection( this.oEditAttrSection.getId() );

                }

                var SortOrder = CoreLibrary.SortOrder;
                var oProductNameColumn1 = this.getView().byId("ProductCode1");
                this.getView().byId("table").sort(oProductNameColumn1, SortOrder.Ascending);

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
                var oMainModel = this.getOwnerComponent().getModel(); // stockModel 모델을 가져옵니다.
                var stockModel = this.getModel('stockModel')
                var selectedProductContext = oEvent.getSource().getParent().getBindingContext("stockModel");
                var selectedProductPath = selectedProductContext.getPath();
                var selectedProduct = selectedProductContext.getObject();
            
                if (selectedProduct.ProductStock <= 0) {
                    sap.m.MessageToast.show("재고가 부족합니다. 판매할 수 없습니다.");
                    return;
                }
            
                var params = {
                    method: "POST",
                    urlParameters: {
                        Uuid: selectedProduct.Uuid,
                        StoreUuid: selectedProduct.StoreUuid
                    },
                    success: function(oData, response) {
                        // Update the ProductStock property in the model
                        stockModel.setProperty(selectedProductPath + "/ProductStock", oData.ProductStock);
                        stockModel.setProperty(selectedProductPath + "/StockStatus", oData.StockStatus);
            
                        // Refresh the table binding
                        var oTable = that.getView().byId("table");
                        oTable.getBinding("rows").refresh();
            
                        sap.m.MessageToast.show("판매가 완료되었습니다.");
                    },
                    error: function(oError) {
                        sap.m.MessageToast.show("판매 중 오류가 발생했습니다.");
                    }
                };
            
                oMainModel.callFunction("/doSale", params);
            },

            onStore: function(oEvent) {
                var that = this;
                var oMainModel = this.getOwnerComponent().getModel(); // stockModel 모델을 가져옵니다.
                var stockModel = this.getModel('stockModel')
                var selectedProductContext = oEvent.getSource().getParent().getBindingContext("stockModel");
                var selectedProductPath = selectedProductContext.getPath();
                var selectedProduct = selectedProductContext.getObject();
            
                if (selectedProduct.ProductStock >= 30) {
                    sap.m.MessageToast.show("재고를 더 이상 보충 할 수 없습니다.");
                    return;
                }
            
                var params = {
                    method: "POST",
                    urlParameters: {
                        Uuid: selectedProduct.Uuid,
                        StoreUuid: selectedProduct.StoreUuid
                    },
                    success: function(oData, response) {
                        // Update the ProductStock property in the model
                        stockModel.setProperty(selectedProductPath + "/ProductStock", oData.ProductStock);
                        stockModel.setProperty(selectedProductPath + "/StockStatus", oData.StockStatus);
            
                        // Refresh the table binding
                        var oTable = that.getView().byId("table");
                        oTable.getBinding("rows").refresh();
            
                        sap.m.MessageToast.show("입고 완료되었습니다.");
                    },
                    error: function(oError) {
                        sap.m.MessageToast.show("입고 중 오류가 발생했습니다.");
                    }
                };
            
                oMainModel.callFunction("/doStore", params);
            },

            handleListClose: function(oEvent){
                var oFacetFilter = Object.keys(oEvent.getSource().getSelectedKeys());
                var filters = [];
                var aFilter = [];
    
                console.log(oFacetFilter);
    
                oFacetFilter.map(StockStatus =>{ 
                    filters.push(new Filter("StockStatus", "EQ", StockStatus));
                })
                
                var finalFilter = new Filter({
                    filters: filters,
                    and: false
                });
    
                aFilter.push(finalFilter);
    
                this.getStockData(aFilter);
            },
    
            handleFacetFilterReset: function(){
                var oFacetFilter = this.byId("facetFilter");
                oFacetFilter.getLists().map(oList => {
                    oList.setSelectedKeys();
                });
                this.getStockData();
            },

            handleValueHelp: function(oEvent) {
                var sInputValue = oEvent.getSource().getValue();
                // 프래그먼트를 로드하고 Dialog를 생성
                if (!this._pValueHelpDialog) {
                    this._pValueHelpDialog = Fragment.load({
                        id: this.getView().getId(),
                        name: "convenience.view.Dialog.StockStatus",
                        controller: this
                    }).then(function(oDialog){
                        this.getView().addDependent(oDialog);
                        return oDialog;
                    }.bind(this));
                }
    
                this._pValueHelpDialog.then(function(oDialog) {
                    // 모델을 설정하고 Dialog 열기
                    oDialog.setModel(new JSONModel([{StockStatus : 'Success'}, {StockStatus : 'Warning'}, {StockStatus : 'Error'}]), "valueHelpModel");
                    oDialog.open(sInputValue);
                }.bind(this));
            },

            _handleValueHelpSearch: function(oEvent) {
                var sValue = oEvent.getParameter("value");
                var oFilter = new Filter("StockStatus", FilterOperator.Contains, sValue);
                oEvent.getSource().getBinding("items").filter([oFilter]);
            },
    
            _handleValueHelpClose: function(oEvent) {
                var aSelectedItems = oEvent.getParameter("selectedItems");
                if (aSelectedItems) {
                    var aTokens = aSelectedItems.map(oItem => {
                        return new Token({
                            text: oItem.getBindingContext("valueHelpModel").getProperty("StockStatus")
                        });
                    });
                    var oMultiInput = this.byId("multiInput");
                    oMultiInput.setTokens(aTokens);
                    var StockStatus = aSelectedItems.map(function(oItem) {
                        return oItem.getBindingContext("valueHelpModel").getProperty("StockStatus");
                    });
                    this.setModel(new JSONModel({StockStatus: StockStatus}),"searchModel");
                }
                oEvent.getSource().getBinding("items").filter([]);
            },

            tokenDelete : function(oEvent) {
                var oToken = oEvent.getParameter("token"); // 삭제할 토큰 객체
                var sStockStatusToDelete = oToken.getText(); // 토큰의 텍스트 값 (Butxt)
                console.log(sStockStatusToDelete);
                // searchModel 가져오기
                var oModel = this.getModel("searchModel");
                var aStockStatus = oModel.getProperty("/StockStatus");
                console.log(aStockStatus);
    
                // Buname 배열에서 해당 Butxt 값을 가진 요소 제거
                var iIndex = aStockStatus.indexOf(sStockStatusToDelete);
                if (iIndex !== -1) {
                    aStockStatus.splice(iIndex, 1);
                    oModel.setProperty("/StockStatus", aStockStatus);
                }
    
                // 모델 업데이트
                oModel.refresh();
            },
    
            onTokenUpdate: function(oEvent) {
                var aRemovedTokens = oEvent.getParameter("removedTokens");
    
                if (aRemovedTokens && aRemovedTokens.length > 0) {
                    aRemovedTokens.forEach(function(oToken) {
                        this.tokenDelete({ getParameter: function() { return oToken; } });
                    }.bind(this));
                }
            },
    
            onSearch: function(){
                var searchDatas = this.getModel('searchModel').getData();
                var filters = [];
                var aFilter = [];
    
                console.log(searchDatas.StockStatus);
    
                if(searchDatas.StockStatus.length > 0){
                    searchDatas.StockStatus.map(searchData =>{ 
                        filters.push(new Filter("StockStatus", "EQ", searchData));
                    })
                    
                    var finalFilter = new Filter({
                        filters: filters,
                        and: false
                    });

                    aFilter.push(finalFilter);
                }

    
                this.getStockData(aFilter);

            }

        });
    }
)
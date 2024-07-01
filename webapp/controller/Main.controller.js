sap.ui.define([
    "convenience/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    'sap/m/MessagePopover',
	'sap/m/MessageItem',
	'sap/m/MessageToast',
	"sap/ui/core/Messaging",
	'sap/ui/core/message/Message',
	'sap/ui/core/message/MessageType',
    'sap/ui/core/Element',
	"sap/m/MessageBox",
],
function (Controller, JSONModel, Filter, FilterOperator, MessagePopover, MessageItem, MessageToast, Messaging, Message, MessageType, Element, MessageBox) {
    "use strict";

    return Controller.extend("convenience.controller.Main", {
        onInit: function () {
            this.getRouter().getRoute("Main").attachMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            this.initData();
        },

        initData: function (){
			
            this.setModel(new JSONModel({
                CombCode : undefined,
                StoreOwner : '',
                StoreLoca : '',
                StoreDetailloca : '',
                StorePhone : ''
            }), 'inputModel')

			this.setModel(new JSONModel({
                keyword : '',
                dataLength : 0,
                filters : []
            }), 'searchModel');
			
            this.getData()
        },

        getData: function (aFilter = []){
			this.getCombData();
            this.getHeadData(aFilter);
        },

		getCombData: function() {
			var oCombModel = this.getOwnerComponent().getModel('Comb');
            this._getODataRead(oCombModel, '/Comb').done(function(aGetData){
                console.log(aGetData);
                this.setModel(new JSONModel(aGetData), "combModel")
                if(!this.filterModel){
                    this.filterModel = {
                        filters : [{
                            type : "브랜드명",
                            values : aGetData,
                        }]
                    }
                    this.setModel(new JSONModel(this.filterModel), 'filterModel')
                }
            }.bind(this)).fail(function(){
                MessageBox.information("Read Fail");
            }).always(function(){
            });
		},

		getHeadData: function(aFilter) {
			var oheadModel = this.getOwnerComponent().getModel();
			this._getODataRead(oheadModel, '/Head', aFilter).done(function(aGetData){
                console.log(aGetData);
                this.setModel(new JSONModel(aGetData), "headModel");
                this.setProperty('searchModel', 'dataLength', aGetData.length);
            }.bind(this)).fail(function(){
                MessageBox.information("Read Fail");
            }).always(function(){
            });
		},

/////////////////////////// facetFilter ///////////////////////////
        handleListClose: function(oEvent){
            var oFacetFilter = Object.keys(oEvent.getSource().getSelectedKeys());
            var filters = [];
            var aFilter = [];

            console.log(oFacetFilter);

            oFacetFilter.map(combCode =>{ 
                filters.push(new Filter("CombCode", "EQ", combCode));
            })
            
            var finalFilter = new Filter({
                filters: filters,
                and: false
            });

            aFilter.push(finalFilter);

            this.getData(aFilter);
        },

        handleFacetFilterReset: function(){
			var oFacetFilter = this.byId("facetFilter");
			console.log(oFacetFilter.getLists())
            oFacetFilter.getLists().map(oList => {
                oList.setSelectedKeys();
            });
            this.getData();
        },
/////////////////////////// facetFilter ///////////////////////////
		

/////////////////////////// input Dialog ///////////////////////////
        onOpenPopoverDialog: function (){
            var oCombSelect = this.byId("combSelect");
            var sSelectedKey = oCombSelect.getSelectedKey();
            this.setProperty('inputModel', 'CombCode' , sSelectedKey);
			this.oView = this.getView();
			this._oMessageManager = Messaging;
            this._oMessageManager.removeAllMessages();
			this.oView.setModel(this._oMessageManager.getMessageModel(), "message");

            console.log(sSelectedKey);

			// create dialog lazily
			if (!this.oSIDialog) {
				this.oSIDialog = this.loadFragment({
					name: "convenience.view.Dialog.StoreInputDialog"
				});
			}
			this.oSIDialog.then(function (oDialog) {
				this.oDialog = oDialog;
                this.getView().addDependent(this.oDialog);
				this.oDialog.open();
				this._oMessageManager.registerObject(this.oView.byId("formContainer"), true);

				MessageToast.show(`모든 정보 입력 후 "지점 등록" 버튼을 눌러주십시오.
                
                지점 정보 저장 후 품목 선택화면으로 넘어갑니다. 
                `);

				this.createMessagePopover();

			}.bind(this));
        },

        createMessagePopover: function () {
			var that = this;

			this.oMP = new MessagePopover({
				activeTitlePress: function (oEvent) {
					var oItem = oEvent.getParameter("item"),
						oPage = that.getView().byId("messageHandlingPage"),
						oMessage = oItem.getBindingContext("message").getObject(),
						oControl = Element.registry.get(oMessage.getControlId());

					if (oControl) {
						oPage.scrollToElement(oControl.getDomRef(), 200, [0, -100]);
						setTimeout(function () {
							oControl.focus();
						}, 300);
					}
				},
				items: {
					path: "message>/",
					template: new MessageItem({
						title: "{message>message}",
						subtitle: "{message>additionalText}",
						groupName: {
							parts: [{
								path: 'message>controlIds'
							}],
							formatter: this.getGroupName
						},
						activeTitle: {
							parts: [{
								path: 'message>controlIds'
							}],
							formatter: this.isReachable
						},
						type: "{message>type}",
						description: "{message>message}"
					})
				},
				groupItems: true
			});

			this.getView().byId("messagePopoverBtn").addDependent(this.oMP);
		},

        buttonTypeFormatter: function () {
			var sHighestSeverity;
			var aMessages = this._oMessageManager.getMessageModel().oData;
			aMessages.forEach(function (sMessage) {
				switch (sMessage.type) {
					case "Error":
						sHighestSeverity = "Negative";
						break;
					case "Warning":
						sHighestSeverity = sHighestSeverity !== "Negative" ? "Critical" : sHighestSeverity;
						break;
					case "Success":
						sHighestSeverity = sHighestSeverity !== "Negative" && sHighestSeverity !== "Critical" ? "Success" : sHighestSeverity;
						break;
					default:
						sHighestSeverity = !sHighestSeverity ? "Neutral" : sHighestSeverity;
						break;
				}
			});

			return sHighestSeverity;
		},

        highestSeverityMessages: function () {
			var sHighestSeverityIconType = this.buttonTypeFormatter();
			var sHighestSeverityMessageType;

			switch (sHighestSeverityIconType) {
				case "Negative":
					sHighestSeverityMessageType = "Error";
					break;
				case "Critical":
					sHighestSeverityMessageType = "Warning";
					break;
				case "Success":
					sHighestSeverityMessageType = "Success";
					break;
				default:
					sHighestSeverityMessageType = !sHighestSeverityMessageType ? "Information" : sHighestSeverityMessageType;
					break;
			}

			return this._oMessageManager.getMessageModel().oData.reduce(function (iNumberOfMessages, oMessageItem) {
				return oMessageItem.type === sHighestSeverityMessageType ? ++iNumberOfMessages : iNumberOfMessages;
			}, 0) || "";
		},

		// Set the button icon according to the message with the highest severity
		buttonIconFormatter: function () {
			var sIcon;
			var aMessages = this._oMessageManager.getMessageModel().oData;

			aMessages.forEach(function (sMessage) {
				switch (sMessage.type) {
					case "Error":
						sIcon = "sap-icon://error";
						break;
					case "Warning":
						sIcon = sIcon !== "sap-icon://error" ? "sap-icon://alert" : sIcon;
						break;
					case "Success":
						sIcon = sIcon !== "sap-icon://error" && sIcon !== "sap-icon://alert" ? "sap-icon://sys-enter-2" : sIcon;
						break;
					default:
						sIcon = !sIcon ? "sap-icon://information" : sIcon;
						break;
				}
			});

			return sIcon;
		},

		_generateInvalidUserInput: function () {
			var oButton = this.getView().byId("messagePopoverBtn");
			var allFieldsValid = true;

			this.oView.byId("formContainer").getItems()[0].getContent().map((input, index) => {
				if(index%2===0 && index > 1 && index < 9) 
					if (!this.handleRequiredField(input)) {
						allFieldsValid = false;
					}
			});

			this.oMP.getBinding("items").attachChange(function (oEvent) {
				this.oMP.navigateBack();
				oButton.setType(this.buttonTypeFormatter());
				oButton.setIcon(this.buttonIconFormatter());
				oButton.setText(this.highestSeverityMessages());
			}.bind(this));

			// 모든 필수 필드가 유효한 경우 서버에 값 저장
			if (allFieldsValid) {
				this.onCreateStore();
			} else {
				// 아닐 경우 message 창 open
				setTimeout(function () {
					this.oMP.openBy(oButton);
				}.bind(this), 100);
			}

		},

        handleRequiredField: function (oInput) {
            var sModelName = "inputModel";
            var sPropertyPath = oInput.getBindingPath("value");
            var sTarget = sModelName + ">" + sPropertyPath;
        
            this.removeMessageFromTarget(sTarget); // 이전 메시지 제거
        
            if (!oInput.getValue()) {
                this._oMessageManager.addMessages(
                    new Message({
                        message: "필수 항목이 입력되지 않았습니다.",
                        type: MessageType.Error,
                        additionalText: oInput.getLabels()[0].getText(),
                        target: sTarget,
                        processor: this.getView().getModel(sModelName)
                    })
                );
				return false;
            } else {
				return true;
			}
        },

        removeMessageFromTarget: function (sTarget) {
            var aMessages = this._oMessageManager.getMessageModel().getData();
            for (var i = aMessages.length - 1; i >= 0; i--) {
                if (aMessages[i].target === sTarget) {
                    this._oMessageManager.removeMessages(aMessages[i]);
                }
            }
        },

        isReachable: function (sControlId) {
			// Such a hook can be used by the application to determine if a control can be found/reached on the page and navigated to.
			return sControlId ? true : true;
		},

        getGroupName: function (sControlId) {
			// the group name is generated based on the current layout
			// and is specific for each use case
			var oControl = Element.registry.get(sControlId[0]);

			if (oControl) {
				var sFormSubtitle = oControl.getParent().getParent().getTitle().getText(),
					sFormTitle = oControl.getParent().getParent().getParent().getTitle();

				return sFormTitle + ", " + sFormSubtitle;
			}
		},

        _closeDialog: function () {
			this.oDialog.close();
		},

/////////////////////////// input Dialog ///////////////////////////

        onCreateStore: function() {
			var inputData = this.getModel('inputModel').getData();
			this.navTo('Detail', {
				inputData: JSON.stringify(inputData)
			});
        },
		
		onMove: function(oEvent) {
			var Uuid = oEvent.getSource().getParent().getBindingContext("headModel").getObject().Uuid
			this.navTo('Detail', {
				Uuid : Uuid
			});
		},

		onStopService: function() {
			var oCombSelect = this.byId("combSelect");
			var sSelectedKey = oCombSelect.getSelectedKey();
			var sSelectedTxt = oCombSelect.getSelectedItem().getText();
			var that = this;

			MessageBox.warning("해당 브랜드(" + sSelectedTxt + ")를 폐업 처리 합니다. 해당 브랜드의 모든 지점에 대한 정보가 사라집니다.", {
				actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
				emphasizedAction: MessageBox.Action.OK,
				onClose: function (sAction) {
					if(sAction === 'OK'){
						var headData = that.getModel('headModel').getData();
						var combData = that.getModel('combModel').getData();
						var oMainModel = that.getOwnerComponent().getModel();
						var oCombModel = that.getOwnerComponent().getModel('Comb');

						combData.map(comb => {
							if(comb.CombCode === sSelectedKey){
								comb.CombStatus = 'X';
								that._getODataUpdate(oCombModel, "/Comb(guid'"+ comb.Uuid +"')", comb).done(function(aReturn){
								
									}.bind(this)).fail(function(){
										// chk = false;
									}).always(function(){
						
								});
							}
						})

						headData.map(store => {
							if( store.CombCode === sSelectedKey ){
								that._getODataDelete(oMainModel, "/Head(guid'"+ store.Uuid +"')").done(function(aReturn){
								}.bind(this)).fail(()=>{
									MessageBox.information("Delete Fail");
								}).then(()=>{
									MessageBox.alert('정상적으로 폐업 처리 되었습니다.', { onClose : ()=>{
										that.getData();
										// 모델 리프레시
										that.getModel('headModel').refresh();
										that.getModel('combModel').refresh();
										// 변수 초기화
										sSelectedKey = '';
										sSelectedTxt = '';
										// 콤보박스 선택 초기화
										oCombSelect.setSelectedKey('');
									}})
								})	
							}
						})
					}
				},
				dependentOn: this.getView()
			});

		},
    });
});

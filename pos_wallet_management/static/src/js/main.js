/* Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>) */
/* See LICENSE file for full copyright and licensing details. */
/* License URL : <https://store.webkul.com/license.html/> */
odoo.define('pos_wallet_management.pos_wallet_management', function(require){
"use strict";
    var pos_model = require('point_of_sale.models');
    var rpc = require('web.rpc')
    var PosDB = require('point_of_sale.DB');
    const ClientLine = require('point_of_sale.ClientLine');
    var core = require('web.core');
    var _t = core._t;
    var utils = require('web.utils');
    var round_di = utils.round_decimals;
    var SuperPaymentline = pos_model.Paymentline.prototype;
    var SuperOrder = pos_model.Order.prototype;
    const NumberBuffer = require('point_of_sale.NumberBuffer');
    const PosComponent = require('point_of_sale.PosComponent');
    const ClientListScreen = require('point_of_sale.ClientListScreen');
    const PaymentScreen = require('point_of_sale.PaymentScreen');
    const ProductScreen = require('point_of_sale.ProductScreen');
    const SuperPaymentScreen = PaymentScreen.prototype;
    const SuperClientListScreen = ClientListScreen.prototype;
    var model_list = pos_model.PosModel.prototype.models;
    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registries = require('point_of_sale.Registries');


    var journal_model = null;
    pos_model.load_fields('pos.payment.method','wallet_method');
    pos_model.load_fields('res.partner',['wallet_credits','wallet_id']);

    //--Fetching model dictionary--
    for(var i = 0,len = model_list.length;i<len;i++){
        if(model_list[i].model == "pos.payment.method"){
            journal_model = model_list[i];
            break;
        }
    }

    //--Searching wallet journal--
    var super_journal_loaded = journal_model.loaded;
    journal_model.loaded = function(self, journals){
        super_journal_loaded.call(this,self,journals);
        journals.forEach(function(journal){
            console.log("journal",journal)
            if(journal.wallet_method){
                self.db.wallet_method = journal;
                return true;
            }
        });
    };

    // --set wallet product----
    PosDB.include({
	    add_products: function(products){
            var self = this;
           for(var i = 0, len = products.length; i < len; i++){
                if(products[i].default_code == 'wk_wallet'){
                    products[i].not_returnable = true;
                    self.wallet_product = products[i];
                }
           }
            self._super(products)
        }
    });


    const PosProductScreen = (ProductScreen) =>
        class extends ProductScreen {
        mounted() {
            var self = this;
            var current_order = self.env.pos.get_order();
            // this._super(reset);
            super.mounted();
            if (current_order != null && current_order.wallet_recharge_data) {
                $('.product').css("pointer-events", "none");
                $('.product').css("opacity", "0.4");
                $('.header-cell').css("pointer-events", "none");
                $('.header-cell').css("opacity", "0.4");
                $('.numpad-backspace').css("opacity", "0.4");
                $('.numpad-backspace').css("pointer-events", "none");
                $('.numpad-backspace').css("opacity", "0.4");
                $('.numpad .mode-button[data-mode~="quantity"]').css("pointer-events", "none");
                $('.numpad .mode-button[data-mode~="quantity"]').css("opacity", "0.4");
                $('.numpad .mode-button[data-mode~="price"]').css("pointer-events", "none");
                $('.numpad .mode-button[data-mode~="price"]').css("opacity", "0.4");
                $('.numpad .mode-button[data-mode~="discount"]').css("pointer-events", "none");
                $('.numpad .mode-button[data-mode~="discount"]').css("opacity", "0.4");
            }
            else{

                $('.product').css("pointer-events", "");
                $('.product').css("opacity", "");
                $('.header-cell').css("pointer-events", "");
                $('.header-cell').css("opacity", "");
                $('.numpad-backspace').css("opacity", "");
                $('.numpad-backspace').css("pointer-events", "");
                $('.numpad-backspace').css("opacity", "");
                $('.numpad .mode-button[data-mode~="quantity"]').css("pointer-events", "");
                $('.numpad .mode-button[data-mode~="quantity"]').css("opacity", "");
                $('.numpad .mode-button[data-mode~="price"]').css("pointer-events", "");
                $('.numpad .mode-button[data-mode~="price"]').css("opacity", "");
                $('.numpad .mode-button[data-mode~="discount"]').css("pointer-events", "");
                $('.numpad .mode-button[data-mode~="discount"]').css("opacity", "");
            }
        }
    }
    Registries.Component.extend(ProductScreen, PosProductScreen);



// ---load wallet model---------------------
    pos_model.load_models([{
		model: 'pos.wallet',
		fields: ['name','partner_id','amount'],
		domain: function(self){
			return [['state','=','confirm']]
		},
		loaded: function(self,wallets){

            wallets = wallets.sort(function(a,b){
                return b.id - a.id;
            });
            self.db.all_wallets = wallets;
            self.db.wallet_by_name = {};
            wallets.forEach(function(wallet){
                self.db.wallet_by_name[wallet.name] = wallet;
            })
		}
	}])

    pos_model.Paymentline = pos_model.Paymentline.extend({
        initialize: function(attributes, props){
            this.is_wallet_payment_line = false;
            SuperPaymentline.initialize.call(this, attributes, props);
        },
    });


    class WkErrorNotifyPopopWidget extends AbstractAwaitablePopup {
        mounted(){
            var self = this;
            super.mounted();
            setTimeout(function(){
                $('.move').addClass('complete');
            },500)

        }
    }
    WkErrorNotifyPopopWidget.template = 'WkErrorNotifyPopopWidget';
    WkErrorNotifyPopopWidget.defaultProps = {
        title: 'Confirm ?',
        body: '',
    };

    Registries.Component.add(WkErrorNotifyPopopWidget);

    class CreateWalletPopopWidget extends AbstractAwaitablePopup {
        mounted(){
            var self = this;
            super.mounted();
			setTimeout(function(){
				$('.move').addClass('complete');
			},500)
            $('.create_wallet').css({'pointer-events':'all'});
        }
        click_create_wallet(){

           var self = this;
           if(self.props && self.props.partner){
                var partner = self.props.partner;
                $('.button.create_wallet').css({'pointer-events':'none'})
                rpc.query({
					model:'pos.wallet',
					method:'create_wallet_by_rpc',
					args:[{'partner_id':parseInt(partner.id)}]
				})
                .then(function(result){
                    partner.wallet_id = [result.id,result.name];
                    var wallet_details = result;
                    wallet_details['partner_id']=[partner.id,partner.name];
                    wallet_details['partner']= self.props.partner;
                    if($('.client-line.highlight .wallet_credits').length)
                        $('.client-line.highlight .wallet_credits').text(self.env.format_currency(0));
                    else{
                        let client_line = $($('.client-line')[$('.client-line').length-1]);
                        let data_id = client_line.data('id');
                        let partner = self.env.pos.db.get_partner_by_id(data_id);
                        client_line.ch
                        if (partner && partner.wallet_id){
                            client_line.click();
                            client_line.children('.wallet_credits').text(self.env.format_currency(partner.wallet_credits));
                        }
                    }

                    self.env.pos.db.wallet_by_name[result.name] = wallet_details;
                    self.env.pos.db.all_wallets.push(wallet_details);
                    $('.wk_confirm_mark').hide();
                    $('.wallet_status').css({'display': 'inline-block'});
                    $('#order_sent_status').hide();
                    $('.wallet_status').removeClass('order_done');
                    $('.show_tick').hide();
                    setTimeout(function(){
                        $('.wallet_status').addClass('order_done');
                        $('.show_tick').show();
                        $('#order_sent_status').show();
                        $('.wallet_status').css({'border-color':'#5cb85c'});
                        $('.wk-alert center h2').text("Wallet Created !!!!!");

                    },500)
                    setTimeout(function(){
                         self.showPopup('WkWalletRechargePopup',{'partner':partner});
                    },1000);
                    $('.recharge_wallet').show();
                    $('.create_wallet').hide();
                })
                .catch(function(unused, event) {
                    self.showPopup('WkErrorNotifyPopopWidget', {
                        title: _t('Failed To create wallet'),
                        body: _t('Please make sure you are connected to the network.'),
                    });
                })
           }
        }
    }

    CreateWalletPopopWidget.template = 'CreateWalletPopopWidget';
    CreateWalletPopopWidget.defaultProps = {
        title: 'Confirm ?',
        body: '',
    };

    Registries.Component.add(CreateWalletPopopWidget);



    class WkWalletRechargePopup extends AbstractAwaitablePopup {
        mounted(){
            var self = this;
            super.mounted();
			setTimeout(function(){
				$('.move').addClass('complete');
            },500)
            $('.rechage_amount').attr('placeholder',"Amount ("+self.env.pos.currency.symbol+")")
            $('.rechage_amount').focus();
        }
        wk_validate_recharge(){
            var self = this;
            if(self.props && self.props.partner){
                var recharge_amount = parseFloat($('.rechage_amount').val());
                var reason = $('.recharge_reason').val();
                if(recharge_amount<=0 || !recharge_amount){
                    $('.rechage_amount').removeClass('text_shake');
                    $('.rechage_amount').focus();
                    $('.rechage_amount').addClass('text_shake');
					return;

                }
                else if(reason == ""){
                    $('.recharge_reason').removeClass('text_shake');
                    $('.recharge_reason').focus();
                    $('.recharge_reason').addClass('text_shake');
					return;
                }
                else{
                    var wallet_product = self.env.pos.db.wallet_product;
                    if(wallet_product){
                        var trans_data = {};
                        trans_data.amount = recharge_amount;
                        trans_data.trans_reason = reason;
                        trans_data.created_by = parseInt(self.env.pos.cashier ? self.env.pos.cashier.id : self.env.pos.user.id);
                        trans_data.partner_id = parseInt(self.props.partner.id);
                        trans_data.wallet_id = parseInt(self.props.partner.wallet_id[0]);
                        trans_data.payment_type = 'CREDIT';
                        trans_data.wallet_product_id = wallet_product.id;
                        trans_data.state = 'confirm'
                        self.env.pos.add_new_order();
                        var curren_order = self.env.pos.get_order();
                        curren_order.wallet_recharge_data = trans_data;
                        curren_order.add_product(wallet_product, {quantity: 1, price: recharge_amount });
                        curren_order.set_client(self.props.partner);
                        self.cancel();
                        this.trigger('close-temp-screen');
                        self.showScreen('PaymentScreen');
                        curren_order.save_to_db();
                    }
                    else{
                        self.showPopup('WkErrorNotifyPopopWidget', {
							title: _t('Failed To Recharge Wallet.'),
							body: _t('No wallet product is available in POS.'),
						});
                    }

                }
            }
        }
    }
    WkWalletRechargePopup.template = 'WkWalletRechargePopup';
    WkWalletRechargePopup.defaultProps = {
        title: 'Confirm ?',
        body: '',
    };

    Registries.Component.add(WkWalletRechargePopup);



    class MainWalletRechargePopup extends AbstractAwaitablePopup {
        mounted(){
            var self = this;
            super.mounted();
			setTimeout(function(){
				$('.move').addClass('complete');
			},500);
            $('.wallet_input').focus();
            self.index = -1;
			self.parent = $('.wallet-holder');
        }

        wallet_key_press_input(event){
            var self = this;
			var updown_press;
			var all_wallets = self.env.pos.db.all_wallets;
			$('.wallet-holder ul').empty();
			var search = $('.wallet_input').val();
			$('.wallet-holder').show();
			search = new RegExp(search.replace(/[^0-9a-z_]/i), 'i');
			for(var index in all_wallets){
				if(all_wallets[index].name.match(search)){
			   	    $('.wallet-holder ul').append($("<li><span class='wallet-name'>" + all_wallets[index].name + "</span></li>"));
				}
			}

            if($('.wallet-holder')[0] && $('.wallet-holder')[0].style.display !="none")
                $('.wallet_details').hide();

			$('.wallet-holder ul').show();
			$('.wallet-holder li').on('click', function(){
				var quotation_id = $(this).text();
				$(".wallet_input").val(quotation_id);
                $('.wallet-holder').hide();
                $(".wallet_input").blur();
			});
			if(event.which == 38){
				// Up arrow
				self.index--;
				var len = $('.wallet-holder li').length;
				if(self.index < 0)
					self.index = len-1;
				self.parent.scrollTop(36*self.index);
				updown_press = true;
			}else if(event.which == 40){
				// Down arrow
				self.index++;
				if(self.index > $('.wallet-holder li').length - 1)
					self.index = 0;
				self.parent.scrollTop(36*self.index);
			   	updown_press = true;
			}
			if(updown_press){
				$('.wallet-holder li.active').removeClass('active');
				$('.wallet-holder li').eq(self.index).addClass('active');
				$('.wallet-holder li.active').select();
			}

			if(event.which == 27){
				// Esc key
				$('.wallet-holder ul').hide();
			}else if(event.which == 13 && self.index >=0 && $('.wallet-holder li').eq(self.index)[0]){
				var selcted_li_wallet_id = $('.wallet-holder li').eq(self.index)[0].innerText;
				$(".wallet_input").val(selcted_li_wallet_id);
                $('.wallet-holder ul').hide();
				$('.wallet-holder').hide();
				self.index = -1;
                $('.wallet_input').focusout();

			}
        }
        click_validate_wallet(){
            var self = this;
            var wallet_input = $('.wallet_input').val();
            if(wallet_input && self.env.pos.db.wallet_by_name[wallet_input]){
                var wallet = self.env.pos.db.wallet_by_name[wallet_input];
                var partner = self.env.pos.db.get_partner_by_id(wallet.partner_id[0]);
                if (partner)
                    self.showPopup('WkWalletRechargePopup',{'partner':partner});
            }
            else{
                $('.wallet_input').addClass('text_shake')
                setTimeout(function(){
                    $('.wallet_input').removeClass('text_shake');
                },500);
            }
         }
    }
    MainWalletRechargePopup.template = 'MainWalletRechargePopup';
    MainWalletRechargePopup.defaultProps = {
        title: 'Confirm ?',
        body: '',
    };
    Registries.Component.add(MainWalletRechargePopup);



    class WalletRechargeWidget extends PosComponent {
        async onClick() {
                if(this.env.pos.db.wallet_method)
                    this.showPopup("MainWalletRechargePopup",{});
                else
                    this.showPopup('WkErrorNotifyPopopWidget',{
                        title: _t('Payment Method  For Wallet Not Found'),
                        body: _t('Please check the backend configuration. No payment method for wallet is available'),
                    });
        }
    }
    WalletRechargeWidget.template = 'WalletRechargeWidget';

    Registries.Component.add(WalletRechargeWidget);



    const PosResClientListScreen = (ClientListScreen) =>
        class extends ClientListScreen{
            mounted(){
                var self = this;
                var current_order = self.env.pos.get_order();
                super.mounted();
                if(current_order != null && current_order.wallet_recharge_data){
                    if(self.is_wallet_orderline())
                        self.back();
                    else
                        current_order.wallet_recharge_data = null;
                }
            }
    // -------------------check item cart contain wallet product or not------------
            is_wallet_orderline(){
                var self = this;
                var current_order = self.env.pos.get_order();
                var wallet_line = false;
                if(current_order.get_orderlines() && self.env.pos.db.wallet_product){
                    current_order.get_orderlines().forEach(function(orderline){
                        if(orderline.product.id == self.env.pos.db.wallet_product.id)
                            wallet_line = true;
                    });
                }
                return wallet_line;
            }
        }
    Registries.Component.extend(ClientListScreen, PosResClientListScreen);


    const PosResClientLine = (ClientLine) =>
        class extends ClientLine{
            recharge_wallet(){
                var self = this;
                if(self.env.pos.db.wallet_method)
                    self.showPopup('WkWalletRechargePopup',{'partner':this.props.partner});
                else
                    self.showPopup('WkErrorNotifyPopopWidget',{
                        title: _t('Payment Method  For Wallet Not Found'),
                        body: _t('Please check the backend configuration. No payment method for wallet is available'),
                    });
            }
            create_wallet(){
                var self = this;
                if(self.env.pos.db.wallet_method)
                    self.showPopup('CreateWalletPopopWidget',{
                        'partner':this.props.partner,
                        'title':'No Wallet For Selected Customer',
                        'body':'You need to create a wallet for this customer before you can proceed to recharge'
                    })
                else
                    self.showPopup('WkErrorNotifyPopopWidget',{
                        title: _t('Payment Method  For Wallet Not Found'),
                        body: _t('Please check the backend configuration. No payment method for wallet is available'),
                    });
            }
        }
        Registries.Component.extend(ClientLine, PosResClientLine);

    const PosWechatPaymentScreen = (PaymentScreen) =>
    class extends PaymentScreen {

        _updateSelectedPaymentline() {
            var self = this;
            super._updateSelectedPaymentline();
            var current_order = self.env.pos.get_order();
            var client = current_order.get_client();
            var input = NumberBuffer.get();
            console.log("input",input)
            if($.isNumeric(input)){
                var selected_paymentline = current_order.selected_paymentline;
                if(selected_paymentline && selected_paymentline.is_wallet_payment_line){
                    var input_amount = selected_paymentline.amount;
                    selected_paymentline.amount = 0;
                    var due_amount = current_order.get_due();
                    var wallet_credits = client.wallet_credits;
                    var set_this_amount = Math.min(due_amount, wallet_credits, input_amount);
                    current_order.selected_paymentline.set_amount(set_this_amount);
                    self.inputbuffer = set_this_amount.toString();
                    // self.order_changes();
                    self.render();
                    $('.paymentline.selected .edit').text(self.env.pos.format_currency_no_symbol(set_this_amount));
                    $('div.wallet_balance').html("Balance: <span style='color: #247b45;font-weight: bold;'>" + self.env.pos.format_currency(client.wallet_credits-set_this_amount) + "</span>");
                }
            }else if (input == "BACKSPACE") {
                var selected_paymentline = current_order.selected_paymentline;
                if(selected_paymentline && selected_paymentline.is_wallet_payment_line){
                    var input_amount = selected_paymentline.amount;
                    $('.paymentline.selected .edit').text(self.env.pos.format_currency_no_symbol(set_this_amount));
                    $('div.wallet_balance').html("Balance: <span style='color: #247b45;font-weight: bold;'>" + self.env.pos.format_currency(client.wallet_credits-input_amount) + "</span>");

                }
            }
        }
        check_existing_wallet_line(){
            var self = this;
            var current_order = self.env.pos.get_order();
            var existing_wallet_line = null;
            var paymentlines = current_order.get_paymentlines();
            if (self.env.pos.db.wallet_method){
                paymentlines.forEach(function(line){
                    if(line.payment_method.id == self.env.pos.db.wallet_method.id){
                        line.is_wallet_payment_line = true;
                        existing_wallet_line = line;
                        return true;
                    }
                });
            }
            return existing_wallet_line;
        }

        addNewPaymentLine({ detail: paymentMethod }) {
            var self = this;
            var current_order = self.env.pos.get_order();
            var client = current_order.get_client();
            var due = current_order.get_due();
            if(paymentMethod.wallet_method){
                if(client && client.wallet_credits > 0){
                    var existing_line = self.check_existing_wallet_line();
                    var selected_paymentline = null;
                    if(existing_line){
                        current_order.select_paymentline(existing_line);
                        selected_paymentline = current_order.selected_paymentline;
                    }else if(due > 0){
                        super.addNewPaymentLine({ detail: paymentMethod });
                        selected_paymentline = current_order.selected_paymentline;
                    }
                    if(selected_paymentline){
                        selected_paymentline.set_amount(0);
                        due = current_order.get_due();
                        var payment_amount = Math.min(due, client.wallet_credits);
                        selected_paymentline.set_amount(payment_amount);
                        selected_paymentline.is_wallet_payment_line = true;
                        $('.paymentline.selected .edit').text(self.env.pos.format_currency_no_symbol(payment_amount));
                        $('#use_wallet_payment').prop('checked', true);
                        $('div.wallet_balance').html("Balance: <span style='color: #247b45;font-weight: bold;'>" + self.env.pos.format_currency(client.wallet_credits-payment_amount) + "</span>");
                        self.render();
                    }
                }
                else if(!client){
                    const { confirmed } = this.showPopup('ConfirmPopup', {
                        title: this.env._t('Please select the Customer'),
                        body: this.env._t('You need to select the customer before using wallet payment method.'),
                    });
                    console.log("confirmed",confirmed)
                    if (confirmed) {
                        // SuperPaymentScreen.selectClient.call(self);
                        console.log("workigggggggg")
                        const currentClient = self.currentOrder.get_client();
                        const { confirmed, payload: newClient } = self.showTempScreen(
                            'ClientListScreen',
                            { client: currentClient }
                        );
                        if (confirmed) {
                            self.currentOrder.set_client(newClient);
                            self.currentOrder.updatePricelist(newClient);
                        }
                        return false;
                    }
                }
                else if(client && !client.wallet_id){
                    self.showPopup('WkErrorNotifyPopopWidget',{
							title: _t('No Wallet For Selected Customer'),
							body: _t('Please configure/create a wallet from backend for the selected customer.'),
						});
                }
            }else
                        super.addNewPaymentLine({ detail: paymentMethod });
                        // this._super(id);
        }
        mounted(){
            var self = this;
            // this._super();s
            super.mounted();
            var current_order = self.env.pos.get_order();
            var client = current_order.get_client();
            self.hide_wallet_payment_method();
            if(client){
                 if(client.wallet_credits > 0 && !current_order.wallet_recharge_data && self.env.pos.db.wallet_method ) {
                    self.check_existing_wallet_line();
                    $('div.wallet_balance').show();
                    $('div.wallet_balance').html("Balance: <span style='color: #247b45;font-weight: bold;'>" + self.env.pos.format_currency(client.wallet_credits) + "</span>");
                    $('div.use_wallet').show();
                    $('#use_wallet_payment').change(function() {
                        if($(this).is(":checked")){
                            //self.click_paymentmethods(self.env.pos.db.wallet_method.id);
                            var paymentMethod = self.env.pos.db.wallet_method
                            self.addNewPaymentLine({ detail: paymentMethod })
                            if(!self.check_existing_wallet_line())
                                $('#use_wallet_payment').prop('checked', false);
                        }
                        else{
                            current_order.remove_paymentline(self.check_existing_wallet_line());
                            self.render();
                        }
                    });
                }else{
                    $('div.use_wallet').hide();
                     $('div.wallet_balance').hide();
                }
            }else{
                $('div.wallet_balance').hide();
                $('div.use_wallet').hide();

            }
            var existing_wallet_line = self.check_existing_wallet_line();
            if(existing_wallet_line){
                self.update_walletline_balance(existing_wallet_line);
            }
        }



        update_walletline_balance(pline){
            var self = this;
            var order = self.env.pos.get_order();
            var client = self.env.pos.get_order().get_client();
            if(client.wallet_credits >0){
                order.select_paymentline(pline);
                var pline_amount =  pline.amount;
                pline.set_amount(0);
                var due = self.env.pos.get_order().get_due();
                var payment_amount = Math.min(due, pline_amount, client.wallet_credits);
                pline.set_amount(payment_amount);
                pline.is_wallet_payment_line = true;
                self.render();
                $('.paymentline.selected .edit').text(self.env.pos.format_currency_no_symbol(payment_amount));
                $('#use_wallet_payment').prop('checked', true);
                $('div.wallet_balance').html("Balance: <span style='color: #247b45;font-weight: bold;'>" + self.env.pos.format_currency(client.wallet_credits-payment_amount) + "</span>");
            }
            else{
                order.remove_paymentline(pline);
                NumberBuffer.reset();
                self.render();
            }
        }


        hide_wallet_payment_method(){
            var self = this;
            var current_order= self.env.pos.get_order();
            if(current_order && self.env.pos.db.wallet_method){
                var wallet_method_id = self.env.pos.db.wallet_method.id;
                var find_string = '[data-id=' + wallet_method_id.toString() + ']';
                var wallet_paymentmethods = ($('.paymentmethods').find(find_string)[0]);
                if(current_order && current_order.wallet_recharge_data && self.env.pos.db.wallet_method ||!(current_order && current_order.get_client() && current_order.get_client().wallet_credits ) )
                    $(wallet_paymentmethods).hide();
                else
                     $(wallet_paymentmethods).show();
            }
        }

        show_wallet_payment_method(){
            var self = this;
            var wallet_method_id = self.env.pos.db.wallet_method.id;
            var find_string = '[data-id=' + wallet_method_id.toString() + ']';
            var wallet_paymentmethods = ($('.paymentmethods').find(find_string)[0]);
            if (wallet_paymentmethods)
                $(wallet_paymentmethods).show();

        }
    // ------update customer wallet balance--------------------
        async validateOrder(isForceValidate) {
            var self = this;
            var current_order= self.env.pos.get_order();
            // self._super(force_validation);
            super.validateOrder(isForceValidate);
            if(current_order.is_paid()){
                if(current_order && current_order.wallet_recharge_data && self.env.pos.db.wallet_product){
                    var orderline = current_order.get_orderlines();
                    var partner = current_order.get_client();
                    var amount = 0.0;
                    current_order.get_orderlines().forEach(function(orderline){
                        if(orderline.product.id == self.env.pos.db.wallet_product.id){
                            amount = amount + parseFloat(orderline.get_display_price());
                        }
                    });
                    partner.wallet_credits = round_di(parseFloat(partner.wallet_credits) + amount,3);
                    // self.env.pos.chrome.screens.clientlist.partner_cache.clear_node(partner.id);
                }
                else if(current_order && self.env.pos.db.wallet_method && current_order.get_client()){
                    var plines = current_order.get_paymentlines();
                    var amount = 0.0;
                    var partner = current_order.get_client();
                    plines.forEach(function(pline){
                        if(pline.payment_method.id == self.env.pos.db.wallet_method.id){
                            amount = amount + parseFloat(pline.amount);
                        }
                    });
                    partner.wallet_credits = round_di(parseFloat(partner.wallet_credits) - amount,3);
                    // self.env.pos.chrome.screens.clientlist.partner_cache.clear_node(partner.id);
                }
            }
        }
   }

   Registries.Component.extend(PaymentScreen, PosWechatPaymentScreen);




    pos_model.Order = pos_model.Order.extend({
        init_from_JSON: function(json) {
            var self = this;
            SuperOrder.init_from_JSON.call(self,json);
            if(json.wallet_recharge_data)
                self.wallet_recharge_data = json.wallet_recharge_data;
        },
        initialize: function(attributes,props){
            var self = this;
            self.wallet_recharge_data = null;
            SuperOrder.initialize.call(this,attributes,props);
        },
        export_as_JSON: function() {
            var self = this;
            var loaded=SuperOrder.export_as_JSON.call(this);
            var current_order = self.pos.get_order();
            if(current_order!=null)
            {
                loaded.wallet_recharge_data = current_order.wallet_recharge_data;
            }
            return loaded;
        },
        remove_paymentline: function(line){
            var self = this;
            if(line && line.is_wallet_payment_line){
                $('#use_wallet_payment').prop('checked', false);
                if(self.pos.get_order().get_client())
                    $('div.wallet_balance').html("Balance: <span style='color: #247b45;font-weight: bold;'>" + self.pos.format_currency(self.pos.get_order().get_client().wallet_credits) + "</span>");
            }
            SuperOrder.remove_paymentline.call(this, line);
        },
        set_client: function(client){
            var self = this;
            SuperOrder.set_client.call(self,client);
            // if (self.pos.get_order() &&  self.pos.chrome.screens.payment && self.pos.chrome.screens.payment.check_existing_wallet_line())
            //     self.pos.get_order().remove_paymentline(self.pos.chrome.screens.payment.check_existing_wallet_line());
            if (self.pos.get_order()){
                self.pos.get_order().remove_paymentline(self.check_existing_wallet_line());
            }
        },
        check_existing_wallet_line:function(){
            var self = this;
            var current_order = self.pos.get_order();
            var existing_wallet_line = null;
            var paymentlines = current_order.get_paymentlines();
            if (self.pos.db.wallet_method){
                paymentlines.forEach(function(line){
                    if(line.payment_method.id == self.pos.db.wallet_method.id){
                        line.is_wallet_payment_line = true;
                        existing_wallet_line = line;
                        return true;
                    }
                });
            }
            return existing_wallet_line;
        },

        add_product: function(product, props){
            var self = this;
            if(self.pos.db.wallet_product && product.id == self.pos.db.wallet_product.id && !self.pos.get_order().wallet_recharge_data){
                self.showPopup("MainWalletRechargePopup");
            }
            else
                SuperOrder.add_product.call(self,product,props);
        },
        wallet_remaining_balance: function(){
            var self = this;
            var paymentlines = self.pos.get_order().get_paymentlines();
            var line_amount = 0;
            if (self.pos.db.wallet_journal){
                paymentlines.forEach(function(line){
                    if(line.cashregister.journal.id == self.pos.db.wallet_journal.id){
                        line_amount += line.amount;
                    }
                });
            }
            var remianing_amount = self.get_client().wallet_credits - line_amount

            return remianing_amount.toFixed(2)

        }
    });

});

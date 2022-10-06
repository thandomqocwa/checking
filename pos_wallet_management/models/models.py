# -*- coding: utf-8 -*-
#################################################################################
#
#   Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>)
#   See LICENSE file for full copyright and licensing details.
#   License URL : <https://store.webkul.com/license.html/>
#
#################################################################################

from odoo import api, fields, models, _
import functools
from odoo.exceptions import UserError, ValidationError
import logging
_logger = logging.getLogger(__name__)

class PosWallet(models.Model):
	_name = 'pos.wallet'
	_order = "id desc"

	name = fields.Char(string="Name",default="New",readonly=1)
	partner_id = fields.Many2one(comodel_name='res.partner', string="Partner", required=True)
	created_by = fields.Many2one(comodel_name='res.users', string="Created Date",)
	create_date = fields.Datetime('Creation Date', default=fields.Datetime.now)
	amount = fields.Float("Amount", compute='_total_credit_points_available')
	state = fields.Selection(string='State', selection=[('draft', 'Draft'),('confirm', 'Confirm'),('cancel', 'Cancel')] ,default='draft' , required=1)
	pos_wallet_trans_id = fields.One2many('pos.wallet.transaction', 'wallet_id', string="Wallet Transactions", readonly=1)
	reason = fields.Text(string="Wallet Cancellation Reason",readonly=1)

	@api.model
	def _total_credit_points_available(self):
		for self_obj in self:
			amount = 0.0
			credit_type_trans = self_obj.pos_wallet_trans_id.search([('wallet_id','=',self_obj.id),('partner_id','=',self_obj.partner_id.id),('payment_type','=','CREDIT'),('state','=','confirm')]).mapped('amount')
			debit_type_trans = self_obj.pos_wallet_trans_id.search([('wallet_id','=',self_obj.id),('partner_id','=',self_obj.partner_id.id),('payment_type','=','DEBIT'),('state','=','confirm')]).mapped('amount')
			if credit_type_trans:
				amount = amount + functools.reduce(lambda x,y : x+y,credit_type_trans)
			if debit_type_trans:
				amount = amount - functools.reduce(lambda x,y : x+y,debit_type_trans)
			_logger.info('-wallet---%r',(self_obj.partner_id.property_product_pricelist,self_obj.partner_id.property_product_pricelist.currency_id))
			if self_obj.partner_id.property_product_pricelist:
				self_obj.amount = self_obj.partner_id.property_product_pricelist.currency_id.round(amount)
			else:
				self_obj.amount = amount



	@api.model
	def create_wallet_by_rpc(self,data):
		wallet = self.create(data)
		if wallet:
			wallet.confirm_wallet()
			wallet_details ={
				'amount': 0,
				'id': wallet.id,
				'name':wallet.name
			}
			return wallet_details


	def confirm_wallet(self):
		wallet_ids = self.search([('state','=','confirm'),('partner_id','=',self.partner_id.id)])
		if len(wallet_ids):
				raise ValidationError("Customer already have wallet, You can not create two wallet for same customer")
		if self.name == 'New':
			self.name = self.env['ir.sequence'].next_by_code('pos.wallet')
		self.partner_id.wallet_id = self.id
		self.state = 'confirm'


	def unlink(self):
		for obj in self:
			if obj.state in ['confirm','cancel']:
				raise ValidationError("This operation is not permitted !!!")
		return super(PosWallet, self).unlink()


	@api.constrains('partner_id')
	def validate_partner(self):
		if self.partner_id:
			wallet_ids = self.search([('state','=','confirm'),('partner_id','=',self.partner_id.id)])
			if len(wallet_ids):
				raise ValidationError("Customer already have wallet, You can not create two wallet for same customer")

	@api.model
	def create_demo_data(self):
		wallet_obj = self.search([])
		if wallet_obj:
			wallet_obj[0].confirm_wallet()
		pos_config = self.env['pos.config'].search([])
		pos_payment_method = self.env['pos.payment.method']
		if pos_config:
			pos_config = pos_config[0]
			ctx = dict(self.env.context, company_id=pos_config.company_id.id)
			cash_journal = self.env['account.journal'].with_context(ctx).search([('type', '=', 'cash')])
			wallet_method = pos_payment_method.with_context(ctx).search([('name','=','Wallet'),('is_cash_count', '=', True)])
			if cash_journal:
				if wallet_method:
					wallet_method.write({'wallet_method':True})
				else:
					wallet_method = pos_payment_method.with_context(ctx).create({'name':'Wallet','is_cash_count':True,'wallet_method':True,'cash_journal_id':cash_journal[0].id})
				if pos_config.payment_method_ids:
					wallet_method.write({'wallet_method':True})
					if not wallet_method.id in pos_config.payment_method_ids.ids:
						pos_config.sudo().write({'payment_method_ids':[(4,wallet_method.id)]})

class ResPartner(models.Model):
	_inherit = 'res.partner'

	wallet_id = fields.Many2one(comodel_name="pos.wallet", string="Wallet")
	wallet_credits = fields.Float("Credits", related='wallet_id.amount')
	wallet_counts = fields.Integer(compute='_compute_wallet_counts', string="Wallets")


	def _compute_wallet_counts(self):
		wallet_data = self.env['pos.wallet'].read_group([('partner_id', 'in', self.ids),('state','=','confirm')], ['partner_id'], ['partner_id'])
		mapped_data = dict([(wallet['partner_id'][0], wallet['partner_id_count']) for wallet in wallet_data])
		for partner in self:
			partner.wallet_counts = mapped_data.get(partner.id, 0)


	def action_customer_wallet(self):
		context = self._context
		Wallet = self.env['pos.wallet'].search([('partner_id','in', self.ids),('state','=','confirm')])
		if not Wallet:
			tree_view_action = self.env.ref('pos_wallet_management.pos_wallet_action_window').read()[0]
			tree_view_action['context'] = {'search_default_partner_id':context.get('active_id', False),'partner_id': context.get('active_id', False) }
			return tree_view_action
		return {
		'name': _('POS Wallet'),
		'view_type': 'form',
		'view_mode': 'form',
		'view_id': self.env.ref('pos_wallet_management.pos_wallet_form').id,
		'res_model': 'pos.wallet',
		'type': 'ir.actions.act_window',
		'nodestroy': True,
		'target': 'current',
		'res_id': Wallet and Wallet.ids[0] or False,
		}

class PosWalletTranscation(models.Model):
	_name = 'pos.wallet.transaction'
	_order = "id desc"

	name =fields.Char(related='pos_order_id.name',string="Name")
	wallet_id = fields.Many2one(comodel_name="pos.wallet", string="Related Wallet", readonly=1)
	partner_id = fields.Many2one(comodel_name='res.partner', string="Partner", required=True)
	created_by = fields.Many2one(comodel_name='res.users', string="Salesman")
	amount = fields.Float("Amount", required=1)
	pos_order_id = fields.Many2one(string="POS Order", comodel_name="pos.order")
	payment_type = fields.Selection(string='Type',selection=[('CREDIT','CREDIT'),('DEBIT','DEBIT')],default='CREDIT', required=1)
	state = fields.Selection(string='State', selection=[('draft', 'Draft'),('confirm', 'Confirm'),('cancel', 'Cancel')] ,related="wallet_id.state")
	create_date = fields.Datetime('Date', default=fields.Datetime.now)
	trans_reason = fields.Text(string='Transaction Reason', required=1)


	def unlink(self):
		for obj in self:
			if obj.state in ['confirm','cancel']:
				raise ValidationError("This operation is not permitted !!!")
		return super(PosWalletTranscation, self).unlink()

class PosOrder(models.Model):
	_inherit = "pos.order"

	@api.model
	def create_from_ui(self, orders,draft = False):
		order_ids = super(PosOrder,self).create_from_ui(orders,draft)
		wallet_method = self.env['pos.payment.method'].search([('wallet_method','=',True)])
		if(wallet_method):
			for index,order in enumerate(orders):
				order_data = order.get('data')
				pos_order = self.env['pos.order'].search([('pos_reference','=', order_data.get('name'))])
				if order_data and order_data.get('partner_id') and pos_order:
					currency = pos_order.pricelist_id.currency_id
					wallet_trans_data = order_data.get('wallet_recharge_data')
					if(wallet_trans_data and wallet_trans_data.get('wallet_product_id')):
						wallet_id = self.env['pos.wallet'].search([('id','=',wallet_trans_data.get('wallet_id')),('state','=','confirm')])
						amount = 0.0
						if(wallet_id):
							subtotal_list = pos_order.lines.filtered(lambda line: line.product_id.id == wallet_trans_data.get('wallet_product_id')).mapped('price_subtotal_incl')
							if len(subtotal_list):
								sub_total = functools.reduce(lambda x,y : x+y,subtotal_list)
								wallet_trans_data['amount'] = currency.round(sub_total)
								wallet_trans_data['pos_order_id'] = pos_order.id
								del wallet_trans_data['wallet_product_id']
								self.env['pos.wallet.transaction'].create(wallet_trans_data)

					else:
						wallet_id = self.env['pos.wallet'].search([('partner_id','=',order_data.get('partner_id')),('state','=','confirm')])
						if wallet_id and pos_order:
							for payment in order_data.get('statement_ids'):
								if payment[2].get('payment_method_id') == wallet_method.id:
										wk_wallet_trans_data = {
											'amount':payment[2].get('amount'),
											'trans_reason':'Use Wallet Money',
											'created_by':order_data.get('user_id'),
											'partner_id':order_data.get('partner_id'),
											'wallet_id':wallet_id.id,
											'payment_type':'DEBIT',
											'pos_order_id': pos_order.id,
											'state':'confirm'
										}
										self.env['pos.wallet.transaction'].create(wk_wallet_trans_data)

		return order_ids

class AccountJournal(models.Model):
	_inherit = 'pos.payment.method'

	wallet_method = fields.Boolean("Allow Payments Via Wallet")


	@api.constrains('wallet_method')
	def validate_duplicacy_in_wallet_method(self):
		journal_id = self.search([('wallet_method','=',True)])
		if len(journal_id) >1 and self.wallet_method == True:
			raise ValidationError("Payment method for wallet is already exist. You can't create two payment method for wallet")

class PosConfig(models.Model):
	_inherit = "pos.config"

	show_wallet_type = fields.Selection([('checkbox','CHECKBOX-SLIDER'),('payment_method','WALLET PAYMENT METHOD')],string="Payment Screen View (Wallet Button)", default="checkbox", required=1)

# -*- coding: utf-8 -*-
#################################################################################
#
#   Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>)
#   See LICENSE file for full copyright and licensing details.
#   License URL : <https://store.webkul.com/license.html/>
# 
#################################################################################

from odoo import models, api, fields, _
from odoo.exceptions import UserError

class PosWalletCancellation(models.TransientModel):
    _name = 'pos.wallet.cancellation'
    _description = 'POS Wallet Cancellation'

    cancel_reason = fields.Text('Cancellation Reason',required="1")
   
    def cancel_wallet(self):
        self.ensure_one()
        wallet =self.env['pos.wallet'].browse(self.env.context.get('active_id', False))
        if wallet:
            wallet.state = 'cancel'
            wallet.reason = self.cancel_reason
            wallet.partner_id.wallet_id = None

   

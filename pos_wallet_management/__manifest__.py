# -*- coding: utf-8 -*-
#################################################################################
# Author      : Webkul Software Pvt. Ltd. (<https://webkul.com/>)
# Copyright(c): 2015-Present Webkul Software Pvt. Ltd.
# All Rights Reserved.
#
#
#
# This program is copyright property of the author mentioned above.
# You can`t redistribute it and/or modify it.
#
#
# You should have received a copy of the License along with this program.
# If not, see <https://store.webkul.com/license.html/>
#################################################################################
{
  "name"                 :  "POS Wallet Management",
  "summary"              :  """Introducing Odoo POS wallets for quick and easy payments. The customers can have the money added into their wallet and use it to quickly pay for their orders.""",
  "category"             :  "Point of Sale",
  "version"              :  "1.0.1",
  "sequence"             :  1,
  "author"               :  "Webkul Software Pvt. Ltd.",
  "license"              :  "Other proprietary",
  "website"              :  "https://store.webkul.com/Odoo-POS-Wallet-Management.html",
  "description"          :  """Odoo POS Wallet Management
POS customer credit
POS e-wallet
Customer wallet POS
Pay from POs wallet""",
  "live_test_url"        :  "http://odoodemo.webkul.com/?module=pos_wallet_management&custom_url=/pos/auto",
  "depends"              :  [
                             'point_of_sale',
                             'sale',
                            ],
  "data"                 :  [
                             'security/ir.model.access.csv',
                             'wizard/pos_wallet_cancellation.xml',
                             'views/demo_product.xml',
                             'views/pos_wallet_management_view.xml',
                             'views/wallet_sequence_view.xml',
    #                         'views/template.xml',
                            ],
  "demo"                 :  ['data/pos_wallet_data.xml'],
  #"qweb"                 :  ['static/src/xml/pos_wallet_management.xml'],
  "assets"               : {

                			'point_of_sale.assets':
                					 ['pos_wallet_management/static/src/js/main.js',
                                      'pos_wallet_management/static/src/css/pos_wallet_management.css'
                						],
                			'web.assets_qweb': [
                				    'pos_wallet_management/static/src/xml/**/*',
                				],

                						    },
  "images"               :  ['static/description/Banner.png'],
  "application"          :  True,
  "installable"          :  True,
  "auto_install"         :  False,
  "price"                :  169,
  "currency"             :  "USD",
  "pre_init_hook"        :  "pre_init_check",
}

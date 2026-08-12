# BuildBot for WooCommerce

1. In BuildBot dashboard → **Store & Sync** → choose WooCommerce → **Generate secret**.
2. Upload this plugin folder to `wp-content/plugins/buildbot-woocommerce/`.
3. Edit `buildbot-woocommerce.php` and set `BUILDBOT_API_BASE` to your API URL.
4. Activate the plugin → WooCommerce → BuildBot → enter Store ID + secret → **Test connection** → **Sync products now**.

The plugin injects `widget.js` on the storefront and syncs every 6 hours.

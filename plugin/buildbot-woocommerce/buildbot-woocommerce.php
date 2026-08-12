<?php
/**
 * Plugin Name: BuildBot for WooCommerce
 * Description: Syncs your WooCommerce catalog to BuildBot and injects the PC builder widget.
 * Version: 1.0.0
 * Author: BuildBot
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * IMPORTANT: Set this to your BuildBot API base URL (no trailing slash).
 * Local: http://127.0.0.1:3001
 * Production: https://YOUR-RAILWAY-HOST (set during Phase 12 deploy)
 */
if (!defined('BUILDBOT_API_BASE')) {
    define('BUILDBOT_API_BASE', 'http://127.0.0.1:3001');
}

define('BUILDBOT_PLUGIN_VERSION', '1.0.0');
define('BUILDBOT_OPTION_STORE_ID', 'buildbot_store_id');
define('BUILDBOT_OPTION_SECRET', 'buildbot_plugin_secret');
define('BUILDBOT_OPTION_WIDGET', 'buildbot_widget_enabled');

class BuildBot_WooCommerce {
    public function __construct() {
        add_action('admin_menu', [$this, 'admin_menu']);
        add_action('admin_init', [$this, 'register_settings']);
        add_action('wp_footer', [$this, 'inject_widget'], 99);

        add_action('woocommerce_update_product', [$this, 'on_product_save'], 20, 1);
        add_action('woocommerce_new_product', [$this, 'on_product_save'], 20, 1);
        add_action('before_delete_post', [$this, 'on_product_delete'], 10, 1);

        add_action('buildbot_auto_sync', [$this, 'cron_sync']);
        if (!wp_next_scheduled('buildbot_auto_sync')) {
            wp_schedule_event(time() + HOUR_IN_SECONDS, 'twicedaily', 'buildbot_auto_sync');
        }

        // Custom 6-hour schedule
        add_filter('cron_schedules', function ($schedules) {
            $schedules['buildbot_six_hours'] = [
                'interval' => 6 * HOUR_IN_SECONDS,
                'display'  => 'Every 6 hours (BuildBot)',
            ];
            return $schedules;
        });
        if (!wp_next_scheduled('buildbot_six_hour_sync')) {
            wp_schedule_event(time() + HOUR_IN_SECONDS, 'buildbot_six_hours', 'buildbot_six_hour_sync');
        }
        add_action('buildbot_six_hour_sync', [$this, 'cron_sync']);
    }

    public function admin_menu() {
        add_submenu_page(
            'woocommerce',
            'BuildBot',
            'BuildBot',
            'manage_woocommerce',
            'buildbot',
            [$this, 'render_settings']
        );
    }

    public function register_settings() {
        register_setting('buildbot_settings', BUILDBOT_OPTION_STORE_ID);
        register_setting('buildbot_settings', BUILDBOT_OPTION_SECRET);
        register_setting('buildbot_settings', BUILDBOT_OPTION_WIDGET);
    }

    private function credentials_ok() {
        return get_option(BUILDBOT_OPTION_STORE_ID) && get_option(BUILDBOT_OPTION_SECRET);
    }

    private function api_request($path, $body = null, $method = 'POST') {
        $url = rtrim(BUILDBOT_API_BASE, '/') . $path;
        $args = [
            'method'  => $method,
            'timeout' => 60,
            'headers' => [
                'Content-Type'         => 'application/json',
                'X-BuildBot-Store-ID'  => get_option(BUILDBOT_OPTION_STORE_ID),
                'X-BuildBot-Secret'    => get_option(BUILDBOT_OPTION_SECRET),
            ],
        ];
        if ($body !== null) {
            $args['body'] = wp_json_encode($body);
        }
        $res = wp_remote_request($url, $args);
        if (is_wp_error($res)) {
            return ['success' => false, 'error' => $res->get_error_message()];
        }
        $code = wp_remote_retrieve_response_code($res);
        $data = json_decode(wp_remote_retrieve_body($res), true);
        if (!is_array($data)) {
            $data = ['success' => false, 'error' => 'Invalid API response', 'http' => $code];
        }
        $data['http'] = $code;
        return $data;
    }

    private function map_product($product) {
        if (!$product instanceof WC_Product) {
            return null;
        }
        $cats = [];
        $terms = get_the_terms($product->get_id(), 'product_cat');
        if (is_array($terms)) {
            foreach ($terms as $t) {
                $cats[] = $t->name;
            }
        }
        return [
            'id'             => (string) $product->get_id(),
            'wooProductId'   => (string) $product->get_id(),
            'name'           => $product->get_name(),
            'price'          => (float) $product->get_price(),
            'sku'            => $product->get_sku(),
            'stock'          => $product->is_in_stock(),
            'stock_status'   => $product->get_stock_status(),
            'description'    => wp_strip_all_tags($product->get_short_description() ?: $product->get_description()),
            'categories'     => $cats,
        ];
    }

    private function collect_all_products() {
        $out = [];
        $page = 1;
        do {
            $q = new WP_Query([
                'post_type'      => 'product',
                'post_status'    => 'publish',
                'posts_per_page' => 100,
                'paged'          => $page,
                'fields'         => 'ids',
            ]);
            foreach ($q->posts as $id) {
                $p = wc_get_product($id);
                $mapped = $this->map_product($p);
                if ($mapped) {
                    $out[] = $mapped;
                }
            }
            $page++;
        } while ($page <= $q->max_num_pages);
        return $out;
    }

    public function render_settings() {
        if (!current_user_can('manage_woocommerce')) {
            return;
        }

        $notice = '';
        if (isset($_POST['buildbot_ping']) && check_admin_referer('buildbot_actions')) {
            $notice = $this->api_request('/api/plugin/ping', new stdClass());
        }
        if (isset($_POST['buildbot_sync']) && check_admin_referer('buildbot_actions')) {
            $products = $this->collect_all_products();
            $notice = $this->api_request('/api/plugin/sync', ['products' => $products]);
        }
        if (isset($_POST['buildbot_status']) && check_admin_referer('buildbot_actions')) {
            $notice = $this->api_request('/api/plugin/connection-status', new stdClass());
        }
        if (isset($_POST['buildbot_toggle']) && check_admin_referer('buildbot_actions')) {
            $enabled = !empty($_POST['widget_on']);
            update_option(BUILDBOT_OPTION_WIDGET, $enabled ? '1' : '0');
            $notice = $this->api_request('/api/plugin/widget-toggle', ['enabled' => $enabled]);
        }

        $store_id = esc_attr(get_option(BUILDBOT_OPTION_STORE_ID, ''));
        $secret   = esc_attr(get_option(BUILDBOT_OPTION_SECRET, ''));
        $widget   = get_option(BUILDBOT_OPTION_WIDGET, '1') === '1';
        ?>
        <div class="wrap">
            <h1>BuildBot for WooCommerce</h1>
            <p>API: <code><?php echo esc_html(BUILDBOT_API_BASE); ?></code> (change <code>BUILDBOT_API_BASE</code> in the plugin PHP file for production)</p>

            <?php if (is_array($notice)) : ?>
                <div class="notice notice-<?php echo !empty($notice['success']) ? 'success' : 'error'; ?>">
                    <p><strong><?php echo esc_html(!empty($notice['success']) ? 'OK' : 'Error'); ?>:</strong>
                    <?php echo esc_html($notice['message'] ?? $notice['error'] ?? wp_json_encode($notice)); ?></p>
                </div>
            <?php endif; ?>

            <form method="post" action="options.php">
                <?php settings_fields('buildbot_settings'); ?>
                <table class="form-table">
                    <tr>
                        <th><label for="buildbot_store_id">Store ID</label></th>
                        <td><input name="<?php echo esc_attr(BUILDBOT_OPTION_STORE_ID); ?>" id="buildbot_store_id" type="text" class="regular-text" value="<?php echo $store_id; ?>" /></td>
                    </tr>
                    <tr>
                        <th><label for="buildbot_secret">Plugin secret</label></th>
                        <td><input name="<?php echo esc_attr(BUILDBOT_OPTION_SECRET); ?>" id="buildbot_secret" type="password" class="regular-text" value="<?php echo $secret; ?>" autocomplete="off" /></td>
                    </tr>
                    <tr>
                        <th>Inject widget</th>
                        <td>
                            <label>
                                <input type="checkbox" name="<?php echo esc_attr(BUILDBOT_OPTION_WIDGET); ?>" value="1" <?php checked($widget); ?> />
                                Show BuildBot widget on the storefront
                            </label>
                        </td>
                    </tr>
                </table>
                <?php submit_button('Save settings'); ?>
            </form>

            <form method="post">
                <?php wp_nonce_field('buildbot_actions'); ?>
                <p>
                    <button type="submit" name="buildbot_ping" class="button button-primary">Test connection</button>
                    <button type="submit" name="buildbot_sync" class="button">Sync products now</button>
                    <button type="submit" name="buildbot_status" class="button">Connection status</button>
                </p>
                <p>
                    <label>
                        <input type="checkbox" name="widget_on" value="1" <?php checked($widget); ?> />
                        Widget enabled (push to BuildBot)
                    </label>
                    <button type="submit" name="buildbot_toggle" class="button">Update widget toggle</button>
                </p>
            </form>
        </div>
        <?php
    }

    public function inject_widget() {
        if (is_admin() || !$this->credentials_ok()) {
            return;
        }
        if (get_option(BUILDBOT_OPTION_WIDGET, '1') !== '1') {
            return;
        }
        $store_id = esc_attr(get_option(BUILDBOT_OPTION_STORE_ID));
        $src = esc_url(rtrim(BUILDBOT_API_BASE, '/') . '/widget.js');
        echo "\n<script src=\"{$src}\" data-store-id=\"{$store_id}\"></script>\n";
    }

    public function on_product_save($product_id) {
        if (!$this->credentials_ok()) {
            return;
        }
        $product = wc_get_product($product_id);
        $mapped = $this->map_product($product);
        if (!$mapped) {
            return;
        }
        $this->api_request('/api/plugin/product/update', $mapped);
    }

    public function on_product_delete($post_id) {
        if (get_post_type($post_id) !== 'product' || !$this->credentials_ok()) {
            return;
        }
        $this->api_request('/api/plugin/product/delete', [
            'wooProductId' => (string) $post_id,
        ]);
    }

    public function cron_sync() {
        if (!$this->credentials_ok()) {
            return;
        }
        $products = $this->collect_all_products();
        $this->api_request('/api/plugin/sync', ['products' => $products]);
    }
}

add_action('plugins_loaded', function () {
    if (!class_exists('WooCommerce')) {
        return;
    }
    new BuildBot_WooCommerce();
});

register_deactivation_hook(__FILE__, function () {
    wp_clear_scheduled_hook('buildbot_auto_sync');
    wp_clear_scheduled_hook('buildbot_six_hour_sync');
});

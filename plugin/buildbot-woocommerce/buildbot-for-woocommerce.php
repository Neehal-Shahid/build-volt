<?php
/**
 * Plugin Name:  BuildBot for WooCommerce
 * Plugin URI:   https://app.buildvolt.online
 * Description:  Connect your WooCommerce PC-parts store to BuildBot — sync your catalog and embed the AI recommendation widget in minutes.
 * Version:      1.2.0
 * Author:       BuildBot
 * Author URI:   https://app.buildvolt.online
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 * License:      Commercial
 *
 * @package BuildBot
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* ── API base — patched at build time by the BuildBot server build script ──── */
if ( ! defined( 'BUILDBOT_API_BASE' ) ) {
	define( 'BUILDBOT_API_BASE', 'https://build-volt-production.up.railway.app' );
}

define( 'BUILDBOT_VERSION', '1.2.0' );

/* ── Option keys ─────────────────────────────────────────────────────────── */
define( 'BB_STORE_ID',    'buildbot_store_id' );
define( 'BB_SECRET',      'buildbot_plugin_secret' );
define( 'BB_API_BASE',    'buildbot_api_base' );
define( 'BB_WIDGET',      'buildbot_widget_enabled' );
define( 'BB_WIDGET_POS',  'buildbot_widget_position' );  // all | shop | product
define( 'BB_AUTO_SYNC',   'buildbot_auto_sync' );
define( 'BB_SYNC_LOG',    'buildbot_sync_log' );

/* ═══════════════════════════════════════════════════════════════════════════
   Main plugin class
   ═══════════════════════════════════════════════════════════════════════════ */
class BuildBot_WooCommerce {

	/* ── Constructor ──────────────────────────────────────────────────────── */
	public function __construct() {
		// Admin
		add_action( 'admin_menu',    array( $this, 'admin_menu' ) );
		add_action( 'admin_init',    array( $this, 'register_settings' ) );
		add_action( 'admin_notices', array( $this, 'admin_notices' ) );

		// Widget injection
		add_action( 'wp_footer', array( $this, 'inject_widget' ), 99 );

		// Product event hooks
		add_action( 'woocommerce_update_product', array( $this, 'on_product_save' ), 20, 1 );
		add_action( 'woocommerce_new_product',    array( $this, 'on_product_save' ), 20, 1 );
		add_action( 'before_delete_post',         array( $this, 'on_product_delete' ), 10, 1 );
		add_action( 'woocommerce_trash_product',  array( $this, 'on_product_delete' ), 10, 1 );

		// Single cron job
		add_filter( 'cron_schedules', array( $this, 'cron_schedules' ) );
		add_action( 'buildbot_auto_sync', array( $this, 'cron_sync' ) );
		if ( get_option( BB_AUTO_SYNC, '1' ) === '1' && ! wp_next_scheduled( 'buildbot_auto_sync' ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'buildbot_6h', 'buildbot_auto_sync' );
		}
	}

	/* ── Cron schedule ────────────────────────────────────────────────────── */
	public function cron_schedules( $schedules ) {
		$schedules['buildbot_6h'] = array(
			'interval' => 6 * HOUR_IN_SECONDS,
			'display'  => 'Every 6 hours (BuildBot)',
		);
		return $schedules;
	}

	/* ── Admin menu ───────────────────────────────────────────────────────── */
	public function admin_menu() {
		add_submenu_page(
			'woocommerce',
			'BuildBot — AI PC Build Recommender',
			'BuildBot',
			'manage_woocommerce',
			'buildbot',
			array( $this, 'render_page' )
		);
	}

	/* ── Register settings (sanitized) ───────────────────────────────────── */
	public function register_settings() {
		register_setting( 'buildbot_grp', BB_STORE_ID,   array( 'sanitize_callback' => 'sanitize_text_field' ) );
		register_setting( 'buildbot_grp', BB_SECRET,     array( 'sanitize_callback' => 'sanitize_text_field' ) );
		register_setting( 'buildbot_grp', BB_API_BASE,   array( 'sanitize_callback' => 'esc_url_raw' ) );
		register_setting( 'buildbot_grp', BB_WIDGET,     array( 'sanitize_callback' => 'sanitize_text_field' ) );
		register_setting( 'buildbot_grp', BB_WIDGET_POS, array( 'sanitize_callback' => 'sanitize_key' ) );
		register_setting( 'buildbot_grp', BB_AUTO_SYNC,  array( 'sanitize_callback' => 'sanitize_text_field' ) );
	}

	/* ── Admin notice when not connected ──────────────────────────────────── */
	public function admin_notices() {
		$screen = get_current_screen();
		if ( ! $screen || strpos( $screen->id, 'buildbot' ) === false ) {
			return;
		}
		if ( ! $this->credentials_ok() ) {
			$url = admin_url( 'admin.php?page=buildbot&tab=connection' );
			echo '<div class="notice notice-warning is-dismissible"><p>'
				. '<strong>BuildBot:</strong> Plugin is not connected. '
				. '<a href="' . esc_url( $url ) . '">Enter your Store ID and Plugin Secret →</a>'
				. '</p></div>';
		}
	}

	/* ── Helpers ──────────────────────────────────────────────────────────── */
	private function credentials_ok() {
		return ! empty( get_option( BB_STORE_ID ) ) && ! empty( get_option( BB_SECRET ) );
	}

	private function api_base() {
		$opt = trim( get_option( BB_API_BASE, '' ) );
		return rtrim( $opt ?: BUILDBOT_API_BASE, '/' );
	}

	private function api_request( $path, $body = null, $method = 'POST' ) {
		$url  = $this->api_base() . $path;
		$args = array(
			'method'  => $method,
			'timeout' => 60,
			'headers' => array(
				'Content-Type'        => 'application/json',
				'X-BuildBot-Store-ID' => get_option( BB_STORE_ID, '' ),
				'X-BuildBot-Secret'   => get_option( BB_SECRET, '' ),
			),
		);
		if ( null !== $body ) {
			$args['body'] = wp_json_encode( $body );
		}

		$t0  = microtime( true );
		$res = wp_remote_request( $url, $args );
		$ms  = (int) round( ( microtime( true ) - $t0 ) * 1000 );

		if ( is_wp_error( $res ) ) {
			return array( 'success' => false, 'error' => $res->get_error_message(), 'ms' => $ms );
		}
		$code = wp_remote_retrieve_response_code( $res );
		$data = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( ! is_array( $data ) ) {
			$data = array( 'success' => false, 'error' => 'Invalid API response (HTTP ' . $code . ')' );
		}
		$data['http'] = $code;
		$data['ms']   = $ms;
		return $data;
	}

	/* ── Product mapping ──────────────────────────────────────────────────── */
	private function map_product( $product ) {
		if ( ! $product instanceof WC_Product ) {
			return null;
		}

		// Variable products → use minimum variation price
		$price = (float) $product->get_price();
		if ( $product instanceof WC_Product_Variable ) {
			$prices = $product->get_variation_prices( true );
			if ( ! empty( $prices['price'] ) ) {
				$price = (float) min( $prices['price'] );
			}
		}

		// Skip unpriceable products
		if ( $price <= 0 ) {
			return null;
		}

		// Prefer root-level WooCommerce categories
		$cats  = array();
		$terms = get_the_terms( $product->get_id(), 'product_cat' );
		if ( is_array( $terms ) ) {
			foreach ( $terms as $t ) {
				if ( $t->parent === 0 ) {
					$cats[] = $t->name;
				}
			}
			if ( empty( $cats ) ) {
				// No root category — take any
				foreach ( $terms as $t ) {
					$cats[] = $t->name;
				}
			}
		}

		return array(
			'id'           => (string) $product->get_id(),
			'wooProductId' => (string) $product->get_id(),
			'name'         => $product->get_name(),
			'price'        => $price,
			'sku'          => $product->get_sku(),
			'stock'        => $product->is_in_stock(),
			'stock_status' => $product->get_stock_status(),
			'description'  => wp_strip_all_tags( $product->get_short_description() ?: $product->get_description() ),
			'categories'   => $cats,
		);
	}

	/* ── Collect all published products ───────────────────────────────────── */
	private function collect_all_products() {
		$out  = array();
		$page = 1;
		do {
			$q = new WP_Query( array(
				'post_type'      => 'product',
				'post_status'    => 'publish',
				'posts_per_page' => 100,
				'paged'          => $page,
				'fields'         => 'ids',
			) );
			foreach ( $q->posts as $id ) {
				$mapped = $this->map_product( wc_get_product( $id ) );
				if ( $mapped ) {
					$out[] = $mapped;
				}
			}
			$page++;
		} while ( $page <= $q->max_num_pages );
		return $out;
	}

	/* ── Sync log ─────────────────────────────────────────────────────────── */
	private function save_sync_log( $entry ) {
		$log = get_option( BB_SYNC_LOG, array() );
		if ( ! is_array( $log ) ) {
			$log = array();
		}
		array_unshift( $log, $entry );
		update_option( BB_SYNC_LOG, array_slice( $log, 0, 10 ) );
	}

	/* ── Full sync ────────────────────────────────────────────────────────── */
	private function do_sync( $trigger = 'manual' ) {
		$products = $this->collect_all_products();
		$result   = $this->api_request( '/api/plugin/sync', array( 'products' => $products ) );
		$this->save_sync_log( array(
			'time'     => current_time( 'Y-m-d H:i:s' ),
			'trigger'  => $trigger,
			'count'    => count( $products ),
			'imported' => isset( $result['imported'] ) ? (int) $result['imported'] : 0,
			'success'  => ! empty( $result['success'] ),
			'error'    => isset( $result['error'] ) ? $result['error'] : null,
			'ms'       => isset( $result['ms'] ) ? $result['ms'] : 0,
		) );
		return $result;
	}

	/* ── Widget injection ─────────────────────────────────────────────────── */
	public function inject_widget() {
		if ( is_admin() || ! $this->credentials_ok() ) {
			return;
		}
		if ( get_option( BB_WIDGET, '1' ) !== '1' ) {
			return;
		}

		// Position filter
		$pos = get_option( BB_WIDGET_POS, 'all' );
		if ( $pos === 'shop' && ! is_shop() && ! is_product_category() ) {
			return;
		}
		if ( $pos === 'product' && ! is_product() ) {
			return;
		}

		$store_id = esc_attr( get_option( BB_STORE_ID ) );
		$src      = esc_url( $this->api_base() . '/widget.js' );
		echo "\n<!-- BuildBot AI Widget v" . esc_html( BUILDBOT_VERSION ) . " -->\n";
		echo "<script src=\"{$src}\" data-store-id=\"{$store_id}\" async></script>\n";
	}

	/* ── Product event hooks ──────────────────────────────────────────────── */
	public function on_product_save( $product_id ) {
		if ( ! $this->credentials_ok() ) {
			return;
		}
		if ( wp_is_post_revision( $product_id ) || wp_is_post_autosave( $product_id ) ) {
			return;
		}
		$mapped = $this->map_product( wc_get_product( $product_id ) );
		if ( ! $mapped ) {
			return;
		}
		$this->api_request( '/api/plugin/product/update', $mapped );
	}

	public function on_product_delete( $post_id ) {
		if ( get_post_type( $post_id ) !== 'product' || ! $this->credentials_ok() ) {
			return;
		}
		$this->api_request( '/api/plugin/product/delete', array(
			'wooProductId' => (string) $post_id,
		) );
	}

	public function cron_sync() {
		if ( ! $this->credentials_ok() ) {
			return;
		}
		$this->do_sync( 'auto' );
	}

	/* ══════════════════════════════════════════════════════════════════════
	   Admin page
	   ══════════════════════════════════════════════════════════════════════ */
	public function render_page() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}

		$tab         = sanitize_key( isset( $_GET['tab'] ) ? $_GET['tab'] : 'dashboard' );
		$notice      = null;
		$notice_type = 'success';

		/* Handle POST actions ─────────────────────────────────────────────── */
		if ( isset( $_POST['bb_action'] ) && check_admin_referer( 'buildbot_action', 'bb_nonce' ) ) {
			$action = sanitize_key( $_POST['bb_action'] );

			switch ( $action ) {

				case 'save_connection':
					$store_id = sanitize_text_field( isset( $_POST['bb_store_id'] ) ? $_POST['bb_store_id'] : '' );
					$secret   = sanitize_text_field( isset( $_POST['bb_secret'] )   ? $_POST['bb_secret']   : '' );
					$api_base = esc_url_raw( isset( $_POST['bb_api_base'] )          ? $_POST['bb_api_base'] : '' );
					if ( $store_id ) {
						update_option( BB_STORE_ID, $store_id );
					}
					// Only update secret if user typed something (not the masked placeholder)
					if ( $secret && strpos( $secret, '•' ) === false && strlen( $secret ) > 5 ) {
						update_option( BB_SECRET, $secret );
					}
					if ( $api_base ) {
						update_option( BB_API_BASE, $api_base );
					}
					$notice = '✓ Connection settings saved.';
					break;

				case 'test':
					$result = $this->api_request( '/api/plugin/ping', new stdClass() );
					if ( ! empty( $result['success'] ) ) {
						$name = isset( $result['storeName'] ) ? $result['storeName'] : '';
						$plan = isset( $result['plan'] ) ? $result['plan'] : '';
						$notice = '✓ Connected to BuildBot'
							. ( $name ? ' — store: ' . esc_html( $name ) : '' )
							. ( $plan ? ', plan: ' . esc_html( $plan ) : '' )
							. ' (' . (int) $result['ms'] . 'ms)';
					} else {
						$notice      = '✗ Connection failed: ' . esc_html( isset( $result['error'] ) ? $result['error'] : 'Unknown error' );
						$notice_type = 'error';
					}
					break;

				case 'sync':
					$result = $this->do_sync( 'manual' );
					if ( ! empty( $result['success'] ) ) {
						$count  = isset( $result['imported'] ) ? (int) $result['imported'] : 0;
						$ms     = isset( $result['ms'] ) ? (int) $result['ms'] : 0;
						$notice = "✓ Sync complete — {$count} products synced in {$ms}ms.";
					} else {
						$notice      = '✗ Sync failed: ' . esc_html( isset( $result['error'] ) ? $result['error'] : 'Unknown error' );
						$notice_type = 'error';
					}
					break;

				case 'status':
					$result = $this->api_request( '/api/plugin/connection-status', new stdClass() );
					if ( ! empty( $result['success'] ) ) {
						$count  = isset( $result['productCount'] ) ? (int) $result['productCount'] : 0;
						$plan   = isset( $result['plan'] ) ? esc_html( $result['plan'] ) : '?';
						$widget = ! empty( $result['widgetEnabled'] ) ? 'enabled' : 'disabled';
						$notice = "Status: {$count} products in BuildBot catalog, plan: {$plan}, widget: {$widget}.";
					} else {
						$notice      = '✗ Status check failed: ' . esc_html( isset( $result['error'] ) ? $result['error'] : '' );
						$notice_type = 'error';
					}
					break;

				case 'save_widget':
					$enabled = ! empty( $_POST['bb_widget_enabled'] ) ? '1' : '0';
					$pos     = sanitize_key( isset( $_POST['bb_widget_pos'] ) ? $_POST['bb_widget_pos'] : 'all' );
					if ( ! in_array( $pos, array( 'all', 'shop', 'product' ), true ) ) {
						$pos = 'all';
					}
					update_option( BB_WIDGET, $enabled );
					update_option( BB_WIDGET_POS, $pos );
					// Push toggle to BuildBot
					$this->api_request( '/api/plugin/widget-toggle', array( 'enabled' => $enabled === '1' ) );
					$notice = $enabled === '1' ? '✓ Widget enabled and saved.' : '✓ Widget disabled and saved.';
					break;

				case 'save_sync_settings':
					$auto = ! empty( $_POST['bb_auto_sync'] ) ? '1' : '0';
					update_option( BB_AUTO_SYNC, $auto );
					if ( $auto === '1' ) {
						if ( ! wp_next_scheduled( 'buildbot_auto_sync' ) ) {
							wp_schedule_event( time() + HOUR_IN_SECONDS, 'buildbot_6h', 'buildbot_auto_sync' );
						}
					} else {
						wp_clear_scheduled_hook( 'buildbot_auto_sync' );
					}
					$notice = '✓ Sync settings saved.';
					break;

				case 'clear_log':
					update_option( BB_SYNC_LOG, array() );
					$notice = '✓ Sync log cleared.';
					break;
			}
		}

		/* Render ─────────────────────────────────────────────────────────── */
		$this->render_styles();

		$connected = $this->credentials_ok();
		?>
		<div class="bb-wrap">

			<div class="bb-header">
				<div class="bb-header-brand">
					<div class="bb-logo">🤖</div>
					<div>
						<h1>BuildBot for WooCommerce</h1>
						<p>AI-powered PC build recommendations — v<?php echo esc_html( BUILDBOT_VERSION ); ?></p>
					</div>
				</div>
				<div class="bb-header-conn">
					<?php if ( $connected ) : ?>
						<span class="bb-status-dot bb-green"></span> Connected
					<?php else : ?>
						<span class="bb-status-dot bb-red"></span> Not connected
					<?php endif; ?>
				</div>
			</div>

			<?php if ( $notice ) : ?>
				<div class="bb-notice bb-notice-<?php echo esc_attr( $notice_type ); ?>">
					<?php echo esc_html( $notice ); ?>
				</div>
			<?php endif; ?>

			<nav class="bb-tabs">
				<?php
				$tabs_def = array(
					'dashboard'  => '📊 Dashboard',
					'connection' => '🔑 Connection',
					'widget'     => '⚡ Widget',
					'sync'       => '🔄 Sync',
					'help'       => '❓ Help',
				);
				foreach ( $tabs_def as $t_key => $t_label ) :
					$url     = admin_url( 'admin.php?page=buildbot&tab=' . $t_key );
					$is_active = ( $tab === $t_key );
					?>
					<a href="<?php echo esc_url( $url ); ?>"
					   class="bb-tab<?php echo $is_active ? ' bb-tab-active' : ''; ?>">
						<?php echo esc_html( $t_label ); ?>
					</a>
				<?php endforeach; ?>
			</nav>

			<div class="bb-body">
				<?php
				switch ( $tab ) {
					case 'connection': $this->tab_connection(); break;
					case 'widget':     $this->tab_widget(); break;
					case 'sync':       $this->tab_sync(); break;
					case 'help':       $this->tab_help(); break;
					default:           $this->tab_dashboard(); break;
				}
				?>
			</div>

		</div><!-- .bb-wrap -->
		<?php
	}

	/* ── Tab: Dashboard ───────────────────────────────────────────────────── */
	private function tab_dashboard() {
		$connected  = $this->credentials_ok();
		$store_id   = get_option( BB_STORE_ID, '' );
		$widget_on  = get_option( BB_WIDGET, '1' ) === '1';
		$widget_pos = get_option( BB_WIDGET_POS, 'all' );
		$auto_sync  = get_option( BB_AUTO_SYNC, '1' ) === '1';
		$log        = get_option( BB_SYNC_LOG, array() );
		$last_sync  = ! empty( $log[0] ) ? $log[0] : null;
		$next_cron  = wp_next_scheduled( 'buildbot_auto_sync' );

		$pos_labels = array(
			'all'     => 'All pages',
			'shop'    => 'Shop pages only',
			'product' => 'Product pages only',
		);
		?>
		<div class="bb-stat-row">

			<div class="bb-stat-card <?php echo $connected ? 'bb-stat-ok' : 'bb-stat-warn'; ?>">
				<div class="bb-stat-icon"><?php echo $connected ? '🟢' : '🔴'; ?></div>
				<div>
					<strong>Connection</strong>
					<span><?php echo $connected ? 'Connected to BuildBot' : 'Not connected'; ?></span>
					<?php if ( $connected && $store_id ) : ?>
						<code><?php echo esc_html( substr( $store_id, 0, 24 ) . ( strlen( $store_id ) > 24 ? '…' : '' ) ); ?></code>
					<?php endif; ?>
				</div>
			</div>

			<div class="bb-stat-card">
				<div class="bb-stat-icon">⚡</div>
				<div>
					<strong>Widget</strong>
					<span><?php echo $widget_on ? '<span class="bb-ok">Enabled</span>' : '<span class="bb-muted">Disabled</span>'; ?></span>
					<span class="bb-small"><?php echo esc_html( isset( $pos_labels[ $widget_pos ] ) ? $pos_labels[ $widget_pos ] : 'All pages' ); ?></span>
				</div>
			</div>

			<div class="bb-stat-card">
				<div class="bb-stat-icon">🔄</div>
				<div>
					<strong>Last Sync</strong>
					<?php if ( $last_sync ) : ?>
						<span><?php echo esc_html( $last_sync['time'] ); ?></span>
						<span class="bb-small">
							<?php echo esc_html( $last_sync['count'] ); ?> products —
							<?php if ( $last_sync['success'] ) : ?>
								<span class="bb-ok">✓ Success</span>
							<?php else : ?>
								<span class="bb-err">✗ Failed</span>
							<?php endif; ?>
						</span>
					<?php else : ?>
						<span class="bb-muted">Never synced</span>
					<?php endif; ?>
				</div>
			</div>

			<div class="bb-stat-card">
				<div class="bb-stat-icon">⏰</div>
				<div>
					<strong>Auto-Sync</strong>
					<span><?php echo $auto_sync ? '<span class="bb-ok">Every 6 hours</span>' : '<span class="bb-muted">Disabled</span>'; ?></span>
					<?php if ( $auto_sync && $next_cron ) : ?>
						<span class="bb-small">Next in <?php echo esc_html( human_time_diff( $next_cron ) ); ?></span>
					<?php endif; ?>
				</div>
			</div>

		</div>

		<div class="bb-section">
			<h2>Quick Actions</h2>
			<form method="post">
				<?php wp_nonce_field( 'buildbot_action', 'bb_nonce' ); ?>
				<div class="bb-action-row">
					<button type="submit" name="bb_action" value="test"
					        class="bb-btn bb-btn-primary"
					        <?php echo ! $connected ? 'disabled title="Connect first"' : ''; ?>>
						🔌 Test Connection
					</button>
					<button type="submit" name="bb_action" value="sync"
					        class="bb-btn bb-btn-primary"
					        <?php echo ! $connected ? 'disabled title="Connect first"' : ''; ?>>
						🔄 Sync Products Now
					</button>
					<button type="submit" name="bb_action" value="status"
					        class="bb-btn"
					        <?php echo ! $connected ? 'disabled title="Connect first"' : ''; ?>>
						📊 Check Remote Status
					</button>
					<a href="<?php echo esc_url( $this->api_base() . '/dashboard' ); ?>"
					   target="_blank" class="bb-btn">
						🚀 Open BuildBot Dashboard ↗
					</a>
				</div>
			</form>
			<?php if ( ! $connected ) : ?>
				<p class="bb-hint">⚠ Enter your credentials first. <a href="<?php echo esc_url( admin_url( 'admin.php?page=buildbot&tab=connection' ) ); ?>">Go to Connection tab →</a></p>
			<?php endif; ?>
		</div>

		<?php if ( ! empty( $log ) ) : ?>
		<div class="bb-section">
			<h2>Recent Sync History</h2>
			<table class="bb-table">
				<thead>
					<tr>
						<th>Time</th>
						<th>Trigger</th>
						<th>Products</th>
						<th>Imported</th>
						<th>Result</th>
						<th>Duration</th>
					</tr>
				</thead>
				<tbody>
					<?php foreach ( array_slice( $log, 0, 5 ) as $entry ) : ?>
						<tr>
							<td><?php echo esc_html( $entry['time'] ); ?></td>
							<td>
								<span class="bb-badge <?php echo $entry['trigger'] === 'manual' ? 'bb-badge-blue' : 'bb-badge-gray'; ?>">
									<?php echo esc_html( ucfirst( $entry['trigger'] ) ); ?>
								</span>
							</td>
							<td><?php echo esc_html( $entry['count'] ); ?></td>
							<td><?php echo esc_html( isset( $entry['imported'] ) ? $entry['imported'] : '—' ); ?></td>
							<td>
								<?php if ( $entry['success'] ) : ?>
									<span class="bb-ok">✓ OK</span>
								<?php else : ?>
									<span class="bb-err" title="<?php echo esc_attr( $entry['error'] ); ?>">✗ Failed</span>
								<?php endif; ?>
							</td>
							<td><?php echo esc_html( ( isset( $entry['ms'] ) ? $entry['ms'] : 0 ) . 'ms' ); ?></td>
						</tr>
					<?php endforeach; ?>
				</tbody>
			</table>
			<p class="bb-hint"><a href="<?php echo esc_url( admin_url( 'admin.php?page=buildbot&tab=sync' ) ); ?>">View full sync log →</a></p>
		</div>
		<?php endif; ?>
		<?php
	}

	/* ── Tab: Connection ──────────────────────────────────────────────────── */
	private function tab_connection() {
		$store_id = get_option( BB_STORE_ID, '' );
		$secret   = get_option( BB_SECRET, '' );
		$api_base = get_option( BB_API_BASE, '' );
		?>
		<div class="bb-section bb-section-highlight">
			<h2>📋 How to get your credentials</h2>
			<ol class="bb-steps">
				<li>Sign up or log in at <a href="<?php echo esc_url( $this->api_base() ); ?>" target="_blank"><?php echo esc_html( $this->api_base() ); ?> ↗</a></li>
				<li>Complete your store setup (name, currency, brand color)</li>
				<li>Open the <strong>Embed</strong> tab in your store dashboard</li>
				<li>Click <strong>"Generate Plugin Key"</strong></li>
				<li>Copy your <strong>Store ID</strong> and <strong>Plugin Secret</strong></li>
				<li>Paste them in the form below and click <strong>Save</strong></li>
			</ol>
		</div>

		<div class="bb-section">
			<h2>Connection Settings</h2>
			<form method="post">
				<?php wp_nonce_field( 'buildbot_action', 'bb_nonce' ); ?>
				<input type="hidden" name="bb_action" value="save_connection" />
				<table class="bb-form-table">
					<tr>
						<th><label for="bb_store_id">Store ID</label></th>
						<td>
							<input type="text" id="bb_store_id" name="bb_store_id"
							       value="<?php echo esc_attr( $store_id ); ?>"
							       placeholder="e.g. abc123xyz"
							       class="bb-input" required />
							<p class="bb-desc">Your unique BuildBot store identifier (shown in your dashboard).</p>
						</td>
					</tr>
					<tr>
						<th><label for="bb_secret">Plugin Secret</label></th>
						<td>
							<input type="password" id="bb_secret" name="bb_secret"
							       value=""
							       placeholder="<?php echo $secret ? 'Secret saved — paste here to rotate it' : 'Paste plugin secret from dashboard'; ?>"
							       class="bb-input"
							       autocomplete="new-password" />
							<?php if ( $secret ) : ?>
								<p class="bb-desc bb-ok">✓ Plugin secret is saved. Leave blank to keep it, or paste a new one to rotate.</p>
							<?php else : ?>
								<p class="bb-desc">Generate this from the Embed tab in your BuildBot dashboard.</p>
							<?php endif; ?>
						</td>
					</tr>
					<tr>
						<th>
							<label for="bb_api_base">
								API URL
								<span class="bb-optional">(advanced)</span>
							</label>
						</th>
						<td>
							<input type="url" id="bb_api_base" name="bb_api_base"
							       value="<?php echo esc_attr( $api_base ?: BUILDBOT_API_BASE ); ?>"
							       class="bb-input bb-input-wide" />
							<p class="bb-desc">
								Leave as default unless you are self-hosting BuildBot.
								Default: <code><?php echo esc_html( BUILDBOT_API_BASE ); ?></code>
							</p>
						</td>
					</tr>
				</table>
				<div class="bb-form-footer">
					<button type="submit" class="bb-btn bb-btn-primary">💾 Save Connection Settings</button>
				</div>
			</form>
		</div>

		<div class="bb-section">
			<h2>Test Connection</h2>
			<p>After saving, verify the plugin can reach BuildBot.</p>
			<form method="post">
				<?php wp_nonce_field( 'buildbot_action', 'bb_nonce' ); ?>
				<button type="submit" name="bb_action" value="test"
				        class="bb-btn bb-btn-primary"
				        <?php echo ! $this->credentials_ok() ? 'disabled' : ''; ?>>
					🔌 Test Connection
				</button>
				<?php if ( ! $this->credentials_ok() ) : ?>
					<span class="bb-hint">Save your credentials above first.</span>
				<?php endif; ?>
			</form>
		</div>
		<?php
	}

	/* ── Tab: Widget ──────────────────────────────────────────────────────── */
	private function tab_widget() {
		$widget_on  = get_option( BB_WIDGET, '1' ) === '1';
		$widget_pos = get_option( BB_WIDGET_POS, 'all' );
		$api_base   = $this->api_base();
		$store_id   = get_option( BB_STORE_ID, '' );
		?>
		<div class="bb-section">
			<h2>Widget Settings</h2>
			<p>
				The BuildBot widget adds an AI assistant button to your storefront.
				Shoppers answer 3 quick questions and get personalized PC build recommendations
				from your catalog — without leaving your store.
			</p>
			<form method="post">
				<?php wp_nonce_field( 'buildbot_action', 'bb_nonce' ); ?>
				<input type="hidden" name="bb_action" value="save_widget" />
				<table class="bb-form-table">
					<tr>
						<th>Widget Status</th>
						<td>
							<label class="bb-toggle-wrap">
								<input type="checkbox" name="bb_widget_enabled" value="1" <?php checked( $widget_on ); ?> />
								<span class="bb-toggle-track">
									<span class="bb-toggle-thumb"></span>
								</span>
								<span class="bb-toggle-label">
									<?php echo $widget_on ? '<span class="bb-ok">Widget is enabled</span>' : '<span class="bb-muted">Widget is disabled</span>'; ?>
								</span>
							</label>
							<p class="bb-desc">When enabled, the BuildBot button appears in the bottom-right corner of your storefront.</p>
						</td>
					</tr>
					<tr>
						<th><label for="bb_widget_pos">Show on</label></th>
						<td>
							<select id="bb_widget_pos" name="bb_widget_pos" class="bb-select">
								<option value="all"     <?php selected( $widget_pos, 'all' ); ?>>All pages</option>
								<option value="shop"    <?php selected( $widget_pos, 'shop' ); ?>>Shop &amp; category pages only</option>
								<option value="product" <?php selected( $widget_pos, 'product' ); ?>>Product pages only</option>
							</select>
							<p class="bb-desc">Choose where the widget appears. "All pages" is recommended for maximum visibility.</p>
						</td>
					</tr>
				</table>
				<div class="bb-form-footer">
					<button type="submit" class="bb-btn bb-btn-primary">💾 Save Widget Settings</button>
				</div>
			</form>
		</div>

		<div class="bb-section">
			<h2>Customize the Widget</h2>
			<p>Adjust the widget's colors, title, welcome message, currency, and budget presets from your BuildBot dashboard.</p>
			<a href="<?php echo esc_url( $api_base . '/dashboard' ); ?>" target="_blank" class="bb-btn">
				🎨 Open Widget Settings in Dashboard ↗
			</a>
		</div>

		<div class="bb-section">
			<h2>Widget Embed Code</h2>
			<p>The plugin automatically injects this script tag into your pages. You do not need to add it manually.</p>
			<?php if ( $store_id ) : ?>
				<pre class="bb-code-block">&lt;script src="<?php echo esc_html( $api_base . '/widget.js' ); ?>"
        data-store-id="<?php echo esc_html( $store_id ); ?>"
        async&gt;&lt;/script&gt;</pre>
				<p class="bb-desc">The <code>async</code> attribute ensures the widget does not affect your page load speed.</p>
			<?php else : ?>
				<p class="bb-hint">Enter your Store ID in the Connection tab to see your embed code.</p>
			<?php endif; ?>
		</div>
		<?php
	}

	/* ── Tab: Sync ────────────────────────────────────────────────────────── */
	private function tab_sync() {
		$auto_sync  = get_option( BB_AUTO_SYNC, '1' ) === '1';
		$connected  = $this->credentials_ok();
		$log        = get_option( BB_SYNC_LOG, array() );
		$next_cron  = wp_next_scheduled( 'buildbot_auto_sync' );
		?>
		<div class="bb-section">
			<h2>Manual Sync</h2>
			<p>
				Push all your published WooCommerce products to BuildBot right now.
				This replaces the entire BuildBot catalog with your current products.
			</p>
			<form method="post">
				<?php wp_nonce_field( 'buildbot_action', 'bb_nonce' ); ?>
				<button type="submit" name="bb_action" value="sync"
				        class="bb-btn bb-btn-primary"
				        <?php echo ! $connected ? 'disabled' : ''; ?>>
					🔄 Sync All Products Now
				</button>
			</form>
			<?php if ( ! $connected ) : ?>
				<p class="bb-hint">⚠ Connect your store first. <a href="<?php echo esc_url( admin_url( 'admin.php?page=buildbot&tab=connection' ) ); ?>">Go to Connection →</a></p>
			<?php endif; ?>
		</div>

		<div class="bb-section">
			<h2>Auto-Sync</h2>
			<form method="post">
				<?php wp_nonce_field( 'buildbot_action', 'bb_nonce' ); ?>
				<input type="hidden" name="bb_action" value="save_sync_settings" />
				<table class="bb-form-table">
					<tr>
						<th>Automatic Sync</th>
						<td>
							<label class="bb-toggle-wrap">
								<input type="checkbox" name="bb_auto_sync" value="1" <?php checked( $auto_sync ); ?> />
								<span class="bb-toggle-track">
									<span class="bb-toggle-thumb"></span>
								</span>
								<span class="bb-toggle-label">
									<?php echo $auto_sync ? '<span class="bb-ok">Runs every 6 hours</span>' : '<span class="bb-muted">Disabled</span>'; ?>
								</span>
							</label>
							<p class="bb-desc">
								Uses WP-Cron to keep your BuildBot catalog in sync automatically.
								<?php if ( $auto_sync && $next_cron ) : ?>
									<br><strong>Next run:</strong> <?php echo esc_html( human_time_diff( $next_cron ) . ' from now' ); ?>.
								<?php endif; ?>
							</p>
						</td>
					</tr>
				</table>
				<div class="bb-form-footer">
					<button type="submit" class="bb-btn bb-btn-primary">💾 Save Sync Settings</button>
				</div>
			</form>
			<div class="bb-info-box">
				<strong>⚠ About WP-Cron:</strong> WP-Cron only fires when your site gets a page visit.
				For stores with low traffic, add a real server cron for reliability:<br>
				<code>*/360 * * * * curl -s "<?php echo esc_html( site_url( '/wp-cron.php?doing_wp_cron' ) ); ?>" &gt; /dev/null 2&gt;&amp;1</code>
			</div>
		</div>

		<div class="bb-section">
			<h2>What Gets Synced</h2>
			<ul class="bb-list">
				<li>All <strong>published</strong> WooCommerce products with a price greater than zero</li>
				<li>Variable products use their <strong>minimum variation price</strong></li>
				<li>Each product's name, category, price, stock status, SKU, and short description are synced</li>
				<li>When you <strong>save a product</strong> in WooCommerce, it is pushed to BuildBot immediately</li>
				<li>When you <strong>delete a product</strong>, it is removed from BuildBot automatically</li>
			</ul>
		</div>

		<div class="bb-section">
			<h2>Sync Log <span class="bb-small">(last 10 runs)</span></h2>
			<?php if ( ! empty( $log ) ) : ?>
				<table class="bb-table">
					<thead>
						<tr>
							<th>Time</th>
							<th>Trigger</th>
							<th>Sent</th>
							<th>Imported</th>
							<th>Result</th>
							<th>Duration</th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ( $log as $entry ) : ?>
							<tr>
								<td><?php echo esc_html( $entry['time'] ); ?></td>
								<td>
									<span class="bb-badge <?php echo $entry['trigger'] === 'manual' ? 'bb-badge-blue' : 'bb-badge-gray'; ?>">
										<?php echo esc_html( ucfirst( $entry['trigger'] ) ); ?>
									</span>
								</td>
								<td><?php echo esc_html( $entry['count'] ); ?></td>
								<td><?php echo esc_html( isset( $entry['imported'] ) ? $entry['imported'] : '—' ); ?></td>
								<td>
									<?php if ( $entry['success'] ) : ?>
										<span class="bb-ok">✓ Success</span>
									<?php else : ?>
										<span class="bb-err" title="<?php echo esc_attr( isset( $entry['error'] ) ? $entry['error'] : '' ); ?>">
											✗ <?php echo esc_html( isset( $entry['error'] ) ? $entry['error'] : 'Error' ); ?>
										</span>
									<?php endif; ?>
								</td>
								<td><?php echo esc_html( ( isset( $entry['ms'] ) ? $entry['ms'] : 0 ) . 'ms' ); ?></td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
				<form method="post" style="margin-top:1rem">
					<?php wp_nonce_field( 'buildbot_action', 'bb_nonce' ); ?>
					<button type="submit" name="bb_action" value="clear_log" class="bb-btn bb-btn-ghost"
					        onclick="return confirm('Clear all sync log entries?')">
						🗑 Clear Log
					</button>
				</form>
			<?php else : ?>
				<p class="bb-hint">No sync history yet. Run a manual sync to see logs here.</p>
			<?php endif; ?>
		</div>
		<?php
	}

	/* ── Tab: Help ────────────────────────────────────────────────────────── */
	private function tab_help() {
		$api_base = $this->api_base();
		?>
		<div class="bb-section bb-section-highlight">
			<h2>🚀 Quick Setup Guide</h2>
			<ol class="bb-steps">
				<li>Go to <a href="<?php echo esc_url( $api_base ); ?>" target="_blank"><?php echo esc_html( $api_base ); ?> ↗</a> and create an account</li>
				<li>Verify your email, then complete store setup (name, currency, brand color)</li>
				<li>Open the <strong>Embed</strong> tab in your dashboard</li>
				<li>Click <strong>Generate Plugin Key</strong> — copy your Store ID and Plugin Secret</li>
				<li>Paste them in the <a href="<?php echo esc_url( admin_url( 'admin.php?page=buildbot&tab=connection' ) ); ?>">Connection tab</a> and save</li>
				<li>Click <strong>Test Connection</strong> to confirm everything works</li>
				<li>Go to the <a href="<?php echo esc_url( admin_url( 'admin.php?page=buildbot&tab=sync' ) ); ?>">Sync tab</a> and run <strong>Sync All Products Now</strong></li>
				<li>Enable the widget in the <a href="<?php echo esc_url( admin_url( 'admin.php?page=buildbot&tab=widget' ) ); ?>">Widget tab</a></li>
				<li>Visit your storefront — the BuildBot button should appear in the bottom-right corner</li>
			</ol>
		</div>

		<div class="bb-section">
			<h2>📦 Category Mapping</h2>
			<p>
				BuildBot maps your WooCommerce product categories to standard PC component categories.
				Make sure your categories match (or are close to) the names below.
			</p>
			<table class="bb-table">
				<thead>
					<tr>
						<th>BuildBot Category</th>
						<th>Required?</th>
						<th>Accepted WooCommerce Category Names</th>
					</tr>
				</thead>
				<tbody>
					<tr><td><strong>CPU</strong></td><td><span class="bb-ok">Required</span></td><td>CPU, Processor, Processors, Intel, AMD</td></tr>
					<tr><td><strong>Motherboard</strong></td><td><span class="bb-ok">Required</span></td><td>Motherboard, Motherboards, Mainboard, Board</td></tr>
					<tr><td><strong>RAM</strong></td><td><span class="bb-ok">Required</span></td><td>RAM, Memory, DDR4, DDR5, DRAM</td></tr>
					<tr><td><strong>Storage</strong></td><td><span class="bb-ok">Required</span></td><td>SSD, HDD, Storage, Hard Drive, NVMe, Drive</td></tr>
					<tr><td><strong>GPU</strong></td><td><span class="bb-muted">Optional</span></td><td>GPU, Graphics Card, VGA, Video Card, Graphics</td></tr>
					<tr><td><strong>PSU</strong></td><td><span class="bb-muted">Optional</span></td><td>PSU, Power Supply, SMPS, Power</td></tr>
					<tr><td><strong>Case</strong></td><td><span class="bb-muted">Optional</span></td><td>Case, Cabinet, Chassis, PC Case, Tower</td></tr>
					<tr><td><strong>Cooler</strong></td><td><span class="bb-muted">Optional</span></td><td>Cooler, CPU Cooler, Cooling, Heatsink, Fan</td></tr>
				</tbody>
			</table>
			<p class="bb-hint">
				<strong>Tip:</strong> BuildBot requires CPU, Motherboard, RAM, and Storage to generate builds.
				GPU, PSU, Case, and Cooler improve build quality but are optional.
			</p>
		</div>

		<div class="bb-section">
			<h2>❓ FAQ</h2>

			<details class="bb-faq">
				<summary>The widget button is not appearing on my store</summary>
				<div class="bb-faq-body">
					<ol>
						<li>Confirm the widget is enabled in the <a href="<?php echo esc_url( admin_url( 'admin.php?page=buildbot&tab=widget' ) ); ?>">Widget tab</a></li>
						<li>Check that your Store ID and Secret are saved and the connection test passes</li>
						<li>Make sure your BuildBot plan is active (not expired)</li>
						<li>Clear any caching plugins and check again</li>
						<li>Open your browser console for JavaScript errors</li>
					</ol>
				</div>
			</details>

			<details class="bb-faq">
				<summary>Products synced but BuildBot says "catalog incomplete"</summary>
				<div class="bb-faq-body">
					<p>BuildBot needs products in all 4 required categories (CPU, Motherboard, RAM, Storage). Check the category mapping table above. Your WooCommerce category names must match (or be close variants of) the accepted names.</p>
				</div>
			</details>

			<details class="bb-faq">
				<summary>Variable products are syncing with wrong prices</summary>
				<div class="bb-faq-body">
					<p>Variable products sync at their minimum variation price. If you have significant price differences between variations (e.g., 8GB vs 32GB RAM), consider adding them as separate simple products for more accurate recommendations.</p>
				</div>
			</details>

			<details class="bb-faq">
				<summary>Products aren't updating automatically when I save them</summary>
				<div class="bb-faq-body">
					<p>The plugin hooks into <code>woocommerce_update_product</code>. Check:</p>
					<ol>
						<li>Your Store ID and Secret are saved and the connection test passes</li>
						<li>Your server can make outbound HTTPS requests to <code><?php echo esc_html( $api_base ); ?></code></li>
						<li>Check your server or hosting firewall settings</li>
					</ol>
				</div>
			</details>

			<details class="bb-faq">
				<summary>How do I rotate (change) my Plugin Secret?</summary>
				<div class="bb-faq-body">
					<p>Go to the Embed tab in your BuildBot dashboard, click "Generate Plugin Key" again. This invalidates the old secret. Then come back here, paste the new secret in the Plugin Secret field, and save.</p>
				</div>
			</details>

			<details class="bb-faq">
				<summary>Auto-sync isn't running on schedule</summary>
				<div class="bb-faq-body">
					<p>WP-Cron only fires when your site receives page visits. For stores with low traffic, add a real server cron job that hits your WordPress cron URL every 6 hours. See the Sync tab for the exact command.</p>
				</div>
			</details>
		</div>

		<div class="bb-section">
			<h2>🆘 Support &amp; Debug Info</h2>
			<p>If you need help, send this information to the BuildBot team:</p>
			<table class="bb-table">
				<tbody>
					<tr><td>Plugin Version</td><td><?php echo esc_html( BUILDBOT_VERSION ); ?></td></tr>
					<tr><td>API Endpoint</td><td><code><?php echo esc_html( $this->api_base() ); ?></code></td></tr>
					<tr><td>Store ID Set</td><td><?php echo get_option( BB_STORE_ID ) ? '<span class="bb-ok">Yes</span>' : '<span class="bb-err">No</span>'; ?></td></tr>
					<tr><td>Secret Set</td><td><?php echo get_option( BB_SECRET ) ? '<span class="bb-ok">Yes</span>' : '<span class="bb-err">No</span>'; ?></td></tr>
					<tr><td>WordPress Version</td><td><?php echo esc_html( get_bloginfo( 'version' ) ); ?></td></tr>
					<tr><td>WooCommerce Version</td><td><?php echo esc_html( defined( 'WC_VERSION' ) ? WC_VERSION : '?' ); ?></td></tr>
					<tr><td>PHP Version</td><td><?php echo esc_html( phpversion() ); ?></td></tr>
					<tr><td>Site URL</td><td><?php echo esc_html( site_url() ); ?></td></tr>
				</tbody>
			</table>
			<p style="margin-top:1rem">
				<a href="<?php echo esc_url( $api_base . '/dashboard' ); ?>" target="_blank" class="bb-btn">
					💬 Submit Support Ticket ↗
				</a>
			</p>
		</div>
		<?php
	}

	/* ── Admin styles ─────────────────────────────────────────────────────── */
	private function render_styles() {
		?>
		<style>
		/* ── BuildBot admin UI — scoped to .bb-wrap ─────────────────────────── */
		.bb-wrap { max-width: 960px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }

		/* Header */
		.bb-header { display: flex; align-items: center; justify-content: space-between; background: #0a1a2d; color: #fff; border-radius: 10px; padding: 1.25rem 1.5rem; margin: 1rem 0 1.25rem; }
		.bb-header-brand { display: flex; align-items: center; gap: 1rem; }
		.bb-logo { font-size: 2rem; line-height: 1; }
		.bb-header h1 { margin: 0; font-size: 1.25rem; font-weight: 700; color: #fff; }
		.bb-header p  { margin: .15rem 0 0; font-size: .82rem; color: rgba(255,255,255,.6); }
		.bb-header-conn { display: flex; align-items: center; gap: .5rem; font-size: .88rem; color: rgba(255,255,255,.8); }

		/* Connection dot */
		.bb-status-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
		.bb-green { background: #34d399; box-shadow: 0 0 0 3px rgba(52,211,153,.25); }
		.bb-red   { background: #f87171; box-shadow: 0 0 0 3px rgba(248,113,113,.25); }

		/* Notice */
		.bb-notice { padding: .85rem 1.1rem; border-radius: 8px; margin-bottom: 1.25rem; font-size: .93rem; font-weight: 500; }
		.bb-notice-success { background: #ecfdf5; color: #065f46; border-left: 4px solid #34d399; }
		.bb-notice-error   { background: #fef2f2; color: #991b1b; border-left: 4px solid #f87171; }

		/* Tabs */
		.bb-tabs { display: flex; gap: .25rem; border-bottom: 2px solid #e5e7eb; margin-bottom: 1.5rem; flex-wrap: wrap; }
		.bb-tab { padding: .6rem 1rem; border-radius: 6px 6px 0 0; font-size: .88rem; font-weight: 600; color: #374151; text-decoration: none; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: color .15s, border-color .15s; }
		.bb-tab:hover { color: #2a5ee8; }
		.bb-tab-active { color: #2a5ee8; border-bottom-color: #2a5ee8; background: #eff6ff; }

		/* Section */
		.bb-section { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 1.25rem 1.5rem; margin-bottom: 1.25rem; }
		.bb-section h2 { margin: 0 0 1rem; font-size: 1rem; font-weight: 700; color: #111827; }
		.bb-section h3 { margin: 1rem 0 .5rem; font-size: .9rem; font-weight: 700; color: #374151; }
		.bb-section-highlight { background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%); border-color: #bfdbfe; }

		/* Stat cards */
		.bb-stat-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: .75rem; margin-bottom: 1.25rem; }
		.bb-stat-card { background: #fff; border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 1rem 1.1rem; display: flex; gap: .75rem; align-items: flex-start; }
		.bb-stat-card.bb-stat-ok   { border-color: #a7f3d0; background: #f0fdf4; }
		.bb-stat-card.bb-stat-warn { border-color: #fde68a; background: #fffbeb; }
		.bb-stat-icon { font-size: 1.4rem; line-height: 1; flex: none; }
		.bb-stat-card > div { display: flex; flex-direction: column; gap: .1rem; }
		.bb-stat-card strong { font-size: .85rem; font-weight: 700; color: #111827; }
		.bb-stat-card span, .bb-stat-card code { font-size: .82rem; color: #6b7280; }
		.bb-stat-card code { background: #f3f4f6; border-radius: 4px; padding: .1rem .4rem; font-size: .78rem; }

		/* Action row */
		.bb-action-row { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: .75rem; }

		/* Buttons */
		.bb-btn { display: inline-flex; align-items: center; gap: .35rem; padding: .55rem 1.1rem; border-radius: 7px; font-size: .88rem; font-weight: 600; cursor: pointer; text-decoration: none; border: 1.5px solid #d1d5db; background: #fff; color: #374151; transition: background .15s, border-color .15s, color .15s; }
		.bb-btn:hover { background: #f9fafb; border-color: #9ca3af; color: #111827; text-decoration: none; }
		.bb-btn:disabled { opacity: .45; cursor: not-allowed; }
		.bb-btn-primary { background: #2a5ee8; border-color: #2a5ee8; color: #fff; }
		.bb-btn-primary:hover { background: #1d4ed8; border-color: #1d4ed8; color: #fff; }
		.bb-btn-primary:disabled { background: #93c5fd; border-color: #93c5fd; }
		.bb-btn-ghost { background: transparent; }
		.bb-btn-ghost:hover { background: #fef2f2; border-color: #f87171; color: #991b1b; }

		/* Toggle switch */
		.bb-toggle-wrap { display: inline-flex; align-items: center; gap: .6rem; cursor: pointer; user-select: none; }
		.bb-toggle-wrap input[type=checkbox] { position: absolute; opacity: 0; width: 0; height: 0; }
		.bb-toggle-track { position: relative; width: 44px; height: 24px; background: #d1d5db; border-radius: 12px; transition: background .2s; flex: none; }
		.bb-toggle-thumb { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; background: #fff; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: left .2s; }
		.bb-toggle-wrap input:checked ~ .bb-toggle-track { background: #2a5ee8; }
		.bb-toggle-wrap input:checked ~ .bb-toggle-track .bb-toggle-thumb { left: 22px; }
		.bb-toggle-label { font-size: .9rem; }

		/* Form table */
		.bb-form-table { width: 100%; border-collapse: collapse; margin-bottom: .5rem; }
		.bb-form-table th { text-align: left; padding: .75rem 1rem .75rem 0; font-size: .88rem; font-weight: 600; color: #374151; width: 160px; vertical-align: top; padding-top: .9rem; }
		.bb-form-table td { padding: .6rem 0; }
		.bb-form-footer { margin-top: 1rem; padding-top: .75rem; border-top: 1px solid #f3f4f6; }
		.bb-input { width: 100%; max-width: 400px; padding: .55rem .75rem; border: 1.5px solid #d1d5db; border-radius: 7px; font-size: .9rem; color: #111827; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; }
		.bb-input:focus { outline: none; border-color: #2a5ee8; box-shadow: 0 0 0 3px rgba(42,94,232,.12); }
		.bb-input-wide { max-width: 100%; }
		.bb-select { padding: .5rem .7rem; border: 1.5px solid #d1d5db; border-radius: 7px; font-size: .9rem; color: #111827; background: #fff; cursor: pointer; }
		.bb-desc { margin: .35rem 0 0; font-size: .82rem; color: #6b7280; }
		.bb-optional { font-weight: 400; color: #9ca3af; font-size: .8rem; }

		/* Table */
		.bb-table { width: 100%; border-collapse: collapse; font-size: .88rem; }
		.bb-table th { text-align: left; padding: .55rem .75rem; background: #f9fafb; border-bottom: 2px solid #e5e7eb; font-weight: 700; color: #374151; font-size: .8rem; text-transform: uppercase; letter-spacing: .03em; }
		.bb-table td { padding: .55rem .75rem; border-bottom: 1px solid #f3f4f6; color: #374151; }
		.bb-table tr:last-child td { border-bottom: none; }
		.bb-table tr:hover td { background: #f9fafb; }

		/* Badges */
		.bb-badge { display: inline-block; padding: .15rem .55rem; border-radius: 999px; font-size: .75rem; font-weight: 700; letter-spacing: .02em; }
		.bb-badge-blue { background: #dbeafe; color: #1e40af; }
		.bb-badge-gray { background: #f3f4f6; color: #4b5563; }

		/* Status text */
		.bb-ok    { color: #059669; font-weight: 600; }
		.bb-err   { color: #dc2626; font-weight: 600; }
		.bb-muted { color: #9ca3af; }
		.bb-hint  { font-size: .82rem; color: #6b7280; margin: .5rem 0 0; }
		.bb-small { font-size: .8rem; }

		/* Info box */
		.bb-info-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: .85rem 1rem; font-size: .85rem; color: #78350f; margin-top: 1rem; }
		.bb-info-box code { background: rgba(0,0,0,.08); border-radius: 4px; padding: .1rem .4rem; font-size: .8rem; display: inline-block; margin-top: .35rem; word-break: break-all; }

		/* Code blocks */
		.bb-code-block { background: #0a1a2d; color: #e2e8f0; padding: .85rem 1rem; border-radius: 8px; font-size: .82rem; font-family: monospace; display: block; overflow-x: auto; white-space: pre; margin: .5rem 0; }

		/* Steps */
		.bb-steps { margin: 0; padding-left: 1.25rem; }
		.bb-steps li { padding: .3rem 0; font-size: .92rem; color: #374151; }
		.bb-steps li a { color: #2a5ee8; }
		.bb-list { margin: 0; padding-left: 1.25rem; }
		.bb-list li { padding: .25rem 0; font-size: .9rem; color: #374151; }

		/* FAQ accordion */
		.bb-faq { border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: .5rem; overflow: hidden; }
		.bb-faq summary { padding: .8rem 1rem; font-weight: 600; font-size: .9rem; color: #111827; cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; }
		.bb-faq summary::-webkit-details-marker { display: none; }
		.bb-faq summary::after { content: '+'; font-size: 1.1rem; color: #9ca3af; }
		.bb-faq[open] summary::after { content: '−'; }
		.bb-faq summary:hover { background: #f9fafb; }
		.bb-faq-body { padding: .75rem 1rem 1rem; border-top: 1px solid #e5e7eb; background: #f9fafb; font-size: .88rem; color: #374151; }
		.bb-faq-body p, .bb-faq-body ol { margin: 0 0 .5rem; }
		.bb-faq-body ol { padding-left: 1.25rem; }
		.bb-faq-body code { background: #e5e7eb; border-radius: 4px; padding: .1rem .35rem; font-size: .82rem; }
		</style>
		<?php
	}

	/* ── Activation / Deactivation ────────────────────────────────────────── */
	public static function activate() {
		add_option( BB_WIDGET,     '1' );
		add_option( BB_WIDGET_POS, 'all' );
		add_option( BB_AUTO_SYNC,  '1' );
	}

	public static function deactivate() {
		wp_clear_scheduled_hook( 'buildbot_auto_sync' );
	}
}

/* ── Bootstrap ────────────────────────────────────────────────────────────── */
register_activation_hook( __FILE__, array( 'BuildBot_WooCommerce', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'BuildBot_WooCommerce', 'deactivate' ) );

add_action( 'plugins_loaded', function () {
	if ( ! class_exists( 'WooCommerce' ) ) {
		add_action( 'admin_notices', function () {
			echo '<div class="notice notice-error"><p>'
				. '<strong>BuildBot:</strong> WooCommerce must be installed and active to use this plugin.'
				. '</p></div>';
		} );
		return;
	}
	new BuildBot_WooCommerce();
} );

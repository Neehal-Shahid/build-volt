<?php
/**
 * Fired when the plugin is deleted from the Plugins screen.
 * Removes every option BuildBot ever wrote.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'buildbot_store_id' );
delete_option( 'buildbot_plugin_secret' );
delete_option( 'buildbot_api_base' );
delete_option( 'buildbot_widget_enabled' );
delete_option( 'buildbot_widget_position' );
delete_option( 'buildbot_auto_sync' );
delete_option( 'buildbot_sync_log' );

wp_clear_scheduled_hook( 'buildbot_auto_sync' );

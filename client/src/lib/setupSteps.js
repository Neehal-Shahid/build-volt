import { isWidgetInstalled, isWidgetEnabled } from "./widgetStatus";

/**
 * Single source of truth for the "Get started" checklist — used by both the
 * Overview tab's full checklist card and the persistent nudge shown on every
 * other tab. Keeping this in one place means they can never disagree about
 * which step is actually next.
 */
export function computeSetupSteps(store, { productCount, hideEmbed } = {}) {
  const wooConnected = !!store?.wooConnected;
  return [
    { key: "name", label: "Name your store", done: !store?.needsSetup, goTo: "store" },
    { key: "products", label: "Add products to your catalog", done: (productCount ?? 0) > 0, goTo: "products" },
    {
      key: "install",
      label: wooConnected ? "Connect WooCommerce plugin" : "Install widget on your site",
      done: isWidgetInstalled(store),
      goTo: hideEmbed ? "store" : "embed",
    },
    {
      key: "enable",
      label: "Enable widget for shoppers",
      done: isWidgetEnabled(store) && isWidgetInstalled(store),
      goTo: "settings",
    },
  ];
}

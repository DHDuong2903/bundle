/**
 * Bundle Display - Client-side functionality
 * Handles adding bundle items to cart
 */

(function () {
  "use strict";

  // Wait for DOM to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    // Find all bundle add-to-cart buttons
    const bundleButtons = document.querySelectorAll(".bundle-add-to-cart");

    bundleButtons.forEach((button) => {
      button.addEventListener("click", handleBundleAddToCart);
    });
  }

  async function handleBundleAddToCart(event) {
    const button = event.target;
    const productId = button.dataset.productId;
    const bundleId = button.dataset.bundleId;

    if (!productId) {
      console.error("No product ID found");
      return;
    }

    // Disable button and show loading state
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = "Adding to cart...";

    try {
      // Fetch the product to get the variant ID
      const response = await fetch(`/products/${productId}.js`);
      const product = await response.json();

      if (!product || !product.variants || product.variants.length === 0) {
        throw new Error("Product not found or has no variants");
      }

      const variantId = product.variants[0].id;

      // Add to cart using Shopify AJAX API
      const cartResponse = await fetch("/cart/add.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              id: variantId,
              quantity: 1,
              properties: {
                _bundle_id: bundleId,
              },
            },
          ],
        }),
      });

      if (!cartResponse.ok) {
        throw new Error("Failed to add to cart");
      }

      const cartData = await cartResponse.json();
      console.log("Added to cart:", cartData);

      // Update button to show success
      button.textContent = "✓ Added to Cart!";
      button.style.background = "#10b981";

      // Trigger cart drawer/notification if available
      if (typeof window.Shopify !== "undefined" && window.Shopify.theme) {
        // Trigger theme's cart update event
        document.dispatchEvent(
          new CustomEvent("cart:updated", {
            detail: { cartData },
          }),
        );
      }

      // Optionally redirect to cart after a short delay
      setTimeout(() => {
        // Uncomment to redirect to cart
        // window.location.href = '/cart';

        // Or just reset the button
        button.textContent = originalText;
        button.disabled = false;
        button.style.background = "";
      }, 2000);
    } catch (error) {
      console.error("Error adding bundle to cart:", error);
      button.textContent = "✗ Error - Try Again";
      button.style.background = "#ef4444";

      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
        button.style.background = "";
      }, 3000);
    }
  }

  // Export for testing or external use
  if (typeof window !== "undefined") {
    window.BundleApp = {
      init: init,
      handleBundleAddToCart: handleBundleAddToCart,
    };
  }
})();

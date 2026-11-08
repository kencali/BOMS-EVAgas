# Route map regression checklist

Use this checklist whenever a change affects route visualization. Verify the same saved route in both **Admin Route Planning** and **Rider My Route**.

1. The map initializes successfully.
2. OpenStreetMap tiles load correctly.
3. The branch starting location is clearly identifiable.
4. Delivery markers display correctly.
5. Marker numbers match the displayed stop order.
6. The road-route geometry is visible.
7. The distance and estimated duration are consistent between Admin and Rider.
8. Re-optimizing replaces the previous markers and route line without duplicates.
9. The map resizes correctly after sidebar, viewport, or layout changes.
10. There is no unintended clipping or horizontal overflow.
11. Browser diagnostics show no relevant CSP or map-asset loading errors.
12. Admin and Rider show the same starting location, stop sequence, route geometry, and metrics.

If route planning cannot be reached from the PHP server, verify the configured OSRM endpoint and server network/DNS access before treating the map display as faulty.

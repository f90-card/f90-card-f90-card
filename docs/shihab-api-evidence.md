# Shihab API verification — 2026-10-31

Official documentation: https://api.shihabcard.com/api-docs
The supplier's public application at https://shihabcard.com links to this page from its API documentation component.

- Authentication uses the `api-token` header. Credentials remain in the Edge Function environment.
- `/client/api/products` supplies product IDs, prices, availability, quantity constraints and input fields. Its documented schema does not identify automatic versus staff execution. `amount`, `package` and `specificPackage` are not execution classifications.
- `/client/api/content/0` and category-specific content are read-only catalog endpoints.
- Each purchase uses one UUIDv4 `order_uuid`. The documentation explicitly describes repeated requests with that reference as returning the original order, avoiding another purchase and charge.
- `/client/api/check?orders=[UUID]&uuid=1` is the documented read-only way to recover the supplier order ID after an ambiguous submission. Recovery never calls the purchase endpoint.
- Documented order states are `accept`, `reject` and `wait`. F90 maps these to completion, rejection/refund and supplier waiting, respectively. Other cancellation aliases are handled defensively, without claiming the supplier documents them.
- Missing execution metadata remains unconfirmed. Source product IDs, observations and any explicit execution evidence are retained privately; no classification is inferred from names or quantity fields.

No real purchase was submitted during verification. Transport and recovery tests use mock responses; SQL acceptance tests roll back isolated identities and products.

## Supplier storefront detail source

The supplier's public application uses `https://api.shihabcard.com/api/client/product/get/PRODUCT_ID?lang=ar` for the detail page. This is a read-only endpoint with a richer description than the reseller product list.

All 210 mapped service IDs were fetched and matched to the returned IDs. At this observation, explicit supplier wording confirms 16 manual and 3 automatic services. The other 191 descriptions do not expressly identify the execution method. A stated short duration is not used to infer automation.

Explicit execution duration statements are available for 128 services. Bundle validity, included telephone minutes, and operating hours are excluded. For the other 82 services, F90 shows that the supplier has not specified the duration, rather than displaying the store's generic estimate.

Details refresh in leased batches of up to 20 each minute, with a 15-minute interval per successful observation. Failed fetches retry after the short lease. Retail prices, names, images and category assignments are not updated by this process. Each confirmed mode retains a short evidence excerpt, its source URL and the observation time for verification.

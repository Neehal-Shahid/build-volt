# Payment Test Cards

> **Developer reference only — do NOT show these to end users.**
> These card numbers are accepted by the BuildBot demo payment gateway for testing.

## Card Payment Test Numbers

| Brand | Number | CVV | Expiry | Outcome |
|-------|--------|-----|--------|---------|
| Visa | `4242 4242 4242 4242` | `123` | Any future date | ✅ Success |
| Mastercard | `5555 5555 5555 4444` | `123` | Any future date | ✅ Success |
| Amex | `3782 822463 10005` | `1234` | Any future date | ✅ Success |
| Visa | `4000 0000 0000 0002` | `123` | Any future date | ❌ Declined |
| Visa | `4000 0000 0000 9995` | `123` | Any future date | ❌ Insufficient funds |

## Instructions

1. Open the Billing tab → select any plan → click "Pay with Card".
2. Enter one of the card numbers above.
3. Fill in any name, any future expiry (e.g. `12/28`), and the CVV above.
4. Click **Pay**.

Success cards will activate the plan instantly for 30 days.  
Declined cards will return an error message without activating the plan.

## JazzCash / EasyPaisa Testing

Submit any 6+ character transaction reference (e.g. `TEST123456`) via the manual payment form.  
An admin must then approve it via the Admin Dashboard → Payments tab.

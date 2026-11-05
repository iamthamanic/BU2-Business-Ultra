# Feature: sync web feature folders with api module names

## Happy Path
- [x] features/customers and features/products exist; old customer/product feature paths gone
- [x] Product-specific UI no longer under components/product
- [x] App navigates to same UX; pnpm run checks passes
- [x] Touched files: zero type escape hatches

## Composition Gate
- SKIPPED — path rename; routes unchanged

# Category research and proposal

Reviewed 2026-10-22. The references below are marketplace/listing taxonomies used as evidence about how sellers organize listings. They are not copied into All Items and do not define private inventory categories.

## Verified reference facts

- KupujemProdajem's Electronics and Components section exposes a long, detailed subcategory list. Examples visible on its category page include electronic tools, controllers, capacitors, radio equipment, RF modules, sensors, and printed circuit boards. This supports the observation that marketplace trees can be much more granular than a personal inventory needs.
- MaliOglasi's public category index lists broad listing areas such as tools, garden and yard, electronics and parts, collectibles and antiques, home and household, literature and books, computers, sports and recreation, and baby goods. It also includes many narrower product and service categories.
- A current, complete public monobazar category list was not verified for this review. No claim is made that All Items matches monobazar's taxonomy.
- The requested Avito reference was not used to assert taxonomy details in this implementation; no complete first-party source was verified during this review.

Sources:

- [KupujemProdajem: Electronics and Components](https://www.kupujemprodajem.com/elektronika-i-komponente/kategorija/821)
- [MaliOglasi: Categories](https://malioglasi.rs/kategorije/)

## All Items proposal

All Items uses eleven stable top-level keys: `electronics`, `computers`, `tools`, `antiques`, `clothing`, `plants`, `home`, `books_hobbies`, `sports`, `kids`, and `other`. Russian and English labels live in the local translation dictionary. These broad categories are an All Items proposal for private organization, not a marketplace taxonomy.

Future subcategories should be added beneath stable keys only when user research shows they improve organization. Marketplace mappings must remain a separate layer and must never replace private categories or user-entered custom values.

Existing free-text categories are retained. Only unambiguous legacy labels are displayed as their corresponding localized category; unknown values remain custom text. No database rewrite is needed to introduce stable keys for new selections.

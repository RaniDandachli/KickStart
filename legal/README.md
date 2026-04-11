# Legal drafts (RuniT Arcade)

This folder contains **draft** documents intended as a **starting point only** for **RuniT Arcade**:

- `PRIVACY_POLICY.md` — data practices (fill in entity name, contact, dates, jurisdiction-specific add-ons).
- `TERMS_OF_SERVICE.md` — user agreement, including sections on **skill-based competition** and user obligations regarding **local gambling/sweepstakes laws**.

## Before you publish

1. **Hire counsel** familiar with **U.S. state skill-contest law** (and any country you ship to), **payments**, and **app store** requirements. These drafts cannot replace that review.
2. Replace every `[INSERT …]` placeholder and optional blocks marked for attorney input (e.g., arbitration, California disclosures).
3. Host the final HTML/PDF pages on **HTTPS** domains you control.
4. Set in your production environment:
   - `EXPO_PUBLIC_TERMS_URL`
   - `EXPO_PUBLIC_PRIVACY_URL`  
   See `.env.example` and `app/(app)/(tabs)/profile/legal.tsx`.

## Skill contests vs gambling

Laws are **fact-specific** (game design, entry fees, prizes, marketing, age, geography). Your lawyer should align copy with **actual** product behavior and any **geoblocking** you implement.

---

*These files are not legal advice.*

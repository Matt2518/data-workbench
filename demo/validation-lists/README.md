# DWB v2.0 — Importable Validation Lists

These files are ready to import into DWB v2.0 via **Settings → Validation Lists → Import** (the ↑ Import button in the top-right of the Validation Lists panel).

Each file is in the required import format:
```json
{ "name": "List Display Name", "values": ["value1", "value2", ...] }
```

## Files

| File | List Name | Values |
|---|---|---|
| `validation-list-cyp-tracks.json` | CYP Tracks | 32 |
| `validation-list-employee-type.json` | Employee Type | 7 |
| `validation-list-installations.json` | Installations | 108 |
| `validation-list-lms-uics.json` | LMS UICs | 117 |
| `validation-list-n-codes.json` | N-Codes | 120 |
| `validation-list-regions.json` | Regions | 11 |
| `validation-list-sec-domains.json` | Sec Domains | 15 |
| `validation-list-status.json` | Status | 2 |
| `validation-list-yes-no.json` | Yes/No | 2 |

## Notes

- Source: extracted from `src/data/validators/` in DWB v1.0.
- Header artifact stripped: seven of the nine source arrays had a label string as their first element (e.g. `"Regions"`, `"UICs"`, `"Ncode"`) that was a display artifact, not a valid value. Those were removed during extraction. **Employee Type** and **Status** had no such artifact.
- N-Codes contains three duplicate entries (`N93`, `N922A`, `N922D` each appear twice) — preserved as-is from the source data.
- LMS UICs values include the UIC code prefix (e.g. `"61054 Japan - Yokosuka"`), matching the format expected by DATA_VALIDATION fuzzy matching in the pipeline.
